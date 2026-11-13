import type { CollectionDescriptor } from './define';
import { assetCollection } from './asset';
import { albumCollection } from './album';
import { postCollection } from './post';
import { albumAssetCollection } from './albumAsset';
import { postAssetCollection } from './postAsset';
import { personaCollection } from './persona';
import { promptButtonCollection } from './promptButton';
import { favoriteCollection } from './favorite';
import { instructionCollection } from './instruction';
import { modelChoiceCollection } from './modelChoice';
import { contactCollection } from './contact';
import { contactListCollection } from './contactList';
import { contactListMemberCollection } from './contactListMember';
import { contactLinkCollection } from './contactLink';
import { contactSettingCollection } from './contactSetting';
import { ideaSettingCollection } from './ideaSetting';

// The collection registry the sync engine iterates. Adding a collection: docs/sync-design.md §9.
export const collections = [
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
  personaCollection,
  promptButtonCollection,
  favoriteCollection,
  instructionCollection,
  modelChoiceCollection,
  contactCollection,
  contactListCollection,
  contactListMemberCollection,
  contactLinkCollection,
  contactSettingCollection,
  ideaSettingCollection,
] as const satisfies readonly CollectionDescriptor[];

/** A registered collection's name. Maps keyed by it fail typecheck when a collection is missing. */
export type CollectionName = (typeof collections)[number]['name'];

export const collectionsByName: Record<string, CollectionDescriptor> = Object.fromEntries(
  collections.map((c) => [c.name, c]),
);

export const collectionNames: readonly CollectionName[] = collections.map((c) => c.name);
