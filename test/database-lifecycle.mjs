import assert from 'node:assert/strict';
import { it } from 'node:test';
import { startTestContext, remainingContainer } from './synthetic-postgres.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

void it('enforces SELECT-only privileges, server bounds, outage recovery and shutdown admission', async () => {
  const context = await startTestContext();
  try {
    // Arrange: healthy application-role reads precede negative capabilities.
    await context.pool.query(
      `INSERT INTO games(id,title_world) VALUES (1,'synthetic'); CREATE SEQUENCE private_sequence;`,
    );
    assert.equal(
      (await context.database.query('SELECT title_world FROM games')).rows[0]
        .title_world,
      'synthetic',
    );
    const client = await context.applicationPool.connect();
    try {
      await client.query('SET default_transaction_read_only = off');
      for (const sql of [
        'INSERT INTO games(id) VALUES (2)',
        "UPDATE games SET title_world='changed'",
        'DELETE FROM games',
        'TRUNCATE games',
        'CREATE TABLE public.denied(id int)',
        'ALTER TABLE games ADD COLUMN denied int',
        'DROP TABLE games',
        'CREATE TEMP TABLE denied(id int)',
        "SELECT nextval('private_sequence')",
        "SELECT setval('private_sequence',99)",
        'CREATE SCHEMA denied',
      ]) {
        await assert.rejects(
          client.query(sql),
          (error) => error.code === '42501',
          sql,
        );
      }
      const role = (
        await client.query(
          `SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user`,
        )
      ).rows[0];
      assert.ok(Object.values(role).every((value) => value === false));
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)`,
          )
        ).rows[0].n,
        0,
      );
      const capabilities = (
        await client.query(`SELECT has_database_privilege(current_database(),'CREATE') AS create_db,
        has_database_privilege(current_database(),'TEMP') AS temp,
        has_schema_privilege('public','CREATE') AS create_schema`)
      ).rows[0];
      assert.ok(Object.values(capabilities).every((value) => value === false));
      const relations = (
        await client.query(`SELECT c.relname,
        has_table_privilege(c.oid,'SELECT') AS readable,
        has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS elevated,
        c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r'`)
      ).rows;
      assert.equal(relations.length, 5);
      assert.ok(
        relations.every(
          (relation) =>
            relation.readable && !relation.elevated && !relation.owned,
        ),
      );
      // No user functions/views; built-in PUBLIC functions still exist, not blanket function safety.
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await client.query(
            `SELECT count(*)::int AS n FROM pg_views WHERE schemaname='public'`,
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await client.query(
            `SELECT has_function_privilege('pg_catalog.lower(text)','EXECUTE') AS allowed`,
          )
        ).rows[0].allowed,
        true,
      );
    } finally {
      client.release();
    }
    // Act/assert: server cancellation, then recovery of this same pool.
    const started = Date.now();
    await assert.rejects(
      context.database.query('SELECT pg_sleep(2)'),
      (error) => error.code === '57014',
    );
    assert.ok(Date.now() - started < 1500);
    assert.equal(await context.database.ready(), true);
    // Owned-fixture-only outage, restored before teardown.
    await context.pool.query('ALTER ROLE api_reader NOLOGIN');
    await context.pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='api_reader'`,
    );
    const unavailable = await context.app.inject({
      method: 'GET',
      url: '/health/ready',
    });
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.json(), { status: 'unavailable' });
    assert.deepEqual((await context.request('{ healthCheck }')).data, {
      healthCheck: 'unavailable',
    });
    assert.equal(
      (await context.app.inject({ method: 'GET', url: '/health/live' }))
        .statusCode,
      200,
    );
    await context.pool.query('ALTER ROLE api_reader LOGIN');
    assert.equal(await context.database.ready(), true);
    context.database.stopAdmission();
    assert.equal(
      (await context.app.inject({ method: 'GET', url: '/health/ready' }))
        .statusCode,
      503,
    );
  } finally {
    await context.pool.query('ALTER ROLE api_reader LOGIN');
    await context.close();
    assert.equal(remainingContainer(context.containerId), '');
  }
});

void it('retains server cancellation when client timeout occurs first', async () => {
  const context = await startTestContext({
    configuration: {
      DB_QUERY_TIMEOUT_MS: '100',
      DB_STATEMENT_TIMEOUT_MS: '400',
    },
  });
  try {
    await assert.rejects(
      context.database.query('SELECT pg_sleep(5)'),
      /Query read timeout/,
    );
    await delay(500);
    assert.equal(
      (
        await context.pool.query(
          `SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='api_reader' AND state='active'`,
        )
      ).rows[0].n,
      0,
    );
    assert.equal(await context.database.ready(), true);
  } finally {
    await context.close();
  }
});

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

void it('runs compiled production through readiness, SIGTERM and partial startup failure', async () => {
  const context = await startTestContext();
  let child;
  try {
    await context.app.close();
    const port = await unusedPort();
    const env = {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      ...context.values,
      PORT: String(port),
      HOST: '127.0.0.1',
      SHUTDOWN_TIMEOUT_MS: '2000',
    };
    let output = '';
    child = spawn(process.execPath, ['dist/main.js'], {
      env,
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    const exited = once(child, 'exit');
    // Bounded explicit ready barrier, not a blind startup sleep.
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(child.exitCode, null, output);
      try {
        ready =
          (await fetch(`http://127.0.0.1:${port}/health/ready`)).status === 200;
      } catch {}
      if (ready) break;
      await delay(50);
    }
    assert.equal(ready, true, output);
    assert.equal(
      (
        await context.pool.query(
          `SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='api_reader'`,
        )
      ).rows[0].n,
      1,
    );
    child.kill('SIGTERM');
    let timer;
    const result = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Shutdown did not exit')),
          4000,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    // Nest re-emits the handled signal after releasing resources.
    assert.deepEqual(result, [null, 'SIGTERM']);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/health/live`));
    assert.equal(
      (
        await context.pool.query(
          `SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='api_reader'`,
        )
      ).rows[0].n,
      0,
    );

    // Actual production package script, invalid configuration: safe failure, correct emitted path.
    try {
      execFileSync('npm', ['run', 'start:prod'], {
        env: { ...env, DB_PASSWORD: '' },
        encoding: 'utf8',
        timeout: 10000,
        stdio: 'pipe',
      });
      assert.fail('Invalid startup must fail');
    } catch (error) {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /Service startup failed/);
      assert.doesNotMatch(
        error.stderr,
        /synthetic-trust-only|api_reader|api_test|ERR_MODULE_NOT_FOUND/,
      );
    }
    // Actionable configuration key only; never raw CA contents/driver messages.
    assert.throws(
      () =>
        execFileSync(process.execPath, ['dist/main.js'], {
          env: {
            ...env,
            DB_TLS_MODE: 'verify',
            DB_TLS_CA: 'synthetic-invalid-ca',
          },
          timeout: 10000,
          stdio: 'pipe',
        }),
      (error) =>
        error.status === 1 &&
        /Invalid configuration: DB_TLS_CA/.test(error.stderr.toString()) &&
        !/synthetic-invalid-ca/.test(error.stderr.toString()),
    );
    // Synthetic env-file trap in an owned cwd: a missing required password may
    // not be filled from .env.production. Never read any real local env file.
    const directory = await mkdtemp(resolve('.local/production-env-fixture-'));
    try {
      await writeFile(
        join(directory, '.env.production'),
        'DB_PASSWORD=synthetic-file-only\n',
      );
      const { DB_PASSWORD: _password, ...missingPassword } = env;
      assert.throws(
        () =>
          execFileSync(process.execPath, [resolve('dist/main.js')], {
            cwd: directory,
            env: missingPassword,
            timeout: 10000,
            stdio: 'pipe',
          }),
        (error) =>
          error.status === 1 &&
          /Service startup failed/.test(error.stderr.toString()),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    // EADDRINUSE after pool initialization: owned blocker preserved, app cleaned up.
    const blocker = createServer();
    blocker.listen(port, '127.0.0.1');
    await once(blocker, 'listening');
    try {
      const failed = spawn(process.execPath, ['dist/main.js'], {
        env,
        timeout: 6000,
        stdio: 'ignore',
      });
      assert.deepEqual(await once(failed, 'exit'), [1, null]);
      assert.equal(
        (
          await context.pool.query(
            `SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='api_reader'`,
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    await context.close();
    assert.equal(remainingContainer(context.containerId), '');
  }
});
