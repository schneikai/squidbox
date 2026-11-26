import { StyleSheet, View } from 'react-native';

import channelPayload from './channelPayload';
import copySentText from './copySentText';
import postsSentTo from './postsSentTo';

import Badge from '@/components/Badge';
import MenuButton from '@/components/MenuButton';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import ChannelLogo from '@/features/channels/ChannelLogo';
import MentionText from '@/features/post-mentions/MentionText';
import MissingHandleNote from '@/features/post-mentions/MissingHandleNote';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import PostRowCard from '@/features/posts/PostRowCard';
import threadLabel from '@/lib/threadLabel';
import { layout, sizes } from '@/styles/designTokens';
import type { ChannelCopy } from '@/sync/queries/readChannelCopies';

type ChannelCopyCardProps = {
  copy: ChannelCopy;
  contactsById: ReadonlyMap<string, MentionContact>;
  onPressMention: (contactId: string) => void;
  /** A tap on a sent card: the copy as it went out. */
  onOpen: () => void;
  /** A tap on an unsent card: its composer. */
  onEdit: () => void;
  /** Left out when the sheet's own bottom action sends this copy. */
  onSendNow?: () => void;
  onDiscardChanges: () => void;
  onRemove: () => void;
  onMarkNotSent: () => void;
};

/**
 * A post's card for one channel (its stored copy, or an untouched card that shows the post), as a row card: its first post's first picture, the channel's logo
 * and name with the card's ⋯ at its end, its text as the channel gets it (each mention as the contact's handle there, MentionText)
 * and, for a thread it sends, its size on a line of its own (a channel without threads gets only the first post,
 * postsSentTo). Unsent, it warns at its bottom, across the card, about the contacts without a handle there (their
 * names go out as plain text, with Add handle: MissingHandleNote); a tap opens its composer (`onEdit`), and its ⋯ has Send now
 * (unless the sheet's bottom action is its Send now) and Remove; saved in its composer, it says Edited and its ⋯ also has
 * Discard changes (it shows the post again). Sent, it is locked: when it was sent on the line under the size, Mark as not
 * sent in its ⋯, and a tap opens the copy as it went out (`onOpen`: all of its posts and pictures).
 */
export default function ChannelCopyCard({
  copy,
  contactsById,
  onPressMention,
  onOpen,
  onEdit,
  onSendNow,
  onDiscardChanges,
  onRemove,
  onMarkNotSent,
}: ChannelCopyCardProps) {
  const { channel } = copy;
  const [first] = copy.posts;
  const [asset, ...more] = first?.assets ?? [];
  const isSent = copy.sentAt !== null;
  const isEdited = !isSent && !copy.showsPost;
  const sentCount = postsSentTo(channel, copy.posts).length;
  const threadText = sentCount > 1 ? threadLabel(sentCount) : null;
  const { missing } = channelPayload(channel, copy.posts, contactsById);

  return (
    <View testID="channel-copy-card" accessibilityLabel={`${channel.name} copy`}>
      <PostRowCard
        asset={asset}
        moreCount={more.length}
        onPress={isSent ? onOpen : onEdit}
        openLabel={isSent ? `Open the ${channel.name} copy` : `Edit the ${channel.name} copy`}
        footer={!isSent && missing.length > 0 && <MissingHandleNote contacts={missing} channel={channel} />}
      >
        <View style={styles.body}>
          <View style={styles.channel}>
            <ChannelLogo channelId={channel.id} size={sizes.menuIcon} />
            <Text variant="label">{channel.name}</Text>
            {isEdited && <Badge label="Edited" tone="info" />}
            <MenuButton size="small" accessibilityLabel={`${channel.name} copy options`} style={styles.menu}>
              {isSent ? (
                <MenuOption label="Mark as not sent" icon="undo" onPress={onMarkNotSent} />
              ) : (
                <>
                  {onSendNow && <MenuOption label="Send now" icon="send" onPress={onSendNow} />}
                  {isEdited && <MenuOption label="Discard changes" icon="undo" onPress={onDiscardChanges} />}
                  <MenuOption label="Remove" icon="trash" colorPalette="danger" onPress={onRemove} />
                </>
              )}
            </MenuButton>
          </View>
          {first && (
            <MentionText value={first} contactsById={contactsById} channel={channel} onPressMention={onPressMention} />
          )}
          {(threadText || copy.sentAt !== null) && (
            <View>
              {threadText && <Text variant="meta">{threadText}</Text>}
              {copy.sentAt !== null && <Text variant="meta">{copySentText(copy.sentAt)}</Text>}
            </View>
          )}
        </View>
      </PostRowCard>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: layout.cardGap,
  },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
  },
  // The ⋯ sits at the row's end without making the row taller than its label.
  menu: {
    marginLeft: 'auto',
    marginVertical: -layout.iconGap,
  },
});
