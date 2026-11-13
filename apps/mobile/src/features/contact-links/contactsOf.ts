import type { PhotosOf } from '@/sync/assetSql';
import type { ContactScope } from '@/sync/queries/contactQuery';

/** What a Contacts section or the Add contacts sheet is about: a photo, or an album's or post's photos. */
export type ContactsOf = { assetId: string } | PhotosOf;

/** The contacts on a photo, or on any photo of an album or post. */
export function contactsOfScope(of: ContactsOf): ContactScope {
  return 'assetId' in of ? { photoIds: [of.assetId] } : { photosOf: of };
}

/** What VoiceOver and an alert call it: photo, album or post. */
export function contactsOfName(of: ContactsOf): string {
  return 'assetId' in of ? 'photo' : 'albumId' in of ? 'album' : 'post';
}
