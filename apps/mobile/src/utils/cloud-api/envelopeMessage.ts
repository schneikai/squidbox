/**
 * The message of the server's error envelope (`{ error: { code, message } }`, ApiError) when `data`
 * is one. Read by shape, whatever the code, so a code the app doesn't know yet still shows.
 */
export default function envelopeMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('error' in data)) return undefined;
  const { error } = data;
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
}
