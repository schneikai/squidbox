#!/usr/bin/env node
/**
 * The project checks, quiet: every check runs, even after one fails; only a failed check's output
 * is printed, then one line per check with its time. Exits 1 if any failed.
 *
 *   npm run check       # what changed since the branch left main: committed, uncommitted, untracked
 *   npm run check:all   # the whole repo, knip too: before opening a PR or merging into main
 *
 * lint: eslint on apps/mobile (its config also enforces prettier there). format: prettier on the
 * code elsewhere, the files `npm run format` checks. typecheck: both apps (incremental, whole
 * projects). tests: per app, the test files that import a changed file (`vitest related`), or the
 * app's whole suite when its config, package, test helpers or setup changed, or a file was deleted.
 * A packages/shared change counts for both apps. No DB suites: README says when to run those.
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = `${ROOT}node_modules/.bin/`;
const MOBILE = 'apps/mobile/';
const APPS = [MOBILE, 'apps/server/'];
const SHARED = 'packages/shared/';
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
// The files `npm run format` checks (package.json): code outside apps/mobile.
const FORMATTED = /^(apps\/server|packages\/shared|scripts)\//;
// A change here runs the app's whole suite: what every test file depends on without importing it.
const WHOLE_SUITE = [
  /^package(-lock)?\.json$/,
  /^tsconfig\.base\.json$/,
  /^packages\/shared\/(package\.json|testing\/)/,
  /^apps\/[^/]+\/(package\.json|tsconfig[^/]*\.json|vitest\.config\.[cm]?[jt]s|test\/(helpers\/|setup\.ts|dbSetup\.ts))/,
];

const all = process.argv.includes('--all');
const colors = process.stdout.isTTY;
const paint = (code, text) => (colors ? `\x1b[${code}m${text}\x1b[0m` : text);

// git's output lines. A failing git command ends the run with git's error, unless it may fail.
function git(args, { mayFail = false } = {}) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status === 0) return result.stdout.split('\n').filter(Boolean);
  if (mayFail) return null;
  console.error(`git ${args.join(' ')} failed:\n${result.stderr || result.error}`);
  process.exit(1);
}

// What changed since the branch left main, and what of it was deleted.
function changes() {
  const mergeBase = (ref) => git(['merge-base', 'HEAD', ref], { mayFail: true })?.[0];
  const base = mergeBase('origin/main') ?? mergeBase('main');
  if (!base) console.warn(paint(33, 'No main branch to compare with: checking what changed since HEAD.'));
  const since = base ?? 'HEAD';
  const files = [
    ...git(['diff', '--name-only', '--diff-filter=d', since]),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
  return { files: [...new Set(files)], deleted: git(['diff', '--name-only', '--diff-filter=D', since]) };
}

// Runs a command with its output captured. Resolves to the check's result, never rejects.
function run(command, args, cwd = ROOT) {
  const started = Date.now();
  return new Promise((resolve) => {
    // Without Vite's notice that its CJS build is deprecated (the mobile vitest config loads as CJS).
    const env = { ...process.env, FORCE_COLOR: colors ? '1' : '0', VITE_CJS_IGNORE_WARNING: '1' };
    const child = spawn(command, args, { cwd, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', (error) => resolve({ ok: false, output: String(error), ms: Date.now() - started }));
    child.on('close', (code) => resolve({ ok: code === 0, output, ms: Date.now() - started }));
  });
}

// Runs the steps of one check after each other. It fails if any step does, and keeps only the
// failed steps' output.
async function steps(list) {
  const results = [];
  for (const [command, args, cwd] of list) results.push(await run(command, args, cwd));
  return {
    ok: results.every((result) => result.ok),
    output: results
      .filter((result) => !result.ok)
      .map((result) => result.output)
      .join(''),
    ms: results.reduce((sum, result) => sum + result.ms, 0),
  };
}

async function lintFiles(files) {
  const mobile = files.filter((file) => file.startsWith(MOBILE) && CODE.test(file));
  if (mobile.length === 0) return null;
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: `${ROOT}${MOBILE}` });
  const linted = [];
  for (const file of mobile)
    if (!(await eslint.isPathIgnored(`${ROOT}${file}`))) linted.push(file.slice(MOBILE.length));
  if (linted.length === 0) return null;
  const cache = ['--cache', '--cache-strategy', 'content', '--cache-location', 'node_modules/.cache/eslint/'];
  return [[`${BIN}eslint`, ['--max-warnings', '0', ...cache, ...linted], `${ROOT}${MOBILE}`]];
}

function formatFiles(files) {
  const formatted = files.filter((file) => FORMATTED.test(file) && CODE.test(file));
  return formatted.length === 0 ? null : [[`${BIN}prettier`, ['--check', ...formatted]]];
}

// An app's tests, printing only the failures.
const vitest = (app, args) => [
  `${BIN}vitest`,
  [...args, `--reporter=${ROOT}scripts/vitestFailures.mjs`],
  `${ROOT}${app}`,
];

// Per app: its whole suite, the test files related to its changed files, or nothing.
function testRuns({ files, deleted }) {
  const runs = [];
  for (const app of APPS) {
    const ours = (file) => file.startsWith(app) || file.startsWith(SHARED);
    const whole =
      files.some(
        (file) => WHOLE_SUITE.some((pattern) => pattern.test(file)) && (ours(file) || !file.startsWith('apps/')),
      ) || deleted.some(ours);
    const related = files.filter((file) => ours(file) && CODE.test(file)).map((file) => `${ROOT}${file}`);
    const name = app.slice('apps/'.length, -1);
    if (whole) runs.push({ name: `${name} all`, step: vitest(app, ['run']) });
    else if (related.length > 0)
      runs.push({ name: `${name} related`, step: vitest(app, ['related', '--run', '--passWithNoTests', ...related]) });
  }
  return runs;
}

// A root script, without npm's own lines (its banner, its "Lifecycle script failed" error).
const npmRun = (script) => ['npm', ['run', '--silent', script]];

// Each check's steps, or null when it has nothing to check. All checks run at once: measured faster
// than the tests after the rest, for one changed file and for the whole repo.
async function plan() {
  if (all)
    return {
      checks: {
        lint: [npmRun('lint')],
        format: [npmRun('format')],
        typecheck: [npmRun('typecheck')],
        knip: [npmRun('knip')],
      },
      // `npm test --workspaces --if-present`, app by app: the apps are the workspaces with tests.
      tests: { steps: APPS.map((app) => vitest(app, ['run'])) },
    };
  const changed = changes();
  const runs = testRuns(changed);
  return {
    checks: {
      lint: await lintFiles(changed.files),
      format: formatFiles(changed.files),
      typecheck: [npmRun('typecheck')],
      knip: null,
    },
    tests: runs.length === 0 ? null : { steps: runs.map((r) => r.step), note: runs.map((r) => r.name).join(', ') },
  };
}

const { checks, tests } = await plan();
const results = new Map([...Object.keys(checks), 'tests'].map((name) => [name, null]));
await Promise.all([
  ...Object.entries(checks).map(async ([name, list]) => results.set(name, list ? await steps(list) : null)),
  (async () => results.set('tests', tests ? { ...(await steps(tests.steps)), note: tests.note } : null))(),
]);

let failed = false;
for (const [name, result] of results)
  if (result && !result.ok) {
    failed = true;
    console.log(paint(1, `\n── ${name} ──`));
    console.log(result.output.trimEnd());
  }
console.log('');
for (const [name, result] of results) {
  if (!result) console.log(paint(2, `– ${name} skipped`));
  else {
    const line = `${name} ${(result.ms / 1000).toFixed(1)}s${result.note ? ` (${result.note})` : ''}`;
    console.log(result.ok ? paint(32, `✓ ${line}`) : paint(31, `✗ ${line}`));
  }
}
process.exit(failed ? 1 : 0);
