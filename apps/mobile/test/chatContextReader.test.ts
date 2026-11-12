import type { ChatContext } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import chatContextReader from '../src/features/post-chat/chatContextReader';
import chatSessions, { type ChatDraftPost } from '../src/features/post-chat/chatSessions';
import chatTags from '../src/features/post-chat/chatTags';

// The photos' rows as saved: none unless a test says so.
const readLiveAssets = vi.hoisted(() => vi.fn(async (): Promise<{ id?: string; tags: string[] | null }[]> => []));
vi.mock('../src/sync/aiStateRepository', () => ({ readLiveAssets }));
// The posts the handles come from: none unless a test says so.
const readMentionTexts = vi.hoisted(() =>
  vi.fn(async (): Promise<{ texts: string[]; fromAlbum: boolean }> => ({ texts: [], fromAlbum: false })),
);
vi.mock('../src/sync/postsRepository', () => ({ readMentionTexts }));
vi.mock('../src/sync/db/client', () => ({ getDb: () => null }));
vi.mock('../src/utils/assets/readVisionImageAsync', () => ({ default: vi.fn() }));
vi.mock('../src/utils/cloud-api/ai/tagPhotoAsync', () => ({ default: vi.fn() }));

const noTagging = { tagMissingAsync: async () => {} };
const read = (reader: ReturnType<typeof chatContextReader>, target = 'p1'): Promise<ChatContext> =>
  reader(new AbortController().signal, () => {}, target);
const post = (key: string, text = '', assetIds: string[] = []): ChatDraftPost => ({
  key,
  text,
  assets: assetIds.map((id) => makeAssetRecord({ id })),
});

// A chat over these posts, closed after `test`.
async function withChat(
  posts: ChatDraftPost[],
  test: (session: NonNullable<ReturnType<typeof chatSessions.get>>) => Promise<void>,
) {
  const id = chatSessions.open({ kind: 'draft' });
  const session = chatSessions.get(id)!;
  session.setDraft({ posts });
  try {
    await test(session);
  } finally {
    chatSessions.close(id);
  }
}

describe('chatContextReader', () => {
  it("waits for the photos' tagging the turn starts, and sends the tags it brought", () =>
    withChat([post('p1', '', ['meadow'])], async (session) => {
      let tagged: () => void = () => {};
      const tagMissingAsync = vi.fn(async (_ids: readonly string[], onWait?: () => void) => {
        onWait?.();
        await new Promise<void>((resolve) => (tagged = resolve));
        chatTags.tags.set({ meadow: ['meadow', 'tent'] });
      });
      readLiveAssets.mockResolvedValueOnce([{ id: 'meadow', tags: null }]);
      const onWait = vi.fn();
      const reading = chatContextReader(session, () => ({ tagging: { tagMissingAsync } }))(
        new AbortController().signal,
        onWait,
        'p1',
      );
      expect(tagMissingAsync).toHaveBeenCalledWith(['meadow'], onWait);
      expect(onWait).toHaveBeenCalled();
      tagged();
      expect((await reading).tags).toEqual(['meadow', 'tent']);
      chatTags.tags.set({});
    }));

  it("reads the handles of the photos as they are when the turn goes, with the Mentions sheet's edits", () =>
    withChat([post('p1', '', ['ridge'])], async (session) => {
      readMentionTexts.mockResolvedValueOnce({ texts: ['With @trailmike'], fromAlbum: true });
      session.editMentions({ add: ['@corntwee'] });
      expect((await read(chatContextReader(session, () => ({ tagging: noTagging })))).mentions).toEqual([
        '@corntwee',
        '@trailmike',
      ]);
      expect(readMentionTexts).toHaveBeenLastCalledWith(null, ['ridge']);
    }));

  it("takes the tags as saved, not the last render's", () =>
    withChat([post('p1', '', ['ridge'])], async (session) => {
      readLiveAssets.mockResolvedValueOnce([{ tags: ['ridge', 'fog'] }]);
      expect((await read(chatContextReader(session, () => ({ tagging: noTagging })))).tags).toEqual(['ridge', 'fog']);
    }));

  it("sends the chat's own tags for a photo never tagged", () =>
    withChat([post('p1', '', ['meadow'])], async (session) => {
      readLiveAssets.mockResolvedValueOnce([{ id: 'meadow', tags: null }]);
      chatTags.tags.set({ meadow: ['meadow', 'tent'] });
      expect((await read(chatContextReader(session, () => ({ tagging: noTagging })))).tags).toEqual(['meadow', 'tent']);
      chatTags.tags.set({});
    }));

  it("sends the target post's text, and the media and tags of every post", () =>
    withChat(
      [post('p1', 'Fog on the trail', ['ridge']), post('p2', 'Then the sun.', ['lake', 'ridge'])],
      async (session) => {
        readLiveAssets.mockResolvedValueOnce([{ tags: ['ridge'] }, { tags: ['lake'] }]);
        const context = await read(
          chatContextReader(session, () => ({ tagging: noTagging })),
          'p2',
        );
        expect(context).toMatchObject({
          text: 'Then the sun.',
          media: { photo: 2, video: 0 },
          tags: ['ridge', 'lake'],
        });
        expect(context.thread).toEqual({ index: 1, posts: ['Fog on the trail', 'Then the sun.'] });
      },
    ));

  it('sends no thread for a post on its own', () =>
    withChat([post('p1', 'Fog')], async (session) => {
      expect((await read(chatContextReader(session, () => ({ tagging: noTagging })))).thread).toBeUndefined();
    }));

  it('keeps a target past the 25th post inside the thread it sends, at its place', () =>
    withChat(
      Array.from({ length: 30 }, (_, index) => post(`p${index + 1}`, `Post ${index + 1}`)),
      async (session) => {
        const { thread } = await read(
          chatContextReader(session, () => ({ tagging: noTagging })),
          'p28',
        );
        expect(thread!.posts).toHaveLength(25);
        expect(thread!.posts[thread!.index]).toBe('Post 28');
        expect(thread!.posts[0]).toBe('Post 4');
      },
    ));

  it('fails the turn for a post that was removed', () =>
    withChat([post('p1')], async (session) => {
      await expect(
        read(
          chatContextReader(session, () => ({ tagging: noTagging })),
          'p2',
        ),
      ).rejects.toThrow('This post was removed');
    }));
});
