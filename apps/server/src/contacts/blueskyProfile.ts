// A Bluesky profile through Bluesky's public API, which allows reading it without a key: From link
// fills what X didn't show from the Bluesky profile the X bio names.
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { withTimeout } from '../withTimeout.js';
import { USER_AGENT } from './userAgent.js';

const BLUESKY_TIMEOUT_MS = 5_000;

const profileSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  avatar: z.string().optional(),
});

export type BlueskyProfile = { displayName: string; description: string; avatar: string | null };

/**
 * The public Bluesky profile of `handle`, or null when Bluesky doesn't know it (400, logged at info)
 * or doesn't answer (logged as a warning).
 */
export async function fetchBlueskyProfileAsync(
  handle: string,
  { signal, log }: { signal?: AbortSignal; log: Pick<FastifyBaseLogger, 'info' | 'warn'> },
): Promise<BlueskyProfile | null> {
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
      {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: withTimeout(BLUESKY_TIMEOUT_MS, signal),
      },
    );
    if (response.status === 400) {
      await response.body?.cancel();
      log.info({ handle }, 'From link: no Bluesky profile of the handle');
      return null;
    }
    if (!response.ok) throw new Error(`Bluesky answered ${response.status}`);
    const profile = profileSchema.parse(await response.json());
    return {
      displayName: profile.displayName?.trim() ?? '',
      description: profile.description?.trim() ?? '',
      avatar: profile.avatar || null,
    };
  } catch (error) {
    log.warn({ handle, err: error }, 'From link: the Bluesky profile could not be read');
    return null;
  }
}
