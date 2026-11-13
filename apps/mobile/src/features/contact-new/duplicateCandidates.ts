import { CONTACT_HANDLE_FIELDS, type ContactHandleField, handleKey } from '@squidbox/shared';

import type { ContactSummary } from '@/sync/queries/contactQuery';

/** What the duplicate check reads of a live contact (a ContactSummary), and a match shows. */
export type Candidate = Pick<ContactSummary, 'id' | 'name' | 'avatarFilename' | ContactHandleField>;

/**
 * The live contacts a new one is checked against (findDuplicates), with each handle's key
 * (handleKey) worked out once per read of the contacts rather than on every key typed: `keys[i]` are
 * `contacts[i]`'s, and `byKey` finds the contacts holding a key in a field.
 */
export type DuplicateCandidates = {
  contacts: readonly Candidate[];
  keys: Record<ContactHandleField, string>[];
  byKey: Record<ContactHandleField, Map<string, number[]>>;
};

export default function duplicateCandidates(contacts: readonly Candidate[]): DuplicateCandidates {
  const byKey = Object.fromEntries(
    CONTACT_HANDLE_FIELDS.map((field) => [field, new Map()]),
  ) as DuplicateCandidates['byKey'];
  const keys = contacts.map((contact, index) => {
    const keyed = Object.fromEntries(
      CONTACT_HANDLE_FIELDS.map((field) => [field, handleKey(contact[field] ?? '', field)]),
    ) as Record<ContactHandleField, string>;
    for (const field of CONTACT_HANDLE_FIELDS) {
      if (!keyed[field]) continue;
      const indexes = byKey[field].get(keyed[field]);
      if (indexes) indexes.push(index);
      else byKey[field].set(keyed[field], [index]);
    }
    return keyed;
  });
  return { contacts, keys, byKey };
}
