import { CHAT_LIMITS } from '@squidbox/shared';

import type { ChatSession, ContextReader } from './chatSessions';
import postTags from './postTags';
import sentMentions from './sentMentions';
import type { Mentions } from './useMentions';

import type { AssetTagging } from '@/features/photo-tags/useAssetTags';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';

type ContextSources = { tagging: Pick<AssetTagging, 'taggingAsync'>; found: Mentions | undefined };

/**
 * How the chat `session` reads what a turn is about (a ContextReader): it waits for the photos being
 * tagged, then takes the editor's latest caption and assets, the post's tags (their tags as saved,
 * with the card's edits: postTags) and the handles it sends (sentMentions). `getSources()` gives the
 * photos' tagging and the handles found in their albums' posts as of the latest render; they are read
 * again after the wait.
 */
export default function chatContextReader(session: ChatSession, getSources: () => ContextSources): ContextReader {
  return async (signal, onWait) => {
    await getSources().tagging.taggingAsync(onWait);
    if (signal.aborted) throw new Error('The turn was dropped');
    const { found } = getSources();
    const { text, assets } = session.getDraft();
    const { kind, tagEdits, mentionEdits } = session.getState();
    // Read here: the render's rows can be a moment behind tags already saved.
    const rows = await readLiveAssets(
      getDb(),
      assets.map((asset) => asset.id),
    );
    return {
      kind,
      text: text.slice(0, CHAT_LIMITS.text),
      media: countMediaTypes(assets),
      tags: postTags(rows, tagEdits).slice(0, CHAT_LIMITS.tags),
      mentions: sentMentions(found, mentionEdits),
    };
  };
}
