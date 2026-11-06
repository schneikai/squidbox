import type { ContactRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type createThumbnailQueue from './createThumbnailQueue';

import type { ThumbnailStatusAsset } from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';

/** A contact's photo as the avatar queue loads it. */
export type AvatarItem = { avatarFilename: NonNullable<ContactRecord['avatarFilename']> };

type QueueRequest<Item> = ReturnType<typeof createThumbnailQueue<Item>>['request'];

// `loadThumbnail(asset, onResult)` (createThumbnailQueue's `request`, which keys on the thumbnail's
// name and hands the assets to preloadAssetThumbnailsAsync) returns the withdraw function;
// `loadAvatar(contact, onResult)` does the same for a contact's photo, in a queue of its own.
export type AssetThumbnailLoader = {
  loadThumbnail: QueueRequest<ThumbnailStatusAsset>;
  loadAvatar: QueueRequest<AvatarItem>;
};

const AssetThumbnailLoaderContext = createContext<AssetThumbnailLoader | null>(null);

export default AssetThumbnailLoaderContext;
