import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';

const container = 'gotx-02-synthetic';
const image =
  'postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea';
export const programs = ['gotm', 'retro', 'rpg', 'goty', 'gotwoty'];
export const publicIds = programs.flatMap((_, p) =>
  [1, 3, 5].map((i) => p * 100 + i),
);
export const privateIds = programs.flatMap((_, p) =>
  [2, 4, 6].map((i) => p * 100 + i),
);

// No environment fallback, host volumes, production data, or default host port.
export async function startSyntheticPostgres({
  failAfterAcquire = false,
  onLifecycle = () => {},
} = {}) {
  let owned = false;
  let pool;
  const close = async () => {
    try {
      if (pool) {
        await pool.end();
        assert.equal(pool.ended, true);
        assert.equal(pool.totalCount, 0);
        assert.equal(pool.idleCount, 0);
        onLifecycle('fixture-pool-ended');
        pool = undefined;
      }
    } finally {
      if (owned) {
        execFileSync('docker', ['stop', container], { stdio: 'pipe' });
        owned = false;
        onLifecycle('container-stopped');
      }
    }
  };
  try {
    execFileSync(
      'docker',
      [
        'run',
        '--detach',
        '--pull=never',
        '--rm',
        '--name',
        container,
        '--tmpfs',
        '/var/lib/postgresql/data',
        '-e',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        '-e',
        'POSTGRES_USER=gotx_test',
        '-e',
        'POSTGRES_DB=gotx_contract_test',
        '-p',
        '127.0.0.1::5432',
        image,
      ],
      { stdio: 'pipe' },
    );
    owned = true;
    onLifecycle('container-acquired');
    const binding = execFileSync('docker', ['port', container, '5432/tcp'], {
      encoding: 'utf8',
    }).trim();
    if (!/^127\.0\.0\.1:\d+$/.test(binding))
      throw new Error('Unexpected synthetic binding');
    const port = Number(binding.split(':')[1]);
    if (port === 5432) throw new Error('Refusing host port 5432');
    const config = {
      host: '127.0.0.1',
      port,
      user: 'gotx_test',
      database: 'gotx_contract_test',
      password: '',
      max: 1,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000,
    };
    pool = new Pool(config);
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        await pool.query('SELECT 1');
        ready = true;
        break;
      } catch {
        await setTimeout(100);
      }
    }
    if (!ready) throw new Error('Synthetic Postgres not ready');
    assert.ok(
      pool.totalCount > 0,
      'Fixture pool must acquire a real connection',
    );
    onLifecycle('fixture-pool-connected');
    if (failAfterAcquire) {
      onLifecycle('fixture-setup-sentinel');
      assert.fail('BV01_fixture-setup_SENTINEL');
    }
    return { pool, config, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function seedBoundary(pool) {
  await pool.query(`
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
    INSERT INTO users VALUES (2, 'Public member', 12.5, 7, 5.5, 3, 123456789, true, 'private'),
      (3, 'Zero public nominations', 0, 0, 0, 0, 987654321, false, 'private');
    INSERT INTO games (id, title_world, year, time_to_beat) VALUES (9000, 'Shared game', '2000', 10);
  `);
  for (const [p, program] of programs.entries()) {
    for (let i = 1; i <= 6; i++) {
      const id = p * 100 + i;
      const winner = i % 2 === 1;
      const offset = [-100, -99, 0, 0, 100, 101][i - 1];
      await pool.query(
        'INSERT INTO themes VALUES ($1, $2, $3, CURRENT_DATE + $4::int, $5)',
        [
          id,
          `${winner ? 'Public' : 'Unpublished'} theme ${id}`,
          `Description ${id}`,
          offset,
          program,
        ],
      );
      await pool.query(
        "INSERT INTO games (id, title_world, year, time_to_beat) VALUES ($1, $2, '1995', 20)",
        [id, `Game ${id}`],
      );
      await pool.query(
        `INSERT INTO nominations VALUES ($1, $2, $3, $4, $5, 2, $5),
        ($6, $2, 'Shared relationship', false, 9000, 2, $5)`,
        [id * 10, program, `Nomination ${id}`, winner, id, id * 10 + 1],
      );
    }
  }
  await pool.query(`INSERT INTO nominations VALUES
    (99990, 'gotm', 'Orphan winner', true, 9000, 3, NULL),
    (99991, 'gotm', 'Missing theme', false, 9000, 3, 99999);
    INSERT INTO completions SELECT id, CURRENT_TIMESTAMP, id, 2, false FROM nominations;`);
}
