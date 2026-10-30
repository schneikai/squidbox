import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';

// Without saved file timings (CI has none, and vitest 2.1.9 never reads its own back) vitest starts
// the largest files first. The database tests wait on Postgres the longest, whatever their size:
// in a DB run, start them first, so the run doesn't end on one of them alone.
class DatabaseFirst extends BaseSequencer {
  async sort(files: Parameters<BaseSequencer['sort']>[0]) {
    const sorted = await super.sort(files);
    const usesDb = (spec: (typeof sorted)[number]) => readFileSync(spec.moduleId, 'utf8').includes('TEST_DATABASE_URL');
    return [...sorted.filter(usesDb), ...sorted.filter((spec) => !usesDb(spec))];
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    setupFiles: ['./test/setup.ts'],
    // DB runs only: what the database tests share, set up once (test/dbSetup.ts).
    globalSetup: process.env.TEST_DATABASE_URL ? ['./test/dbSetup.ts'] : [],
    include: ['test/**/*.test.ts'],
    sequence: process.env.TEST_DATABASE_URL ? { sequencer: DatabaseFirst } : {},
  },
});
