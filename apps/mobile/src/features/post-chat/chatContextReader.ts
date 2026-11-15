import { CHAT_LIMITS, type ChatThread } from '@squidbox/shared';

import type { ChatDraftPost, ChatSession, ContextReader } from './chatSessions';
import chatTags from './chatTags';
import postTags from './postTags';
import readMentions from './readMentions';

import markedText, { type MentionCandidate } from '@/features/post-mentions/markedText';
import validMentions from '@/features/post-mentions/validMentions';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';

type ContextSources = {
  tagging: { tagMissingAsync: (ids: readonly string[], onWait?: () => void) => Promise<void> };
};

/**
 * How the chat `session` reads what a turn for the post `target` is about (a ContextReader), as the
 * posts are when it goes: it tags the photos never tagged and waits for them and any tagging under
 * way (`getSources()`'s tagging, as of the latest render), then takes the target post's text, and
 * over every post of the thread the media, the tags (their tags as saved, or the chat's own for a
 * photo never tagged: chatTags; with the card's edits: postTags) and the names of the contacts it
 * may mention (readMentions, as the chat card shows them, with the Mentions sheet's edits; each name
 * once); and in a thread, the posts' texts (threadWindow). The texts go with their chips as mention
 * markers (markedText.write), so a rewrite keeps them. It resolves to that context and the contacts
 * the reply's markers may name (`mentioned`): the Mentions, and those the posts' own chips mention
 * (`isInDraft`). A target no longer in the thread fails the turn.
 */
export default function chatContextReader(session: ChatSession, getSources: () => ContextSources): ContextReader {
  return async (signal, onWait, target) => {
    const toTag = session.getState().assets.map((asset) => asset.id);
    await getSources().tagging.tagMissingAsync(toTag, onWait);
    if (signal.aborted) throw new Error('The turn was dropped');
    const { posts } = session.getDraft();
    const { kind, assets, tagEdits, mentionEdits } = session.getState();
    const at = posts.findIndex((post) => post.key === target);
    if (at === -1) throw new Error('This post was removed');
    const assetIds = assets.map((asset) => asset.id);
    // Read here: the render's rows and contacts can be a moment behind the photos added or tagged.
    const [rows, mentions] = await Promise.all([
      readLiveAssets(getDb(), assetIds),
      readMentions(getDb(), assetIds, mentionEdits),
    ]);
    return {
      context: {
        kind,
        text: markedText.write(posts[at]!).slice(0, CHAT_LIMITS.text),
        media: countMediaTypes(assets),
        tags: postTags(chatTags.withTags(rows, chatTags.tags.get()), tagEdits).slice(0, CHAT_LIMITS.tags),
        mentions: [...new Set(mentions.map((contact) => contact.name))],
        ...(posts.length > 1 && { thread: threadWindow(posts, at) }),
      },
      mentioned: [...mentions.map(({ id, name }) => ({ id, name })), ...draftChips(posts)],
    };
  };
}

// The thread's texts as the context takes them: at most CHAT_LIMITS.threadPosts consecutive posts
// holding the one at `at` (the posts before it first), each cut to CHAT_LIMITS.text.
function threadWindow(posts: readonly ChatDraftPost[], at: number): ChatThread {
  const start = Math.max(0, Math.min(at - CHAT_LIMITS.threadPosts + 1, posts.length - CHAT_LIMITS.threadPosts));
  const window = posts.slice(start, start + CHAT_LIMITS.threadPosts);
  return { index: at - start, posts: window.map((post) => markedText.write(post).slice(0, CHAT_LIMITS.text)) };
}

// The contacts the posts' own chips mention, by the name each chip carries.
function draftChips(posts: readonly ChatDraftPost[]): MentionCandidate[] {
  return posts.flatMap((post) =>
    validMentions(post).map(({ contactId, name }) => ({ id: contactId, name, isInDraft: true })),
  );
}
