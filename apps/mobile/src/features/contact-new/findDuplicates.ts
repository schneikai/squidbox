import { CONTACT_HANDLES, type ContactHandleField, handleKey } from '@squidbox/shared';

import type { Candidate, DuplicateCandidates } from './duplicateCandidates';

import type { ContactFormFields, HandleFormField } from '@/features/contact-detail/contactFields';

const HANDLE_REASONS = CONTACT_HANDLES.map(({ field, label }): [ContactHandleField, string] => [
  field,
  `Same ${label} handle`,
]);

export type DuplicateMatch = { contact: Candidate; reason: string };

/**
 * The contacts a new one may duplicate: those with one of its handles (stored fields), the same
 * handle under any spelling: `@`, case or a profile link (handleKey), in the candidates' order, each
 * with why ("Same name and X handle" when the name matches too, ignoring case), and the fields they
 * share. `candidates` are the live contacts' names and handles (duplicateCandidates).
 */
export default function findDuplicates(
  fields: Pick<ContactFormFields, 'name' | ContactHandleField>,
  candidates: DuplicateCandidates,
): { matches: DuplicateMatch[]; sharedFields: Set<HandleFormField | 'name'> } {
  const name = fields.name.trim().toLowerCase();
  // The typed handles' keys, each with why it would match.
  const typed = HANDLE_REASONS.map(([field, reason]) => ({
    field,
    reason,
    key: handleKey(fields[field] ?? '', field),
  })).filter(({ key }) => key !== '');
  const found = new Set(typed.flatMap(({ field, key }) => candidates.byKey[field].get(key) ?? []));
  const matches: DuplicateMatch[] = [];
  const sharedFields = new Set<HandleFormField | 'name'>();
  for (const index of [...found].sort((a, b) => a - b)) {
    const contact = candidates.contacts[index]!;
    const shared = typed.filter(({ field, key }) => candidates.keys[index]![field] === key);
    const [first] = shared;
    if (!first) continue;
    for (const { field } of shared) sharedFields.add(field);
    const { field: firstField, reason: firstReason } = first;
    const isSameName = !!name && contact.name.trim().toLowerCase() === name;
    if (isSameName) sharedFields.add('name');
    const reason = isSameName && firstField === 'xHandle' ? 'Same name and X handle' : firstReason;
    matches.push({ contact, reason });
  }
  return { matches, sharedFields };
}
