import { execFileSync, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('serves all 29 GraphQL roots through real Fastify and isolated PostgreSQL', () => {
  // Use the native compiler's emitted decorator metadata, as in deployment.
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  const output = execFileSync(process.execPath, ['test/api-contract.mjs'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  expect(output).toContain(
    'Fastify/Postgres contracts PASS: 29 explicit roots',
  );
  expect(output).toContain('Cleanup PASS');
  console.log(output);
}, 60000);

for (const mode of ['assertion', 'fixture-setup']) {
  it(`cleans acquired resources after escaping ${mode} failure`, () => {
    execFileSync('npm', ['run', 'build'], { stdio: 'pipe', timeout: 30000 });
    const child = spawnSync(process.execPath, ['test/api-contract.mjs', mode], {
      encoding: 'utf8',
      timeout: 45000,
    });
    // Independent inspection, even when the child timed out or failed to import.
    const remaining = execFileSync(
      'docker',
      [
        'ps',
        '-a',
        '--filter',
        'name=^/gotx-02-synthetic$',
        '--format',
        '{{.Names}}',
      ],
      { encoding: 'utf8', timeout: 10000 },
    ).trim();
    expect(remaining).toBe('');
    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(1);
    expect(child.stderr).toContain(`BV01_${mode}_SENTINEL`);
    expect(child.stderr).toContain('AssertionError');
    const events = child.stdout
      .split('\n')
      .filter((line) => line.startsWith('BV01 '))
      .map((line) => line.slice(5));
    expect(events).toEqual(
      mode === 'assertion'
        ? [
            'container-acquired',
            'fixture-pool-connected',
            'app-pool-connected',
            'app-ready-no-listener',
            'assertion-sentinel',
            'app-pool-ended',
            'app-closed-no-listener',
            'fixture-pool-ended',
            'container-stopped',
          ]
        : [
            'container-acquired',
            'fixture-pool-connected',
            'fixture-setup-sentinel',
            'fixture-pool-ended',
            'container-stopped',
          ],
    );
    expect(child.stdout).not.toContain('SQL_ERROR');
    expect(child.stdout).not.toContain('Fastify/Postgres contracts PASS');
    console.log(
      child.stdout,
      `Independent container absence PASS: ${mode}; child exit ${child.status}`,
    );
  }, 90000);
}
