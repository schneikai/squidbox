import { describe, expect, it } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import draftFromPost from '../src/features/posts/draft/draftFromPost';
import postData from '../src/features/posts/draft/postData';
import postDraftReducer, {
  type PostDraft,
  type PostDraftAction,
  type PostEditorPost,
} from '../src/features/posts/draft/postDraftReducer';
import versionOfChannel from '../src/features/posts/draft/versionOfChannel';
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
  channelIds: ['x'],
  threadPosts: [{ id: 't1', text: 'More on my OnlyFans', postAssets: [{ id: 'e2', asset: a2! }] }],
  channelPosts: [
    {
      id: 'c1',
      channelIds: ['onlyfans'],
      text: 'The whole run',
      postAssets: [{ id: 'e3', asset: a1! }],
      threadPosts: [{ id: 't2', text: 'Uncut', postAssets: [{ id: 'e4', asset: a2! }] }],
    },
    { id: 'c2', channelIds: ['bluesky'], text: 'Ridge at dawn', postAssets: [], threadPosts: [] },
  ],
};

// The user's channels, in their order.
const CHANNEL_ORDER = ['bluesky', 'x', 'onlyfans', 'instagram'];

const keyOf = (draft: PostDraft, channelId: string) => versionOfChannel(draft, channelId)!.key;

const toggle = (key: string, channelId: string): PostDraftAction => ({
  type: 'toggleChannel',
  key,
  channelId,
  channelOrder: CHANNEL_ORDER,
});

describe('postDraftReducer', () => {
  it('saves an untouched draft as its seed, so Save stays off', () => {
    const seed = postData(draftFromPost(post), post.postedAt);
    const draft = postDraftReducer(draftFromPost(post), { type: 'select', key: 'main' });
    expect(postData(draft, post.postedAt)).toEqual(seed);
    expect(seed.channelPosts.map((copy) => copy.id)).toEqual(['c1', 'c2']);
  });

  it("gives a channel a version of its own, a copy of the shown version's cards with fresh refs, and selects it", () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, { type: 'select', key: keyOf(draft, 'onlyfans') });
    draft = postDraftReducer(draft, { type: 'newVersion', channelId: 'instagram', channelOrder: CHANNEL_ORDER });
    const added = draft.others.at(-1)!;
    expect(draft.selectedKey).toBe(added.key);
    expect(added).toMatchObject({ id: null, channelIds: ['instagram'] });
    expect(added.cards.map((card) => [card.id, card.text])).toEqual([
      [null, 'The whole run'],
      [null, 'Uncut'],
    ]);
    expect(added.cards[0]!.postAssets[0]!.id).not.toBe('e3');
    expect(new Set([draft.main.key, ...draft.others.map((other) => other.key)]).size).toBe(4);
  });

  it('a new version takes its channel off the version it was on', () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, toggle(keyOf(draft, 'onlyfans'), 'patreon'));
    draft = postDraftReducer(draft, { type: 'newVersion', channelId: 'patreon', channelOrder: CHANNEL_ORDER });
    expect(draft.others.find((other) => other.channelIds.includes('onlyfans'))!.channelIds).toEqual(['onlyfans']);
    expect(draft.others.at(-1)!.channelIds).toEqual(['patreon']);
  });

  it('a new version replaces the version that had only its channel', () => {
    let draft = draftFromPost(post, 'c1');
    draft = postDraftReducer(draft, { type: 'newVersion', channelId: 'bluesky', channelOrder: CHANNEL_ORDER });
    const saved = postData(draft, post.postedAt);
    expect(saved.channelPosts.map(({ id, channelIds, text }) => [id, channelIds, text])).toEqual([
      ['c1', ['onlyfans'], 'The whole run'],
      [null, ['bluesky'], 'The whole run'],
    ]);
  });

  it("a new version for the shown version's only channel throws", () => {
    const draft = draftFromPost(post);
    expect(() =>
      postDraftReducer(draft, { type: 'newVersion', channelId: 'x', channelOrder: CHANNEL_ORDER }),
    ).toThrow();
  });

  it('edits only the version it is given', () => {
    let draft = draftFromPost(post);
    const key = keyOf(draft, 'bluesky');
    const cardKey = draft.others[1]!.cards[0]!.key;
    draft = postDraftReducer(draft, {
      type: 'channel',
      key,
      action: { type: 'updateCard', key: cardKey, changes: { text: 'Edited' } },
    });
    draft = postDraftReducer(draft, {
      type: 'channel',
      key,
      action: { type: 'toggleChannel', channelId: 'instagram' },
    });
    const saved = postData(draft, post.postedAt);
    expect(saved.text).toBe('Sunrise on the ridge');
    expect(saved.channelPosts.map(({ channelIds, text }) => [channelIds, text])).toEqual([
      [['onlyfans'], 'The whole run'],
      [['bluesky', 'instagram'], 'Edited'],
    ]);
  });

  it('ticking a channel appends it to the version, and unticking takes it off', () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, toggle('main', 'instagram'));
    draft = postDraftReducer(draft, toggle('main', 'patreon'));
    expect(postData(draft, post.postedAt).channelIds).toEqual(['x', 'instagram', 'patreon']);
    draft = postDraftReducer(draft, toggle('main', 'x'));
    expect(postData(draft, post.postedAt).channelIds).toEqual(['instagram', 'patreon']);
  });

  it('ticking a channel of another version moves it here and keeps this version shown', () => {
    let draft = draftFromPost(post);
    const shared = keyOf(draft, 'onlyfans');
    draft = postDraftReducer(draft, toggle(shared, 'patreon'));
    draft = postDraftReducer(draft, toggle('main', 'patreon'));
    expect(draft.selectedKey).toBe('main');
    expect(postData(draft, post.postedAt).channelIds).toEqual(['x', 'patreon']);
    expect(draft.others.find((other) => other.key === shared)!.channelIds).toEqual(['onlyfans']);
  });

  it('ticking a channel alone on another version removes that version', () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, toggle('main', 'bluesky'));
    const saved = postData(draft, post.postedAt);
    expect(saved.channelIds).toEqual(['x', 'bluesky']);
    expect(saved.channelPosts.map((copy) => copy.id)).toEqual(['c1']);
  });

  it("keeping a channel unticks the version's others, takes it off the version it was on, and keeps this version shown", () => {
    let draft = draftFromPost(post);
    const onlyFans = keyOf(draft, 'onlyfans');
    draft = postDraftReducer(draft, toggle('main', 'instagram'));
    draft = postDraftReducer(draft, toggle(onlyFans, 'patreon'));
    draft = postDraftReducer(draft, {
      type: 'keepChannel',
      key: 'main',
      channelId: 'patreon',
      channelOrder: CHANNEL_ORDER,
    });
    expect(draft.selectedKey).toBe('main');
    const saved = postData(draft, post.postedAt);
    expect(saved.channelIds).toEqual(['patreon']);
    expect(saved.channelPosts.map(({ channelIds }) => channelIds)).toEqual([['onlyfans'], ['bluesky']]);
  });

  it("unticking a version's last channel throws", () => {
    const draft = draftFromPost(post);
    expect(() => postDraftReducer(draft, toggle('main', 'x'))).toThrow();
  });

  it("removes another version and selects the post's own, first in bar order", () => {
    let draft = draftFromPost(post, 'c1');
    draft = postDraftReducer(draft, {
      type: 'removeVersion',
      key: keyOf(draft, 'onlyfans'),
      channelOrder: CHANNEL_ORDER,
    });
    expect(draft.selectedKey).toBe(draft.main.key);
    expect(postData(draft, post.postedAt).channelPosts.map((copy) => copy.id)).toEqual(['c2']);
  });

  it("removing the post's own version saves the next version in bar order as the post, with new thread posts and refs, and drops its copy", () => {
    let draft = draftFromPost(post);
    // Bluesky goes first, so OnlyFans, which has a thread, is next after X.
    draft = postDraftReducer(draft, {
      type: 'removeVersion',
      key: keyOf(draft, 'bluesky'),
      channelOrder: CHANNEL_ORDER,
    });
    draft = postDraftReducer(draft, { type: 'removeVersion', key: 'main', channelOrder: CHANNEL_ORDER });
    expect(draft.selectedKey).toBe(draft.main.key);
    const saved = postData(draft, post.postedAt);
    expect(saved).toMatchObject({ channelIds: ['onlyfans'], text: 'The whole run', channelPosts: [] });
    expect(saved.threadPosts).toEqual([
      { id: null, text: 'Uncut', assetRefs: [expect.objectContaining({ assetId: 'a2' })] },
    ]);
    expect(saved.threadPosts[0]!.assetRefs[0]!.id).not.toBe('e4');
    expect(saved.assetRefs.map((ref) => ref.assetId)).toEqual(['a1']);
    expect(saved.assetRefs[0]!.id).not.toBe('e3');
  });

  it("promotes the first other channel in the user's order, not the first stored", () => {
    let draft = draftFromPost(post);
    draft = postDraftReducer(draft, { type: 'removeVersion', key: 'main', channelOrder: CHANNEL_ORDER });
    const saved = postData(draft, post.postedAt);
    expect(saved).toMatchObject({ channelIds: ['bluesky'], text: 'Ridge at dawn' });
    expect(saved.channelPosts.map((copy) => copy.id)).toEqual(['c1']);
  });

  it("opens on the channel saved as the given copy, and on the post's own for an id it doesn't have", () => {
    const draft = draftFromPost(post, 'c2');
    expect(draft.selectedKey).toBe(keyOf(draft, 'bluesky'));
    expect(draftFromPost(post, 'gone').selectedKey).toBe('main');
  });
});
