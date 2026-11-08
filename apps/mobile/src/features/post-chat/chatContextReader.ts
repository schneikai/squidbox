import { CHAT_LIMITS } from '@squidbox/shared';

import chatMentions from './chatMentions';
import type { ChatSession, ContextReader } from './chatSessions';
import postTags from './postTags';
import type { Mentions } from './useMentions';

import type { AssetTagging } from '@/features/photo-tags/useAssetTags';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';

type ContextSources = { tagging: Pick<AssetTagging, 'taggingAsync' | 'rows'>; found: Mentions | undefined };

/**
 * How the chat `session` reads what a turn is about (a ContextReader): it waits for the photos being
 * tagged, then takes the editor's latest caption and assets, the post's tags (their tags, read again
 * once a tagging under way landed, with the card's edits: postTags) and the handles found in their
 * albums' posts with the Mentions sheet's edits (chatMentions). `getSources()` gives the photos'
 * tagging and the found handles as of the latest render; they are read again after the wait.
 */
export default function chatContextReader(session: ChatSession, getSources: () => ContextSources): ContextReader {
  return async (signal, onWait) => {
    const hasWaited = await getSources().tagging.taggingAsync(onWait);
    if (signal.aborted) throw new Error('The turn was dropped');
    const {
      tagging: { rows: taggedRows },
      found,
    } = getSources();
    const { text, assets } = session.getDraft();
    const { kind, tagEdits, mentionEdits } = session.getState();
    const ids = assets.map((asset) => asset.id);
    const isCurrent = taggedRows?.length === ids.length && ids.every((id, index) => taggedRows[index].id === id);
    const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : taggedRows;
    return {
      kind,
      text: text.slice(0, CHAT_LIMITS.text),
      media: countMediaTypes(assets),
      tags: postTags(rows, tagEdits).slice(0, CHAT_LIMITS.tags),
      mentions: found ? chatMentions(found.handles, mentionEdits) : [],
    };
  };
}
