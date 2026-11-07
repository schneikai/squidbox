import type { AssetSort } from '@/sync/assetSql';

// How this device looks and behaves (the Where data is saved rule in CLAUDE.md).
export type AppSettings = {
  thumbnailStyle: 'cover' | 'contain';
  // The Library's sort.
  librarySortOrder: AssetSort;
  // Each album's sort on this device, by album id, when it isn't Newest first (getAlbumSortOrder).
  albumSortOrders: Partial<Record<string, AssetSort>>;
  // The albums list's sort (useSortAlbumsAction), shared by the Albums tab and the album picker: one
  // of its sort functions' keys, which it checks, as a stored one may be gone.
  albumListSortOrder: string;
  // The contacts' sort (useContactSort), shared by the Contacts tab and a list's screen: one of
  // contactSortOptions' keys, which it checks, as a stored one may be gone.
  contactListSortOrder: string;
  // The list picker's sort (useContactListSort): one of contactSortOptions' keys, which it checks.
  contactListPickerSortOrder: string;
  // Whether a video in the asset detail screen starts by itself.
  isVideoAutoplayOn: boolean;
  // Whether lifts, drops, peeks and outcomes tap back (useHaptics).
  isHapticsOn: boolean;
};

// Each setting until it is changed. Only changed ones are stored, under these keys.
const appSettingsDefaults: AppSettings = {
  thumbnailStyle: 'cover',
  librarySortOrder: 'createdAt:desc',
  albumSortOrders: {},
  albumListSortOrder: 'createdAt:desc',
  contactListSortOrder: 'name:asc',
  contactListPickerSortOrder: 'name:asc',
  isVideoAutoplayOn: true,
  isHapticsOn: true,
};

export default appSettingsDefaults;
