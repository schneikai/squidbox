import type { ChatContext } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

import chatContextReader from '../src/features/post-chat/chatContextReader';
import chatSessions from '../src/features/post-chat/chatSessions';

// The photos' rows are read again after a tagging landed: none here.
vi.mock('../src/sync/aiStateRepository', () => ({ readLiveAssets: async () => [] }));
vi.mock('../src/sync/db/client', () => ({ getDb: () => null }));

describe('chatContextReader', () => {
  it("takes the Mentions sheet's edits made while it waited for the photos' tags", async () => {
    const id = chatSessions.open({ kind: 'draft' });
    const session = chatSessions.get(id)!;
    let tagged: () => void = () => {};
    const taggingAsync = async (onWait?: () => void) => {
      onWait?.();
      await new Promise<void>((resolve) => (tagged = resolve));
      return true;
    };
    const read = chatContextReader(session, () => ({
      tagging: { taggingAsync, rows: [] },
      found: { handles: ['@trailmike'], fromAlbum: true },
    }));

    const reading: Promise<ChatContext> = read(new AbortController().signal, () => {});
    session.editMentions({ add: ['@corntwee'] });
    tagged();
    expect((await reading).mentions).toEqual(['@corntwee', '@trailmike']);
    chatSessions.close(id);
  });
});
