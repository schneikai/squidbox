import type { ContactScope } from '@/sync/queries/contactQuery';

/** What a Contacts section is about: a photo, or a post's photos. */
export type ContactsOf = { assetId: string } | { postId: string };

/** The contacts on a photo, or on any photo of a post. */
export function contactsOfScope(of: ContactsOf): ContactScope {
  return 'assetId' in of ? { photoIds: [of.assetId] } : { photosOf: of };
}
