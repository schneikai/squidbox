import { useState } from 'react';

import ChatMentionsSheet from './ChatMentionsSheet';
import EditableLine from './EditableLine';
import type { LiveChat } from './useChatSession';
import type { Mentions } from './useMentions';

// The contacts the card names; the sheet has them all.
const SHOWN = 5;

type MentionsRowProps = {
  mentions: Mentions;
  // The post's photos, whose contacts the sheet suggests first.
  assetIds: string[];
  from: string;
  onEditMentions: LiveChat['editMentions'];
  // The assistant's violet, inside its tray (EditableLine's).
  tone?: 'accentSoft';
};

/**
 * The contacts the chat may mention (`mentions`, usePostChat's), by name, as a grey line on its card,
 * "from" where they come (`from`); a tap opens ChatMentionsSheet to edit them (`onEditMentions`).
 */
export default function MentionsRow({ mentions, assetIds, from, onEditMentions, tone }: MentionsRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <EditableLine label="Mentions" editHint="Edits the mentions" onPress={() => setIsEditing(true)} tone={tone}>
        {mentions.length > 0
          ? `${mentions
              .slice(0, SHOWN)
              .map((contact) => contact.name)
              .join(', ')} from ${from}`
          : 'none'}
      </EditableLine>
      <ChatMentionsSheet
        isVisible={isEditing}
        onClose={() => setIsEditing(false)}
        mentions={mentions}
        assetIds={assetIds}
        onEditMentions={onEditMentions}
      />
    </>
  );
}
