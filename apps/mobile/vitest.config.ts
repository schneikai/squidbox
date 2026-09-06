import { defineConfig } from 'vitest/config';

// Node-side tests for the sync engine (pure logic + real-SQLite via better-sqlite3 + a
// two-device e2e against the server). These never touch React Native / expo-sqlite — the
// engine is dependency-injected (db + transport), which is what makes this possible.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
