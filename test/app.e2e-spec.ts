import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('runs the focused compiled Fastify/PostgreSQL contracts', () => {
  // Use the native compiler's emitted decorator metadata, as in deployment.
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  const output = execFileSync(
    process.execPath,
    ['--test', 'test/api-contract.mjs'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    },
  );
  expect(output).toMatch(/# fail 0/);
  console.log(output);
}, 150000);
