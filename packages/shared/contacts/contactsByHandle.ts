import { CONTACT_HANDLE_FIELDS, type ContactHandleField } from '../collections/contact';
import { handleKey } from './handleKey';

// The suffix a Bluesky handle may be mentioned without (`@maya` for `maya.bsky.social`).
const BLUESKY_SUFFIX = '.bsky.social';

/**
 * Which of `contacts` a typed @handle means: every contact that has it in any handle field
 * (CONTACT_HANDLE_FIELDS) under any spelling handleKey reads as the same (a profile link's handle
 * too, without case), a Bluesky handle also without `.bsky.social`. None for a handle no contact has.
 */
export function contactsByHandle<C extends Partial<Record<ContactHandleField, string | null>>>(
  contacts: readonly C[],
): (handle: string) => readonly C[] {
  const byKey = new Map<string, C[]>();
  const add = (key: string, contact: C) => {
    const listed = byKey.get(key) ?? [];
    if (!listed.includes(contact)) byKey.set(key, [...listed, contact]);
  };
  for (const contact of contacts) {
    for (const field of CONTACT_HANDLE_FIELDS) {
      const key = handleKey(contact[field] ?? '', field);
      if (!key) continue;
      add(key, contact);
      if (field === 'blueskyHandle' && key.endsWith(BLUESKY_SUFFIX)) add(key.slice(0, -BLUESKY_SUFFIX.length), contact);
    }
  }
  return (handle) => byKey.get(handleKey(handle)) ?? [];
}
