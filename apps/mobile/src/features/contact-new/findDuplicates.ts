import { CONTACT_HANDLES, type ContactHandleField } from '@squidbox/shared';

import type { ContactFormFields, HandleFormField } from '@/features/contact-detail/contactFields';
import type { ContactSummary } from '@/features/contact-list/contactQuery';

/** What the check reads of a live contact (a ContactSummary), and a match shows. */
type Candidate = Pick<ContactSummary, 'id' | 'name' | 'avatarFilename' | ContactHandleField>;

const HANDLE_REASONS = CONTACT_HANDLES.map(({ field, label }): [ContactHandleField, string] => [
  field,
  `Same ${label} handle`,
]);

export type DuplicateMatch = { contact: Candidate; reason: string };

/**
 * The contacts a new one may duplicate: those with one of its handles (stored fields, normalized),
 * each with why ("Same name and X handle" when the name matches too, ignoring case), and the fields
 * they share. `contacts` are the live contacts' names and handles.
 */
export default function findDuplicates(
  fields: Pick<ContactFormFields, 'name' | ContactHandleField>,
  contacts: readonly Candidate[],
): { matches: DuplicateMatch[]; sharedFields: Set<HandleFormField | 'name'> } {
  const name = fields.name.trim().toLowerCase();
  const matches: DuplicateMatch[] = [];
  const sharedFields = new Set<HandleFormField | 'name'>();
  for (const contact of contacts) {
    const shared = HANDLE_REASONS.filter(([field]) => fields[field] && fields[field] === contact[field]);
    const [first] = shared;
    if (!first) continue;
    for (const [field] of shared) sharedFields.add(field);
    const [firstField, firstReason] = first;
    const isSameName = !!name && contact.name.trim().toLowerCase() === name;
    if (isSameName) sharedFields.add('name');
    const reason = isSameName && firstField === 'xHandle' ? 'Same name and X handle' : firstReason;
    matches.push({ contact, reason });
  }
  return { matches, sharedFields };
}
