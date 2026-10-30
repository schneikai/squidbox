import { readdirSync, readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';

// Node-side tests: the sync engine (pure logic + real-SQLite via better-sqlite3 + a two-device
// e2e against the server) and pure UI logic. These never touch React Native / expo-sqlite — the
// engine is dependency-injected (db + transport), which is what makes this possible.
//
// Most of a test file's time is importing the database layer, so files share their worker's module
// cache (threads, not isolated). A file that mocks a module (vi.mock) gets a fresh fork of its own,
// so its mocks never meet another file's imports. Each test starts with empty mock calls.
// Without a test database the e2e files aren't collected at all. The mocking scan reads only
// test/*.test.ts, which is where every file that mocks a module lives.
const testDir = new URL('./test/', import.meta.url);
const mocking = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => /\bvi\.(do)?mock\(/.test(readFileSync(new URL(file, testDir), 'utf8')));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: process.env.TEST_DATABASE_URL
      ? configDefaults.exclude
      : [...configDefaults.exclude, 'test/**/*.e2e.test.ts'],
    clearMocks: true,
    pool: 'threads',
    poolOptions: { threads: { isolate: false } },
    poolMatchGlobs: mocking.map((file) => [`**/test/${file}`, 'forks']),
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
