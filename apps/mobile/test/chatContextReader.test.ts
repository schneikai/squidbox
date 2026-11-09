import type { ChatContext } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import chatContextReader from '../src/features/post-chat/chatContextReader';
import chatSessions from '../src/features/post-chat/chatSessions';
import chatTags from '../src/features/post-chat/chatTags';

// The photos' rows as saved: none unless a test says so.
const readLiveAssets = vi.hoisted(() => vi.fn(async (): Promise<{ id?: string; tags: string[] | null }[]> => []));
vi.mock('../src/sync/aiStateRepository', () => ({ readLiveAssets }));
vi.mock('../src/sync/db/client', () => ({ getDb: () => null }));
vi.mock('../src/utils/assets/readVisionImageAsync', () => ({ default: vi.fn() }));
vi.mock('../src/utils/cloud-api/ai/tagPhotoAsync', () => ({ default: vi.fn() }));

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
      tagging: { taggingAsync },
      found: { handles: ['@trailmike'], fromAlbum: true },
    }));

    const reading: Promise<ChatContext> = read(new AbortController().signal, () => {});
    session.editMentions({ add: ['@corntwee'] });
    tagged();
    expect((await reading).mentions).toEqual(['@corntwee', '@trailmike']);
    chatSessions.close(id);
  });

  it("takes the tags as saved, not the last render's, when no tagging was under way", async () => {
    const id = chatSessions.open({ kind: 'draft' });
    const session = chatSessions.get(id)!;
    session.setDraft({ text: '', assets: [makeAssetRecord({ id: 'ridge' })] });
    readLiveAssets.mockResolvedValueOnce([{ tags: ['ridge', 'fog'] }]);
    // The last render read the row before its tags were saved.
    const tagging = { taggingAsync: async () => false, rows: [{ id: 'ridge', tags: null }] };
    const read = chatContextReader(session, () => ({ tagging, found: undefined }));

    expect((await read(new AbortController().signal, () => {})).tags).toEqual(['ridge', 'fog']);
    chatSessions.close(id);
  });

  it("sends the chat's own tags for a photo never tagged", async () => {
    const id = chatSessions.open({ kind: 'draft' });
    const session = chatSessions.get(id)!;
    session.setDraft({ text: '', assets: [makeAssetRecord({ id: 'meadow' })] });
    readLiveAssets.mockResolvedValueOnce([{ id: 'meadow', tags: null }]);
    chatTags.tags.set({ meadow: ['meadow', 'tent'] });
    const read = chatContextReader(session, () => ({ tagging: { taggingAsync: async () => false }, found: undefined }));

    expect((await read(new AbortController().signal, () => {})).tags).toEqual(['meadow', 'tent']);
    chatSessions.close(id);
  });
});
