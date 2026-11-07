import { useState } from 'react';

import ChatMentionsSheet from './ChatMentionsSheet';
import EditableLine from './EditableLine';
import type { LiveChat } from './useChatSession';
import type { Mentions } from './useMentions';

// The handles the card names; the sheet has them all.
const SHOWN = 5;

type MentionsRowProps = { mentions: Mentions; from: string; onEditMentions: LiveChat['editMentions'] };

/**
 * The handles the chat may mention (`mentions`, usePostChat's), as a grey line on its card, "from"
 * where they come (`from`); a tap opens ChatMentionsSheet to edit them (`onEditMentions`).
 */
export default function MentionsRow({ mentions, from, onEditMentions }: MentionsRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { handles } = mentions;

  return (
    <>
      <EditableLine label="Mentions" editHint="Edits the mentions" onPress={() => setIsEditing(true)}>
        {handles.length > 0 ? `${handles.slice(0, SHOWN).join(', ')} from ${from}` : 'none'}
      </EditableLine>
      <ChatMentionsSheet
        isVisible={isEditing}
        onClose={() => setIsEditing(false)}
        handles={handles}
        onEditMentions={onEditMentions}
      />
    </>
  );
}
