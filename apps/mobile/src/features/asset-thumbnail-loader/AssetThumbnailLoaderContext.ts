import type { AssetRecord, ContactRecord } from '@squidbox/shared';
import { createContext } from 'react';

// `loadThumbnail(asset, onResult)` (createThumbnailQueue's `request`, which keys on the thumbnail's
// name and hands the assets to preloadAssetThumbnailsAsync) returns the withdraw function;
// `loadAvatar(contact, onResult)` does the same for a contact's photo, in a queue of its own.
export type AssetThumbnailLoader = {
  loadThumbnail: (
    asset: Pick<AssetRecord, 'thumbnailFilename'>,
    onResult: (result: 'done' | 'failed') => void,
  ) => () => void;
  loadAvatar: (
    contact: { avatarFilename: NonNullable<ContactRecord['avatarFilename']> },
    onResult: (result: 'done' | 'failed') => void,
  ) => () => void;
};

const AssetThumbnailLoaderContext = createContext<AssetThumbnailLoader | null>(null);

export default AssetThumbnailLoaderContext;
