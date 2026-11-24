import { ConfigService } from '@nestjs/config';
import { createSecureContext } from 'node:tls';
import { X509Certificate } from 'node:crypto';

// Only this locally constructed error may cross the startup diagnostic boundary.
export class ConfigurationError extends Error {}

function invalid(key: string): never {
  throw new ConfigurationError(`Invalid configuration: ${key}`);
}
export function required(config: ConfigService, key: string): string {
  const value = config.get<unknown>(key);
  if (typeof value !== 'string' || !value.trim()) invalid(key);
  return value;
}
export function integer(
  config: ConfigService,
  key: string,
  fallback: number | undefined,
  max: number,
): number {
  const raw = config.get<unknown>(key);
  if (raw === undefined && fallback !== undefined) return fallback;
  if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) invalid(key);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) invalid(key);
  return value;
}
export function runtimeConfiguration(config: ConfigService) {
  const host = config.get<unknown>('HOST') ?? '127.0.0.1';
  if (typeof host !== 'string' || !/^[a-zA-Z0-9.:[\]_-]+$/.test(host))
    invalid('HOST');
  return {
    host,
    port: integer(config, 'PORT', 4000, 65535),
    shutdownMs: integer(config, 'SHUTDOWN_TIMEOUT_MS', 5000, 30000),
  };
}
export function databaseConfiguration(config: ConfigService) {
  // pg also consumes PGOPTIONS/PGREPLICATION/PGSSLNEGOTIATION, not just PGHOST.
  // Reject the ambient namespace rather than silently merging a second config.
  if (Object.keys(process.env).some((key) => key.startsWith('PG')))
    invalid('PG environment (use DB settings)');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    invalid('NODE_TLS_REJECT_UNAUTHORIZED');
  const host = required(config, 'DB_HOST');
  const port = integer(config, 'DB_PORT', undefined, 65535);
  const user = required(config, 'DB_USER');
  const password = required(config, 'DB_PASSWORD');
  const database = required(config, 'DB_NAME');
  const mode = required(config, 'DB_TLS_MODE');
  const ca = config.get<unknown>('DB_TLS_CA');
  if (mode !== 'verify' && mode !== 'disabled') invalid('DB_TLS_MODE');
  if (ca !== undefined) {
    if (mode !== 'verify' || typeof ca !== 'string' || !ca.trim())
      invalid('DB_TLS_CA');
    try {
      // OpenSSL silently ignores some malformed CA input: require PEM certificates.
      const certificates = ca.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      );
      if (
        !certificates?.length ||
        ca
          .replace(
            /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
            '',
          )
          .trim()
      )
        invalid('DB_TLS_CA');
      for (const certificate of certificates) new X509Certificate(certificate);
      createSecureContext({ ca });
    } catch {
      invalid('DB_TLS_CA');
    }
  }
  runtimeConfiguration(config);
  return {
    host,
    port,
    user,
    password,
    database,
    ssl:
      mode === 'disabled'
        ? (false as const)
        : {
            rejectUnauthorized: true,
            ...(ca === undefined ? {} : { ca: ca as string }),
          },
    max: integer(config, 'DB_POOL_MAX', 10, 50),
    connectionTimeoutMillis: integer(
      config,
      'DB_CONNECT_TIMEOUT_MS',
      1000,
      10000,
    ),
    idleTimeoutMillis: integer(config, 'DB_IDLE_TIMEOUT_MS', 10000, 60000),
    query_timeout: integer(config, 'DB_QUERY_TIMEOUT_MS', 3000, 30000),
    statement_timeout: integer(config, 'DB_STATEMENT_TIMEOUT_MS', 2000, 30000),
    application_name: 'gotx-public-api',
  };
}
