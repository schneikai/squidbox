import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// The device runs the migrations `migrations.js` imports (sync-design §8), the tests the `.sql` files
// the journal lists. `drizzle-kit generate` writes both; a migration added by hand leaves the device
// short of one with every test green, and the new column fails on every device.
const dir = new URL('../src/sync/db/migrations/', import.meta.url);
const manifest = readFileSync(new URL('migrations.js', dir), 'utf8');
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', dir), 'utf8')) as {
  entries: { idx: number; tag: string }[];
};

it('the device migration manifest lists exactly the journal entries, in order', () => {
  const imported = [...manifest.matchAll(/^import m(\d+) from '\.\/(.+)\.sql';$/gm)].map(([, idx, tag]) => ({
    idx: Number(idx),
    tag,
  }));
  const listed = [...manifest.matchAll(/^\s*m(\d+),?$/gm)].map(([, idx]) => Number(idx));
  expect(imported).toEqual(journal.entries.map(({ idx, tag }) => ({ idx, tag })));
  expect(listed).toEqual(journal.entries.map(({ idx }) => idx));
});
