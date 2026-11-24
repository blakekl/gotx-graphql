import { execFileSync } from 'node:child_process';
import { it } from 'vitest';

it('runs the focused compiled Fastify/PostgreSQL contracts', () => {
  // Inherit output so CI retains native assertion diagnostics even on failure.
  // execFileSync still throws on a nonzero exit; no assertions are bypassed.
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  execFileSync(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      'test/api-contract.mjs',
      'test/lifecycle.mjs',
      'test/database-lifecycle.mjs',
    ],
    { stdio: 'inherit', timeout: 120000 },
  );
}, 150000);
