#!/usr/bin/env node
/**
 * New code in apps/mobile/src is TypeScript (CLAUDE.md → Code layout): fails on a .js or .jsx file added
 * since the branch left main, committed or not. A moved or renamed file isn't new. The generated
 * migrations.js (drizzle-kit writes it) is the one exception. Run by `npm run check` and CI.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = 'apps/mobile/src/';
const GENERATED = new Set([`${SRC}sync/db/migrations/migrations.js`]);

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').filter(Boolean) : null;
}

const base = (git(['merge-base', 'HEAD', 'origin/main']) ?? git(['merge-base', 'HEAD', 'main']))?.[0];
if (!base) {
  console.warn('No main branch to compare with: no files checked.');
  process.exit(0);
}
const added = [
  ...(git(['diff', '--name-only', '--diff-filter=A', '-M', base, '--', SRC]) ?? []),
  ...(git(['ls-files', '--others', '--exclude-standard', '--', SRC]) ?? []),
];
const newJs = [...new Set(added)].filter((file) => /\.jsx?$/.test(file) && !GENERATED.has(file));
if (newJs.length > 0) {
  console.error(`New code in ${SRC} is TypeScript (.ts/.tsx). Added since main:`);
  for (const file of newJs) console.error(`  ${file}`);
  process.exit(1);
}
