import useOpenLibrary from './useOpenLibrary';

/**
 * The user the open account library belongs to, for the records kept per user (the persona, the
 * instructions, the model picks). Only an account's library shows the screens that read them
 * (useIsAssistantAvailable); throws in this device's own library, which has no user.
 */
export default function useAccountUserId(): string {
  const { userId } = useOpenLibrary();
  if (userId === null) throw new Error("This device's library has no account (see useIsAssistantAvailable).");
  return userId;
}
