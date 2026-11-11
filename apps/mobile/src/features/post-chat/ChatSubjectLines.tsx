import ItSeesRow from './ItSeesRow';
import MentionsRow from './MentionsRow';
import fullAlbumName from './fullAlbumName';
import type { LiveChat } from './useChatSession';
import type { ChatTagging } from './useChatTags';
import type { Mentions } from './useMentions';

type ChatSubjectLinesProps = {
  assetIds: readonly string[];
  // useAssetAlbums' for the assets: where the handles come from is named after them.
  albums: readonly { name: string; heldCount: number | null }[] | undefined;
  tagging: ChatTagging;
  mentions: Mentions | undefined;
  chat: Pick<LiveChat, 'tagEdits' | 'editTags' | 'editMentions'>;
  // The assistant's quieter violet, inside its tray; grey on the chat's card.
  tone?: 'accentSoft';
};

/**
 * What the assistant goes on, as lines a tap edits: what it sees in the photos (ItSeesRow, from
 * `tagging`, with the chat's tag edits) and the handles it may mention (MentionsRow, `mentions`,
 * "from" the album holding every photo, your albums or your posts). The edits are the chat's
 * (`chat.editTags`, `chat.editMentions`), so the chat card and the tray show the same, and the next
 * turn sends it.
 */
export default function ChatSubjectLines({ assetIds, albums, tagging, mentions, chat, tone }: ChatSubjectLinesProps) {
  const albumName = fullAlbumName(albums, assetIds);
  // The handles come from every album holding any of the photos, so the album is named only when it
  // is the one.
  const mentionsFrom = mentions?.fromAlbum ? (albums?.length === 1 && albumName) || 'your albums' : 'your posts';

  return (
    <>
      {tagging.rows && tagging.rows.length > 0 && (
        <ItSeesRow
          rows={tagging.rows}
          attempts={tagging.attempts}
          isTagging={tagging.isTagging}
          untagged={tagging.untagged}
          tagEdits={chat.tagEdits}
          onEditTags={chat.editTags}
          onRetry={tagging.retry}
          tone={tone}
        />
      )}
      {mentions && (
        <MentionsRow mentions={mentions} from={mentionsFrom} onEditMentions={chat.editMentions} tone={tone} />
      )}
    </>
  );
}
