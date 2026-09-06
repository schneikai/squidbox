import type { CollectionDescriptor } from './define';
import { assetCollection } from './asset';

// The collection registry the sync engine iterates. Adding a collection later (albums, posts
// in Phase 3b) is: define it, add it here, add its migrations + server_seq trigger.
export const collections: readonly CollectionDescriptor[] = [assetCollection];

export const collectionsByName: Record<string, CollectionDescriptor> = Object.fromEntries(
  collections.map((c) => [c.name, c])
);

export const collectionNames: readonly string[] = collections.map((c) => c.name);

export type CollectionName = 'assets';
