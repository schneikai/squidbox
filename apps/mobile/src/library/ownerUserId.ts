import type { Library } from './registry';

/**
 * The user the open library belongs to, for the records kept per user (the persona, the
 * instructions, the model picks). Only an account's library shows the screens that read them
 * (useIsAssistantAvailable), and below LibraryGate a library is always open; a device library has no
 * user, which reads as undefined, as it always has.
 */
export function ownerUserId(library: Library | null): string {
  const { owner } = library!;
  return (owner.kind === 'account' ? owner.userId : undefined) as string;
}
