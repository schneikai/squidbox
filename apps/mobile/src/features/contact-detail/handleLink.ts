import { CONTACT_HANDLE_BY_FIELD, type ContactHandleField, parseHandle } from '@squidbox/shared';

/**
 * Where a contact's handle `field` holding `text` links to: a saved link as it is (with `https://`
 * when it has no scheme), else the network's profile of the handle; null when it is empty.
 */
export default function handleLink(field: ContactHandleField, text: string): string | null {
  const parsed = parseHandle(text, field);
  if (parsed.kind === 'empty') return null;
  if (parsed.kind === 'link') return parsed.url;
  return CONTACT_HANDLE_BY_FIELD[field].profileUrl(encodeURIComponent(parsed.handle));
}
