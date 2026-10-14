import type { AlbumRecord, AssetRecord, PostRecord } from '@squidbox/shared';
import { randomUUID } from 'node:crypto';

import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { makeEdgeRepository } from '../../src/sync/edgesRepository';
import { makeRepository } from '../../src/sync/repository';

export function makeAssetRecord(over: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    mediaLibraryAssetId: 'm1',
    mediaType: 'photo',
    width: 100,
    height: 100,
    fileSize: 500,
    duration: null,
    filename: 'a.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null,
    oldFileId: null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    ...over,
  };
}

export function makeAlbumRecord(over: Partial<AlbumRecord> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    name: 'Album',
    isFavorite: false,
    archivedAt: null,
    showInPostSuggestionsAfter: null,
    oldCollectionName: null,
    notes: null,
    sortOrder: null,
    smartAlbumType: null,
    position: null,
    ...over,
  };
}

export function makePostRecord(over: Partial<PostRecord> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    text: '',
    isFavorite: false,
    postedAt: null,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: 0,
    hasBeenReposted: false,
    ...over,
  };
}

const posts = makeRepository('posts', schema.posts);
const postEdges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

/** A post with edges to `assetIds`, in that order; `newEdgeId` names the edges. */
export async function createPost(
  db: SyncDb,
  over: Partial<PostRecord>,
  assetIds: string[] = [],
  newEdgeId: () => string = randomUUID,
): Promise<void> {
  const post = makePostRecord(over);
  await posts.create(db, post);
  await postEdges.createFromRefs(
    db,
    post.id,
    assetIds.map((assetId) => ({ id: newEdgeId(), assetId })),
  );
}
