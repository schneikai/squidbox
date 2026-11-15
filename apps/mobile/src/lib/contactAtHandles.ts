import { CONTACT_HANDLES, parseHandle } from '@squidbox/shared';

// The networks whose handles are written with @ in a post's text, in the order the app shows them.
const AT_HANDLES = CONTACT_HANDLES.filter((handle) => handle.isAtHandle);
export type AtHandleField = (typeof AT_HANDLES)[number]['field'];

/**
 * A contact's distinct @handles (without the @, compared without case), each bare (parseHandle: a
 * profile link's too) with the networks it is on ('X', 'Bluesky'), in the app's order. A link that
 * isn't a profile can't be written as an @handle.
 */
export default function contactAtHandles(
  contact: Partial<Record<AtHandleField, string | null>>,
): { handle: string; networks: string[] }[] {
  const byKey = new Map<string, { handle: string; networks: string[] }>();
  for (const { field, label } of AT_HANDLES) {
    // Its handle on this network (another network's link is none).
    const { handle } = parseHandle(contact[field] ?? '', field);
    if (!handle) continue;
    const key = handle.toLowerCase();
    const seen = byKey.get(key);
    if (seen) seen.networks.push(label);
    else byKey.set(key, { handle, networks: [label] });
  }
  return [...byKey.values()];
}
