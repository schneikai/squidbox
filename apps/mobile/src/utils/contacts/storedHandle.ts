import { CONTACT_LIMITS } from '@squidbox/shared';

/** A handle as a contact stores it: as typed, trimmed, cut at CONTACT_LIMITS.handle; null when nothing is left. */
export default function storedHandle(typed: string): string | null {
  return typed.trim().slice(0, CONTACT_LIMITS.handle) || null;
}
