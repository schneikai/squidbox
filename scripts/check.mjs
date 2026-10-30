#!/usr/bin/env node
/**
 * The project checks, quiet: every check runs, even after one fails; only a failed check's output
 * is printed, then one line per check with its time. Exits 1 if any failed.
 *
 *   npm run check       # what changed since the branch left main: committed, uncommitted, untracked
 *   npm run check:all   # the whole repo, knip too: before opening a PR or merging into main
 *   npm run format      # (node scripts/check.mjs --format) prettier over FORMAT_ROOTS, as CI runs it
 *
 * lint: eslint on apps/mobile (`lint:files` there; its config also enforces prettier). format:
 * prettier on the code in FORMAT_ROOTS. Either runs over the whole repo when its config or the
 * packages changed. typecheck: `npm run typecheck`, whole projects, incremental: the server, and in
 * the mobile app only src/sync and src/library (tsconfig.synccheck.json). tests: per app, the test
 * files whose imports reach a changed file, in any app (`vitest related`), or the app's whole suite
 * when its config, package, test helpers or setup, or the files its tests read from disk changed,
 * or a file was deleted or moved. A packages/shared change counts for both apps. No DB suites:
 * README says when to run those.
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = `${ROOT}node_modules/.bin/`;
const MOBILE = 'apps/mobile/';
const APPS = [MOBILE, 'apps/server/'];
const SHARED = 'packages/shared/';
const CODE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
const CODE = new RegExp(`\\.(${CODE_EXTENSIONS.join('|')})$`);
// Where prettier checks the code (apps/mobile's eslint checks its own).
const FORMAT_ROOTS = ['apps/server', 'packages/shared', 'scripts'];
const FORMAT_GLOB = `{${FORMAT_ROOTS.join(',')}}/**/*.{${CODE_EXTENSIONS.join(',')}}`;
const FORMATTED = (file) => FORMAT_ROOTS.some((root) => file.startsWith(`${root}/`)) && CODE.test(file);
const PACKAGES = /^(apps\/mobile\/)?package(-lock)?\.json$/;
// A change here lints or formats the whole repo: the tool's config, its version, its file list.
const LINT_EVERYTHING = [PACKAGES, /^apps\/mobile\/\.eslint(rc\.js|ignore)$/];
const FORMAT_EVERYTHING = [/^package(-lock)?\.json$/, /^\.prettier(rc|ignore)/, /^scripts\/check\.mjs$/];
// A change here runs the app's whole suite: what every test file depends on without importing it,
// and the files tests read from disk (the mobile migrations, through drizzle's readMigrationFiles).
const WHOLE_SUITE = [
  /^package(-lock)?\.json$/,
  /^tsconfig\.base\.json$/,
  /^packages\/shared\/(package\.json|testing\/)/,
  /^apps\/[^/]+\/(package\.json|tsconfig[^/]*\.json|vitest\.config\.[cm]?[jt]s|test\/(helpers\/|setup\.ts|dbSetup\.ts))/,
  /^apps\/mobile\/src\/sync\/db\/migrations\//,
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

// What changed since the branch left main, and what of it was deleted. A moved file counts as
// deleted and added.
function changes() {
  const mergeBase = (ref) => git(['merge-base', 'HEAD', ref], { mayFail: true })?.[0];
  const base = mergeBase('origin/main') ?? mergeBase('main');
  if (!base) console.warn(paint(33, 'No main branch to compare with: checking what changed since HEAD.'));
  const since = base ?? 'HEAD';
  const files = [
    ...git(['diff', '--name-only', '--no-renames', '--diff-filter=d', since]),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
  return {
    files: [...new Set(files)],
    deleted: git(['diff', '--name-only', '--no-renames', '--diff-filter=D', since]),
  };
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

async function lint(files) {
  if (files.some((file) => LINT_EVERYTHING.some((pattern) => pattern.test(file))))
    return { steps: [npmRun('lint')], note: 'all files: its config or packages changed' };
  const mobile = files.filter((file) => file.startsWith(MOBILE) && CODE.test(file));
  if (mobile.length === 0) return null;
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: `${ROOT}${MOBILE}` });
  const linted = [];
  for (const file of mobile)
    if (!(await eslint.isPathIgnored(`${ROOT}${file}`))) linted.push(file.slice(MOBILE.length));
  if (linted.length === 0) return null;
  return { steps: [['npm', ['run', '--silent', '-w', MOBILE.slice(0, -1), 'lint:files', '--', ...linted]]] };
}

function format(files) {
  if (files.some((file) => FORMAT_EVERYTHING.some((pattern) => pattern.test(file))))
    return { steps: [prettier([FORMAT_GLOB])], note: 'all files: its config or packages changed' };
  const formatted = files.filter(FORMATTED);
  return formatted.length === 0 ? null : { steps: [prettier(formatted)] };
}

// An app's tests, printing only the failures.
const vitest = (app, args) => [
  `${BIN}vitest`,
  [...args, `--reporter=${ROOT}scripts/vitestFailures.mjs`],
  `${ROOT}${app}`,
];

// Per app: its whole suite, the test files whose imports reach a changed file in any app or package
// (the mobile tests import server code; JSON and .sql files are imports too), or nothing.
function testRuns({ files, deleted }) {
  const runs = [];
  for (const app of APPS) {
    const ours = (file) => file.startsWith(app) || file.startsWith(SHARED);
    const whole =
      files.some(
        (file) => WHOLE_SUITE.some((pattern) => pattern.test(file)) && (ours(file) || !file.startsWith('apps/')),
      ) || deleted.some(ours);
    const related = files.filter((file) => /^(apps|packages)\//.test(file)).map((file) => `${ROOT}${file}`);
    const name = app.slice('apps/'.length, -1);
    if (whole) runs.push({ name: `${name} all`, step: vitest(app, ['run']) });
    else if (related.length > 0)
      runs.push({ name: `${name} related`, step: vitest(app, ['related', '--run', '--passWithNoTests', ...related]) });
  }
  return runs;
}

// A root script, without npm's own lines (its banner, its "Lifecycle script failed" error).
const npmRun = (script) => ['npm', ['run', '--silent', script]];
const prettier = (files) => [`${BIN}prettier`, ['--check', ...files]];

if (process.argv.includes('--format')) {
  const [command, args] = prettier([FORMAT_GLOB]);
  process.exit(spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1);
}

// Each check's steps, or null when it has nothing to check. All checks run at once: measured faster
// than the tests after the rest, for one changed file and for the whole repo.
async function plan() {
  if (all)
    return {
      checks: {
        lint: { steps: [npmRun('lint')] },
        format: { steps: [prettier([FORMAT_GLOB])] },
        typecheck: { steps: [npmRun('typecheck')] },
        knip: { steps: [npmRun('knip')] },
      },
      // `npm test --workspaces --if-present`, app by app: the apps are the workspaces with tests.
      tests: { steps: APPS.map((app) => vitest(app, ['run'])) },
    };
  const changed = changes();
  const runs = testRuns(changed);
  return {
    checks: {
      lint: await lint(changed.files),
      format: format(changed.files),
      typecheck: { steps: [npmRun('typecheck')] },
      knip: null,
    },
    tests: runs.length === 0 ? null : { steps: runs.map((r) => r.step), note: runs.map((r) => r.name).join(', ') },
  };
}

const { checks, tests } = await plan();
const results = new Map([...Object.keys(checks), 'tests'].map((name) => [name, null]));
await Promise.all(
  Object.entries({ ...checks, tests }).map(async ([name, check]) =>
    results.set(name, check ? { ...(await steps(check.steps)), note: check.note } : null),
  ),
);

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
