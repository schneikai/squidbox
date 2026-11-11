import type { VisionImage } from '@squidbox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import chatTags from '../src/features/post-chat/chatTags';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { readByIds } from '../src/sync/readByIds';
import readVisionImageAsync, { type VisionImageReadDeps } from '../src/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '../src/utils/cloud-api/ai/tagPhotoAsync';

// The library's database is a test one; reading the thumbnail and the server's tagging are stubs.
const current = vi.hoisted(() => ({ db: null as AppDb | null }));
vi.mock('../src/sync/db/client', () => ({ getDb: () => current.db }));
vi.mock('../src/utils/assets/readVisionImageAsync', () => ({ default: vi.fn() }));
vi.mock('../src/utils/cloud-api/ai/tagPhotoAsync', () => ({ default: vi.fn() }));

const deps: VisionImageReadDeps = {
  library: libraryPaths('abc'),
  isAuthenticated: true,
  preloadAssetThumbnailsAsync: vi.fn(),
};
const image: VisionImage = { base64: 'AAAA', mimeType: 'image/jpeg' };

beforeEach(() => {
  current.db = makeTestDb();
  vi.mocked(readVisionImageAsync).mockResolvedValue(image);
  vi.mocked(tagPhotoAsync).mockResolvedValue(['forest', 'morning fog']);
});

describe('chatTags', () => {
  it("keeps the chat's tags for a photo never tagged in memory and never stores them on the photo", async () => {
    const [asset] = await repo.createMany(current.db!, [makeAssetRecord({ id: 'c1' })]);
    expect(await chatTags.run(asset!, deps)).toEqual(['forest', 'morning fog']);

    const [row] = await readByIds(current.db!, schema.assets, ['c1']);
    expect(row.tags).toBeNull();
    expect(chatTags.withTags([row], chatTags.tags.get())[0].tags).toEqual(['forest', 'morning fog']);
  });

  it("shows a photo's stored tags over the chat's own", () => {
    const rows = [
      { id: 'c2', tags: ['ridge'] },
      { id: 'c3', tags: null },
    ];
    expect(chatTags.withTags(rows, { c2: ['guess'] })).toEqual(rows);
  });

  it('before a turn, tags each photo never tagged and waits for it, saying it waits', async () => {
    await repo.createMany(current.db!, [makeAssetRecord({ id: 'c4' }), makeAssetRecord({ id: 'c5', tags: ['lake'] })]);
    const onWait = vi.fn();
    await chatTags.tagMissingAsync(['c4', 'c5'], { deps, isAvailable: true }, onWait);
    expect(onWait).toHaveBeenCalledTimes(1);
    expect(tagPhotoAsync).toHaveBeenCalledTimes(1);
    expect(chatTags.tags.get().c4).toEqual(['forest', 'morning fog']);
  });

  it('before a turn, tags nothing while the assistant is unavailable', async () => {
    await repo.createMany(current.db!, [makeAssetRecord({ id: 'c6' })]);
    const onWait = vi.fn();
    await chatTags.tagMissingAsync(['c6'], { deps, isAvailable: false }, onWait);
    expect(tagPhotoAsync).not.toHaveBeenCalled();
    expect(onWait).not.toHaveBeenCalled();
  });
});
