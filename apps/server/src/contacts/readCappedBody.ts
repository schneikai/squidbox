/**
 * The body of `response`, or null when it is larger than `maxBytes`: refused by its content-length
 * when it says so, else once that much was read (the rest isn't: the request is cancelled).
 */
export async function readCappedBody(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
    await response.body.cancel().catch(() => {});
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
}
