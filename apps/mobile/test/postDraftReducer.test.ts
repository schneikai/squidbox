import { describe, expect, it } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import draftFromPost from '../src/features/posts/draft/draftFromPost';
import postData from '../src/features/posts/draft/postData';
import postDraftReducer, { type PostDraft, type PostEditorPost } from '../src/features/posts/draft/postDraftReducer';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { readByIds } from '../src/sync/readByIds';

// Two asset rows, as readPost reads them.
const db = makeTestDb();
await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'a2' })]);
const [a1, a2] = await readByIds(db, schema.assets, ['a1', 'a2']);

// A post on X with a thread, an OnlyFans copy with a thread, and a Bluesky copy.
const post: PostEditorPost = {
  text: 'Sunrise on the ridge',
  postAssets: [{ id: 'e1', asset: a1! }],
  postedAt: 50,
  channelId: 'x',
  threadPosts: [{ id: 't1', text: 'More on my OnlyFans', postAssets: [{ id: 'e2', asset: a2! }] }],
  channelPosts: [
    {
      id: 'c1',
      channelId: 'onlyfans',
      text: 'The whole run',
      postAssets: [{ id: 'e3', asset: a1! }],
      threadPosts: [{ id: 't2', text: 'Uncut', postAssets: [{ id: 'e4', asset: a2! }] }],
    },
    { id: 'c2', channelId: 'bluesky', text: 'Ridge at dawn', postAssets: [], threadPosts: [] },
  ],
};

// The user's channels, in their order.
const CHANNEL_ORDER = ['bluesky', 'x', 'onlyfans', 'instagram'];

const keyOf = (draft: PostDraft, channelId: string) =>
  [draft.main, ...draft.others].find((part) => part.channelId === channelId)!.key;

describe('postDraftReducer', () => {
  it('saves an untouched draft as its seed, so Save stays off', () => {
    const seed = postData(draftFromPost(post), post.postedAt);
    const draft = postDraftReducer(draftFromPost(post), { type: 'select', key: 'main' });
    expect(postData(draft, post.postedAt)).toEqual(seed);
    expect(seed.channelPosts.map((copy) => copy.id)).toEqual(['c1', 'c2']);
  });

  it("adds a channel as a copy of the selected channel's first card, with fresh refs and no thread, and selects it", () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, { type: 'select', key: keyOf(draft, 'onlyfans') });
    draft = postDraftReducer(draft, { type: 'addChannel', channelId: 'instagram' });
    const added = draft.others.at(-1)!;
    expect(draft.selectedKey).toBe(added.key);
    expect(added).toMatchObject({ id: null, channelId: 'instagram' });
    expect(added.cards).toHaveLength(1);
    expect(added.cards[0]!.text).toBe('The whole run');
    expect(added.cards[0]!.postAssets.map((postAsset) => postAsset.asset.id)).toEqual(['a1']);
    expect(added.cards[0]!.postAssets[0]!.id).not.toBe('e3');
    expect(new Set([draft.main.key, ...draft.others.map((other) => other.key)]).size).toBe(4);
  });

  it('edits only the channel it is given', () => {
    let draft = draftFromPost(post);
    const key = keyOf(draft, 'bluesky');
    const cardKey = draft.others[1]!.cards[0]!.key;
    draft = postDraftReducer(draft, {
      type: 'channel',
      key,
      action: { type: 'updateCard', key: cardKey, changes: { text: 'Edited' } },
    });
    draft = postDraftReducer(draft, { type: 'channel', key, action: { type: 'setChannel', channelId: 'instagram' } });
    const saved = postData(draft, post.postedAt);
    expect(saved.text).toBe('Sunrise on the ridge');
    expect(saved.channelPosts.map(({ channelId, text }) => [channelId, text])).toEqual([
      ['onlyfans', 'The whole run'],
      ['instagram', 'Edited'],
    ]);
  });

  it("removes another channel and selects the post's own, first in bar order", () => {
    let draft = draftFromPost(post, 'c1');
    draft = postDraftReducer(draft, {
      type: 'removeChannel',
      key: keyOf(draft, 'onlyfans'),
      channelOrder: CHANNEL_ORDER,
    });
    expect(draft.selectedKey).toBe(draft.main.key);
    expect(postData(draft, post.postedAt).channelPosts.map((copy) => copy.id)).toEqual(['c2']);
  });

  it("removing the post's own channel saves the next channel in bar order as the post, with new thread posts and refs, and drops its copy", () => {
    let draft = draftFromPost(post);
    // Bluesky goes first, so OnlyFans, which has a thread, is next after X.
    draft = postDraftReducer(draft, {
      type: 'removeChannel',
      key: keyOf(draft, 'bluesky'),
      channelOrder: CHANNEL_ORDER,
    });
    draft = postDraftReducer(draft, { type: 'removeChannel', key: 'main', channelOrder: CHANNEL_ORDER });
    expect(draft.selectedKey).toBe(draft.main.key);
    const saved = postData(draft, post.postedAt);
    expect(saved).toMatchObject({ channelId: 'onlyfans', text: 'The whole run', channelPosts: [] });
    expect(saved.threadPosts).toEqual([
      { id: null, text: 'Uncut', assetRefs: [expect.objectContaining({ assetId: 'a2' })] },
    ]);
    expect(saved.threadPosts[0]!.assetRefs[0]!.id).not.toBe('e4');
    expect(saved.assetRefs.map((ref) => ref.assetId)).toEqual(['a1']);
    expect(saved.assetRefs[0]!.id).not.toBe('e3');
  });

  it("promotes the first other channel in the user's order, not the first stored", () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, { type: 'removeChannel', key: 'main', channelOrder: CHANNEL_ORDER });
    const saved = postData(draft, post.postedAt);
    expect(saved).toMatchObject({ channelId: 'bluesky', text: 'Ridge at dawn' });
    expect(saved.channelPosts.map((copy) => copy.id)).toEqual(['c1']);
  });

  it("opens on the channel saved as the given copy, and on the post's own for an id it doesn't have", () => {
    const draft = draftFromPost(post, 'c2');
    expect(draft.selectedKey).toBe(keyOf(draft, 'bluesky'));
    expect(draftFromPost(post, 'gone').selectedKey).toBe('main');
  });
});
