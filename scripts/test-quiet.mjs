// Runs `ng test` once with plain output for agents and logs: no colour codes,
// the dots reporter (failures and a summary only), no watch.
// Usage: node scripts/test-quiet.mjs [spec path ...]
import { spawnSync } from 'node:child_process';

const specs = process.argv.slice(2).flatMap((spec) => ['--include', spec]);
const { status } = spawnSync('npx', ['ng', 'test', '--watch=false', '--reporters=dot', ...specs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
});
process.exit(status ?? 1);
