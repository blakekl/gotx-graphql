import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service.js';
import { rootCertificates } from 'node:tls';
import {
  databaseConfiguration,
  runtimeConfiguration,
} from './configuration.js';

const valid = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '5433',
  DB_USER: 'synthetic',
  DB_PASSWORD: 'synthetic',
  DB_NAME: 'synthetic',
  DB_TLS_MODE: 'disabled',
};
function service(values: Record<string, string | undefined>) {
  return new DatabaseService(new ConfigService(values));
}

describe('database configuration boundary', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('rejects ambient pg options instead of implicitly applying them', () => {
    vi.stubEnv('PGOPTIONS', '-c statement_timeout=0');
    expect(() => databaseConfiguration(new ConfigService(valid))).toThrow(
      'Invalid configuration: PG environment (use DB settings)',
    );
  });
  it('rejects a global TLS verification bypass', () => {
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0');
    expect(() =>
      databaseConfiguration(
        new ConfigService({ ...valid, DB_TLS_MODE: 'verify' }),
      ),
    ).toThrow('Invalid configuration: NODE_TLS_REJECT_UNAUTHORIZED');
  });
  it.each([
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'DB_TLS_MODE',
  ])('rejects missing %s before opening a pool', (key) => {
    const database = service({ ...valid, [key]: undefined });
    expect(() => database.onModuleInit()).toThrow(/Invalid configuration/);
  });
  it.each(['0', '-1', '1.5', 'Infinity', '65536', '12junk'])(
    'rejects malformed port %s',
    (port) => {
      expect(() =>
        service({ ...valid, DB_PORT: port }).onModuleInit(),
      ).toThrow();
    },
  );
  it('constructs explicit bounded pool options', async () => {
    const database = service(valid);
    database.onModuleInit();
    const options = (
      database as unknown as { pool: { options: Record<string, unknown> } }
    ).pool.options;
    expect(options).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 10000,
      query_timeout: 3000,
      statement_timeout: 2000,
      ssl: false,
    });
    await database.onModuleDestroy();
  });
  it('rejects contradictory TLS configuration without echoing values', () => {
    expect(() =>
      service({ ...valid, DB_TLS_CA: 'private sentinel' }).onModuleInit(),
    ).toThrow('Invalid configuration: DB_TLS_CA');
  });
  it('uses verified TLS with system trust', async () => {
    const database = service({ ...valid, DB_TLS_MODE: 'verify' });
    database.onModuleInit();
    expect(
      (database as unknown as { pool: { options: { ssl: unknown } } }).pool
        .options.ssl,
    ).toEqual({ rejectUnauthorized: true });
    await database.onModuleDestroy();
  });
  it('constructs verified custom CA options without claiming a handshake', () => {
    const ca = rootCertificates[0];
    expect(
      databaseConfiguration(
        new ConfigService({ ...valid, DB_TLS_MODE: 'verify', DB_TLS_CA: ca }),
      ).ssl,
    ).toEqual({ rejectUnauthorized: true, ca });
  });
  it.each([
    'DB_POOL_MAX',
    'DB_CONNECT_TIMEOUT_MS',
    'DB_IDLE_TIMEOUT_MS',
    'DB_QUERY_TIMEOUT_MS',
    'DB_STATEMENT_TIMEOUT_MS',
    'SHUTDOWN_TIMEOUT_MS',
    'PORT',
  ])('rejects invalid bounded %s', (key) => {
    for (const value of [
      '',
      ' ',
      '0',
      '-1',
      '1.5',
      'NaN',
      'Infinity',
      '99999999',
    ]) {
      expect(() =>
        databaseConfiguration(new ConfigService({ ...valid, [key]: value })),
      ).toThrow();
    }
  });
  it('rejects whitespace, unknown TLS, malformed CA and listener host', () => {
    for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
      expect(() =>
        databaseConfiguration(new ConfigService({ ...valid, [key]: '  ' })),
      ).toThrow();
    }
    expect(() =>
      databaseConfiguration(
        new ConfigService({ ...valid, DB_TLS_MODE: 'prefer' }),
      ),
    ).toThrow();
    expect(() =>
      databaseConfiguration(
        new ConfigService({
          ...valid,
          DB_TLS_MODE: 'verify',
          DB_TLS_CA: 'not a certificate',
        }),
      ),
    ).toThrow('Invalid configuration: DB_TLS_CA');
    expect(() =>
      runtimeConfiguration(new ConfigService({ HOST: ' ' })),
    ).toThrow();
  });
  it('closes once and refuses later admission, including partial initialization', async () => {
    const database = service(valid);
    database.onModuleInit();
    const first = database.onModuleDestroy();
    expect(database.onModuleDestroy()).toBe(first);
    await first;
    expect(await database.ready()).toBe(false);
    await expect(database.query('SELECT 1')).rejects.toThrow(
      'Database unavailable',
    );
    await service(valid).onModuleDestroy();
  });
});
