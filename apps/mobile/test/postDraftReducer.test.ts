import { describe, expect, it } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import postDraftReducer, {
  draftFromPost,
  newChannelDraft,
  postData,
  usedChannelIds,
  type PostEditorPost,
} from '../src/features/posts/draft/postDraftReducer';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { readByIds } from '../src/sync/readByIds';

// Two asset rows, as readPost reads them.
const db = makeTestDb();
await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'a2' })]);
const [a1, a2] = await readByIds(db, schema.assets, ['a1', 'a2']);

// A post on X with a thread, and an OnlyFans copy.
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
      threadPosts: [],
    },
  ],
};

describe('postDraftReducer', () => {
  it('saves an untouched seed as the seed, so Save stays off', () => {
    const seed = postData(draftFromPost(post), post.postedAt);
    const draft = postDraftReducer(null, { type: 'seed', post })!;
    expect(postData(draft, post.postedAt)).toEqual(seed);
    expect(seed.channelPosts).toEqual([
      {
        id: 'c1',
        channelId: 'onlyfans',
        text: 'The whole run',
        assetRefs: [{ id: 'e3', assetId: 'a1' }],
        threadPosts: [],
      },
    ]);
  });

  it("starts a new channel as the first card's text and media with fresh refs, not its thread, on the next unused channel", () => {
    const draft = draftFromPost(post);
    const channel = newChannelDraft(draft, ['x', 'onlyfans', 'bluesky'])!;
    expect(channel.channelId).toBe('bluesky');
    expect(channel.id).toBeNull();
    expect(channel.cards).toHaveLength(1);
    expect(channel.cards[0]!.text).toBe('Sunrise on the ridge');
    expect(channel.cards[0]!.postAssets.map((postAsset) => postAsset.asset.id)).toEqual(['a1']);
    expect(channel.cards[0]!.postAssets[0]!.id).not.toBe('e1');
  });

  it('has no new channel when the post uses every one of the user’s', () => {
    expect(newChannelDraft(draftFromPost(post), ['onlyfans', 'x'])).toBeNull();
  });

  it('puts a channel back in place by its key, and a new one at the end under a key of its own', () => {
    let draft = draftFromPost(post);
    const added = newChannelDraft(draft, ['bluesky'])!;
    draft = postDraftReducer(draft, { type: 'putChannel', channel: added })!;
    expect(draft.others.map((other) => other.channelId)).toEqual(['onlyfans', 'bluesky']);
    const edited = { ...draft.others[0]!, cards: [{ ...draft.others[0]!.cards[0]!, text: 'Edited' }] };
    draft = postDraftReducer(draft, { type: 'putChannel', channel: edited })!;
    expect(draft.others.map((other) => other.cards[0]!.text)).toEqual(['Edited', 'Sunrise on the ridge']);
    expect(newChannelDraft(draft, ['threads'])!.key).not.toBe(added.key);
    draft = postDraftReducer(draft, { type: 'removeChannel', key: edited.key })!;
    expect([...usedChannelIds(draft, '')]).toEqual(['x', 'bluesky']);
  });
});
