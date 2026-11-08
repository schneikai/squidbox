#!/usr/bin/env node
/**
 * The app's code is TypeScript (CLAUDE.md → Code layout): fails on any .js or .jsx file in
 * apps/mobile/src that git tracks or would add (not ignored), whether added, renamed or copied.
 * The generated migrations.js (drizzle-kit writes it) is the one exception. Run by `npm run check`
 * and CI.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = 'apps/mobile/src/';
const GENERATED = new Set([`${SRC}sync/db/migrations/migrations.js`]);

const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', SRC], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (result.status !== 0) {
  console.error(result.stderr || 'git ls-files failed');
  process.exit(1);
}
// A file deleted in the working tree but still in the index isn't there any more.
const deleted = new Set(
  spawnSync('git', ['ls-files', '--deleted', '--', SRC], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n'),
);
const js = [...new Set(result.stdout.split('\n'))].filter(
  (file) => /\.jsx?$/.test(file) && !GENERATED.has(file) && !deleted.has(file),
);
if (js.length > 0) {
  console.error(`The app's code in ${SRC} is TypeScript (.ts/.tsx). JavaScript found:`);
  for (const file of js) console.error(`  ${file}`);
  process.exit(1);
}
