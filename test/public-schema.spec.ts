import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('builds the real executable schema and enforces the public member allowlist', () => {
  // Native compiler emits the decorator metadata used in the deployed application.
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  const output = execFileSync(process.execPath, ['test/public-schema.mjs'], {
    encoding: 'utf8',
  });
  expect(output).toContain('Executable schema allowlist PASS');
}, 30000);
