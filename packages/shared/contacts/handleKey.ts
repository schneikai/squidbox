import type { ContactHandleField } from '../collections/contact';
import { parseHandle } from './parseHandle';

/**
 * What a handle's text (in `field`, when given: parseHandle) is compared by, so every spelling of one handle is the same: '' for an empty
 * text; the handle lowercased for a handle or a profile's link ('@MayaL', 'mayal' and
 * 'https://x.com/MayaL?s=21' are all 'mayal'); any other link's address (parseHandle: without its
 * scheme and `www.`) lowercased without a trailing slash (before a query too), its query and fragment kept, so it equals
 * only itself and never a handle its path happens to start with (`x.com/i/lists/1` isn't 'i').
 */
export function handleKey(text: string, field?: ContactHandleField): string {
  const parsed = parseHandle(text, field);
  if (parsed.handle !== null) return parsed.handle.toLowerCase();
  return parsed.kind === 'link' ? parsed.address.toLowerCase().replace(/\/(?=[?#]|$)/, '') : '';
}
