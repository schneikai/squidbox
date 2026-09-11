import type { CollectionDescriptor } from './define';
import { assetCollection } from './asset';
import { albumCollection } from './album';
import { postCollection } from './post';
import { albumAssetCollection } from './albumAsset';
import { postAssetCollection } from './postAsset';

// The collection registry the sync engine iterates. Adding a collection is: define it, add it
// here, add its migrations + server_seq trigger (the trigger is attached registry-driven).
export const collections: readonly CollectionDescriptor[] = [
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
];

export const collectionsByName: Record<string, CollectionDescriptor> = Object.fromEntries(
  collections.map((c) => [c.name, c])
);

export const collectionNames: readonly string[] = collections.map((c) => c.name);

export type CollectionName = 'assets' | 'albums' | 'posts' | 'album_assets' | 'post_assets';
