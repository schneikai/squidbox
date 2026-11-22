import { Text as RNText, StyleSheet, View } from 'react-native';

import channelPayload from './channelPayload';
import copySentText from './copySentText';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import ChannelLogo from '@/features/channels/ChannelLogo';
import NoThreadsNote from '@/features/channels/NoThreadsNote';
import MentionText from '@/features/post-mentions/MentionText';
import MissingHandleNote from '@/features/post-mentions/MissingHandleNote';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import PostRowCard from '@/features/posts/PostRowCard';
import threadLabel from '@/lib/threadLabel';
import { layout, sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { ChannelCopy } from '@/sync/queries/readChannelCopies';

type ChannelCopyCardProps = {
  copy: ChannelCopy;
  contactsById: ReadonlyMap<string, MentionContact>;
  onPressMention: (contactId: string) => void;
  onOpen: () => void;
  onSendNow: () => void;
  onEdit: () => void;
  onDiscardChanges: () => void;
  onRemove: () => void;
  onMarkNotSent: () => void;
};

/**
 * A post's card for one channel (its stored copy, or an untouched card that shows the post), as a row card: its first post's first picture, the channel's logo
 * and name, its text as the channel gets it (each mention as the contact's handle there, MentionText)
 * and, for a thread, its size. Unsent, it warns about the contacts without a handle there (their
 * names go out as plain text, with Add handle: MissingHandleNote) and, for a thread on a channel
 * without threads, that it goes out as one post (NoThreadsNote); it has Send now and Edit, and Remove in the ⋯ beside them; saved in
 * its composer, it says Edited and has Discard changes in its ⋯ (it shows the post again); sent, it
 * is locked: when it was sent, and Mark as not sent in its ⋯. A tap on the card opens the copy
 * (`onOpen`: all of its posts and pictures).
 */
export default function ChannelCopyCard({
  copy,
  contactsById,
  onPressMention,
  onOpen,
  onSendNow,
  onEdit,
  onDiscardChanges,
  onRemove,
  onMarkNotSent,
}: ChannelCopyCardProps) {
  const { channel } = copy;
  const [first] = copy.posts;
  const [asset, ...more] = first?.assets ?? [];
  const isSent = copy.sentAt !== null;
  const isEdited = !isSent && !copy.showsPost;
  const { missing } = channelPayload(channel, copy.posts, contactsById);

  return (
    <PostRowCard asset={asset} moreCount={more.length} onPress={onOpen} openLabel={`Open the ${channel.name} copy`}>
      <View testID="channel-copy-card" accessibilityLabel={`${channel.name} copy`} style={styles.body}>
        <View style={styles.channel}>
          <ChannelLogo channelId={channel.id} size={sizes.menuIcon} />
          <Text variant="label">{channel.name}</Text>
          {isEdited && <Badge label="Edited" tone="info" />}
        </View>
        {first && (
          <MentionText value={first} contactsById={contactsById} channel={channel} onPressMention={onPressMention} />
        )}
        {copy.posts.length > 1 && <RNText style={listTextStyles.caption}>{threadLabel(copy.posts.length)}</RNText>}
        {!isSent && <NoThreadsNote postCount={copy.posts.length} channel={channel} />}
        {!isSent && <MissingHandleNote contacts={missing} channel={channel} />}
        <View style={styles.actions}>
          {copy.sentAt !== null ? (
            <Text variant="hint">{copySentText(copy.sentAt)}</Text>
          ) : (
            <>
              <Button variant="primary" size="small" label="Send now" onPress={onSendNow} />
              <Button variant="secondary" size="small" label="Edit" onPress={onEdit} />
            </>
          )}
          <MenuButton size="small" accessibilityLabel={`${channel.name} copy options`} style={styles.menu}>
            {isSent ? (
              <MenuOption label="Mark as not sent" icon="undo" onPress={onMarkNotSent} />
            ) : (
              <>
                {isEdited && <MenuOption label="Discard changes" icon="undo" onPress={onDiscardChanges} />}
                <MenuOption label="Remove" icon="trash" colorPalette="danger" onPress={onRemove} />
              </>
            )}
          </MenuButton>
        </View>
      </View>
    </PostRowCard>
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
  menu: {
    marginLeft: 'auto',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: layout.cardGap,
  },
});
