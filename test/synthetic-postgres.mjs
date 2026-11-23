import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DatabaseService } from '../dist/database/database.service.js';

const image =
  'postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea';
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 15000 }).trim();

// The Rails owner is ../gotx_bot/db/schema.rb (version 2026_07_19_053030).
// No executable schema/migrations exist in this API repository. This centralized
// query-test subset retains queried column types, but omits Rails timestamps,
// indexes, defaults and unrelated tables. It is not a migration/restore tool.
const schema = `
  CREATE TABLE themes (id bigint PRIMARY KEY, title text, description text, creation_date date, nomination_type text);
  CREATE TABLE games (id bigint PRIMARY KEY, title_world text, title_usa text, title_eu text, title_jp text,
    title_other text, year text, systems text[], developer text, genres text[], img_url text,
    time_to_beat integer, screenscraper_id bigint, igdb_id bigint);
  CREATE TABLE users (id bigint PRIMARY KEY, name text, earned_points float, current_points float,
    redeemed_points float, premium_points float, discord_id bigint, admin boolean, premium_subscriber text);
  CREATE TABLE nominations (id bigint PRIMARY KEY, nomination_type text, description text,
    winner boolean, game_id bigint, user_id bigint, theme_id bigint);
  CREATE TABLE completions (id bigint PRIMARY KEY, completed_at timestamp, nomination_id bigint,
    user_id bigint, rpg_achievements boolean);
`;

// One owned database and compiled application per suite, no environment DB fallback.
// initialize is an optional setup hook; failures after acquisition use the same cleanup.
export async function startTestContext({ initialize = async () => {} } = {}) {
  const name = `api-contract-${randomUUID()}`;
  let containerId;
  let pool;
  let module;
  let app;
  let applicationPool;
  let closed = false;
  const close = async () => {
    if (closed) return;
    try {
      if (app) await app.close();
      else if (module) await module.close();
    } finally {
      try {
        if (pool) await pool.end();
      } finally {
        if (containerId) docker('stop', containerId);
        closed = true;
      }
    }
  };
  try {
    containerId = docker(
      'run',
      '--detach',
      '--pull=never',
      '--rm',
      '--name',
      name,
      '--label',
      `api-contract-run=${process.env.API_TEST_RUN ?? name}`,
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '-e',
      'POSTGRES_USER=api_test',
      '-e',
      'POSTGRES_DB=api_test',
      '-p',
      '127.0.0.1::5432',
      image,
    );
    const binding = docker('port', containerId, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding))
      throw new Error('Unexpected test binding');
    const port = Number(binding.split(':')[1]);
    if (port === 5432) throw new Error('Refusing host port 5432');
    const config = {
      host: '127.0.0.1',
      port,
      user: 'api_test',
      database: 'api_test',
      password: '',
      max: 1,
      connectionTimeoutMillis: 1000,
      statement_timeout: 5000,
    };
    pool = new Pool(config);
    for (let attempt = 0; ; attempt++) {
      try {
        await pool.query('SELECT 1');
        break;
      } catch (error) {
        if (attempt === 49) throw error;
        await setTimeout(100);
      }
    }
    await initialize({ pool, containerId });
    await pool.query(schema);
    // Must precede importing AppModule: never load a local env file.
    process.env.NODE_ENV = 'test';
    const { AppModule } = await import('../dist/app.module.js');
    const values = {
      DB_HOST: config.host,
      DB_PORT: port,
      DB_USER: config.user,
      DB_NAME: config.database,
      DB_PASSWORD: '',
    };
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (key) => values[key] })
      .compile();
    app = module.createNestApplication(new FastifyAdapter(), { logger: false });
    await app.init();
    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();
    const database = app.get(DatabaseService);
    await database.query('SELECT 1');
    applicationPool = database.pool;
    const request = async (query, variables = {}) => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query, variables },
      });
      return { status: response.statusCode, ...response.json() };
    };
    return {
      app,
      fastify,
      database,
      pool,
      applicationPool,
      containerId,
      close,
      request,
      reset: () =>
        pool.query('TRUNCATE completions,nominations,themes,games,users'),
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export function remainingContainer(containerId) {
  return docker(
    'ps',
    '-a',
    '--filter',
    `id=${containerId}`,
    '--format',
    '{{.ID}}',
  );
}
