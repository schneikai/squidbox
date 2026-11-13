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
import { channelCollection } from './channel';

// The collection registry the sync engine iterates. Adding a collection is: define it, add it
// here, add its migrations + server_seq trigger (the trigger is attached registry-driven).
export const collections: readonly CollectionDescriptor[] = [
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
  channelCollection,
];

export const collectionsByName: Record<string, CollectionDescriptor> = Object.fromEntries(
  collections.map((c) => [c.name, c]),
);

export const collectionNames: readonly string[] = collections.map((c) => c.name);

export type CollectionName =
  | 'assets'
  | 'albums'
  | 'posts'
  | 'album_assets'
  | 'post_assets'
  | 'personas'
  | 'prompt_buttons'
  | 'favorites'
  | 'instructions'
  | 'model_choices'
  | 'contacts'
  | 'contact_lists'
  | 'contact_list_members'
  | 'contact_links'
  | 'contact_settings'
  | 'idea_settings'
  | 'channels';
