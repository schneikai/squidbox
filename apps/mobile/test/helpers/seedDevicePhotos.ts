import type { prng } from './prng';
import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { upsertRows } from '../../src/sync/upsertRows';

/**
 * The seeded merge fuzz runs' device library (mergeRun.test.ts, mergeRunFailures.test.ts): five
 * photos of camera-roll items m0..m5 (`addPhoto` makes each), now and then with the file name of an
 * earlier one (two records can share one file name), a favorite, a note; now and then one an earlier
 * library copied into the `account` library and pushed, whose backup there found no file.
 * `errorsGoneTooSoon(at)` lists those that lost that sync error before their file reached the account.
 */
export async function seedDevicePhotos(
  rand: ReturnType<typeof prng>,
  addPhoto: (over: Record<string, unknown>) => Promise<unknown>,
  account: () => SyncDb,
  hasAccountFile: (filename: string) => boolean,
) {
  const r = rand.next;
  const media = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];
  const missingFile = new Set<string>();
  const photos: schema.AssetRow[] = [];
  for (let i = 0; i < 5; i++) {
    const name = i > 0 && r() < 0.2 ? `dev${Math.floor(r() * i)}` : `dev${i}`;
    const photo = (await addPhoto({
      ...{ mediaLibraryAssetId: rand.pick(media), filename: `${name}.jpg`, thumbnailFilename: `${name}-t.jpg` },
      ...{ isFavorite: r() < 0.3, notes: r() < 0.3 ? `dev note ${i}` : null },
    })) as schema.AssetRow;
    photos.push(photo);
    if (r() < 0.2) {
      await upsertRows(account(), 'assets', schema.assets, [{ ...photo, syncError: 'No file on this device' }]);
      missingFile.add(photo.id);
    }
  }
  const errorsGoneTooSoon = async (at: string): Promise<string[]> =>
    (await account().select().from(schema.assets))
      .filter((row) => missingFile.has(row.id) && row.syncError === null && !hasAccountFile(row.filename))
      .map((row) => `${at}: ${row.filename} lost its sync error before its file arrived`);
  return { photos, errorsGoneTooSoon };
}
