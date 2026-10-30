import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deferred } from './helpers/deferred';
import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import tagAssetAsync from '../src/features/photo-tags/tagAssetAsync';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { readByIds } from '../src/sync/readByIds';
import { requestSync } from '../src/sync/worker';
import readVisionImageAsync from '../src/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '../src/utils/cloud-api/ai/tagPhotoAsync';

// The library's database is a test one; reading the thumbnail, the server's tagging and the sync
// are stubs.
const current = vi.hoisted(() => ({ db: null as AppDb | null }));
vi.mock('../src/sync/db/client', () => ({ getDb: () => current.db }));
vi.mock('../src/sync/worker', () => ({ requestSync: vi.fn() }));
vi.mock('../src/utils/assets/readVisionImageAsync', () => ({ default: vi.fn() }));
vi.mock('../src/utils/cloud-api/ai/tagPhotoAsync', () => ({ default: vi.fn() }));

const deps = { library: {}, isAuthenticated: true, preloadAssetThumbnailsAsync: vi.fn() };
const image = { base64: 'AAAA', mimeType: 'image/jpeg' };

async function tagsOf(id: string) {
  const [row] = await readByIds(current.db!, schema.assets, [id]);
  return row.tags;
}

beforeEach(() => {
  current.db = makeTestDb();
  vi.mocked(readVisionImageAsync).mockResolvedValue(image);
  vi.mocked(tagPhotoAsync).mockResolvedValue(['forest', 'morning fog']);
});

describe('tagAssetAsync', () => {
  it("sends the photo's thumbnail, stores the tags on the asset and asks for a sync", async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1' })]);
    expect(await tagAssetAsync(asset!, deps)).toEqual(['forest', 'morning fog']);

    expect(vi.mocked(readVisionImageAsync)).toHaveBeenCalledWith(asset, deps);
    expect(vi.mocked(tagPhotoAsync)).toHaveBeenCalledWith(image);
    expect(await tagsOf('a1')).toEqual(['forest', 'morning fog']);
    expect(vi.mocked(requestSync)).toHaveBeenCalledTimes(1);
  });

  it('replaces the tags the asset had and resolves to the stored list', async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1', tags: ['old'] })]);
    vi.mocked(tagPhotoAsync).mockResolvedValueOnce([' Trail ', 'trail', 'backpack']);
    const tags = await tagAssetAsync(asset!, deps);

    expect(tags).toEqual(['Trail', 'backpack']);
    expect(await tagsOf('a1')).toEqual(tags);
  });

  it('rejects with why and stores nothing when the tagging fails', async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1' })]);
    vi.mocked(readVisionImageAsync).mockRejectedValueOnce(new Error('This photo is only on another device'));
    await expect(tagAssetAsync(asset!, deps)).rejects.toThrow('This photo is only on another device');

    expect(vi.mocked(tagPhotoAsync)).not.toHaveBeenCalled();
    expect(await tagsOf('a1')).toBeNull();
  });

  it('fails and stores nothing when the photo was deleted while it was being tagged', async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1' })]);
    const called = deferred();
    const reply = deferred<string[]>();
    vi.mocked(tagPhotoAsync).mockImplementationOnce(() => {
      called.resolve();
      return reply.promise;
    });
    const tagging = tagAssetAsync(asset!, deps);
    await called.promise;
    await repo.remove(current.db!, ['a1']);
    reply.resolve(['creek']);

    await expect(tagging).rejects.toThrow('This photo was deleted');
    expect(await tagsOf('a1')).toBeNull();
    expect(vi.mocked(requestSync)).not.toHaveBeenCalled();
  });

  it('sends a photo once for two callers at the same time, and both get its tags', async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1' })]);
    const reply = deferred<string[]>();
    vi.mocked(tagPhotoAsync).mockReturnValueOnce(reply.promise);
    const both = Promise.all([tagAssetAsync(asset!, deps), tagAssetAsync(asset!, deps)]);
    reply.resolve(['creek']);

    expect(await both).toEqual([['creek'], ['creek']]);
    expect(vi.mocked(tagPhotoAsync)).toHaveBeenCalledTimes(1);
    expect(await tagsOf('a1')).toEqual(['creek']);
  });

  it('sends the photo again once the tagging before has ended, failed or not', async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'a1' })]);
    vi.mocked(tagPhotoAsync).mockRejectedValueOnce(new Error('Model is busy'));
    await expect(tagAssetAsync(asset!, deps)).rejects.toThrow('Model is busy');
    await tagAssetAsync(asset!, deps);
    vi.mocked(tagPhotoAsync).mockResolvedValueOnce(['creek']);
    await tagAssetAsync(asset!, deps);

    expect(vi.mocked(tagPhotoAsync)).toHaveBeenCalledTimes(3);
    expect(await tagsOf('a1')).toEqual(['creek']);
  });
});
