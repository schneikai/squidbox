import type { AlbumRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { AlbumMove } from './moveAlbum';

import type assetQuery from '@/features/asset-list/assetQuery';
import type { BatchOptions } from '@/sync/writeInBatches';

type AlbumRef = Pick<AlbumRecord, 'id'>;

// A drag in an album's grid: `sort` is the sort it was made under (assetQuery's).
export type AlbumAssetMove = {
  assetId: string;
  afterId: string | null;
  sort: NonNullable<Parameters<typeof assetQuery>[0]['sort']>;
};

// The album writes (AlbumsProvider). The bulk methods take writeInBatches' options and resolve to
// whether every batch was written; the drags resolve to the write's committed-write count.
export type AlbumsContextValue = {
  addAlbum: (fields: Partial<AlbumRecord> & { assets?: string[] }) => Promise<AlbumRecord>;
  updateAlbum: (id: string, updates: Partial<AlbumRecord>) => Promise<void>;
  updateManyAlbums: (updatesById: Record<string, Partial<AlbumRecord>>) => Promise<void>;
  moveAlbum: (change: AlbumMove) => Promise<number>;
  toggleFavoriteAlbum: (album: AlbumRef) => Promise<void>;
  addAssetsToAlbum: (
    album: AlbumRef,
    assetsOrAssetIds: (string | { id: string })[],
    batchOptions?: BatchOptions,
  ) => Promise<boolean>;
  removeAssetsFromAlbum: (album: AlbumRef, assetIds: string[], batchOptions?: BatchOptions) => Promise<boolean>;
  reorderAlbumAssets: (album: Pick<AlbumRecord, 'id' | 'sortOrder'>, move: AlbumAssetMove) => Promise<number>;
  setAlbumDeleted: (album: AlbumRef) => Promise<void>;
};

const AlbumsContext = createContext<AlbumsContextValue | null>(null);

export default AlbumsContext;
