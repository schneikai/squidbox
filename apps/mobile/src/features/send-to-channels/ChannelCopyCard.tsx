import type { Channel } from '@squidbox/shared';
import { Text as RNText, StyleSheet, View } from 'react-native';

import channelPayload from './channelPayload';
import copySentText from './copySentText';

import Button from '@/components/Button';
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
import listTextStyles from '@/styles/listTextStyles';
import type { PostCopyWithAssets } from '@/sync/queries/readPostCopies';

type ChannelCopyCardProps = {
  copy: PostCopyWithAssets;
  channel: Pick<Channel, 'id' | 'name' | 'handleField'>;
  contactsById: ReadonlyMap<string, MentionContact>;
  onPressMention: (contactId: string) => void;
  onOpen: () => void;
  onSendNow: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMarkNotSent: () => void;
};

/**
 * A post's copy for one channel, as a row card: its first post's first picture, the channel's logo
 * and name, its text as the channel gets it (each mention as the contact's handle there, MentionText)
 * and, for a thread, its size. Unsent, it warns about the contacts without a handle there (their
 * names go out as plain text, with Add handle: MissingHandleNote) and has Send now and Edit, and Remove in its ⋯; sent, it
 * is locked: when it was sent, and Mark as not sent in its ⋯. A tap on the card opens the copy
 * (`onOpen`: all of its posts and pictures).
 */
export default function ChannelCopyCard({
  copy,
  channel,
  contactsById,
  onPressMention,
  onOpen,
  onSendNow,
  onEdit,
  onRemove,
  onMarkNotSent,
}: ChannelCopyCardProps) {
  const [first] = copy.posts;
  const [asset, ...more] = first?.assets ?? [];
  const isSent = copy.sentAt !== null;
  const { missing } = channelPayload(channel, copy.posts, contactsById);

  return (
    <PostRowCard asset={asset} moreCount={more.length} onPress={onOpen}>
      <View testID="channel-copy-card" accessibilityLabel={`${channel.name} copy`} style={styles.body}>
        <View style={styles.head}>
          <View style={styles.channel}>
            <ChannelLogo channelId={channel.id} size={sizes.menuIcon} />
            <Text variant="label">{channel.name}</Text>
          </View>
          <MenuButton size="small" accessibilityLabel={`${channel.name} copy options`} style={styles.menu}>
            {isSent ? (
              <MenuOption label="Mark as not sent" icon="undo" onPress={onMarkNotSent} />
            ) : (
              <MenuOption label="Remove" icon="trash" colorPalette="danger" onPress={onRemove} />
            )}
          </MenuButton>
        </View>
        {first && (
          <MentionText value={first} contactsById={contactsById} channel={channel} onPressMention={onPressMention} />
        )}
        {copy.posts.length > 1 && <RNText style={listTextStyles.caption}>{threadLabel(copy.posts.length)}</RNText>}
        {!isSent && <MissingHandleNote contacts={missing} channel={channel} />}
        {copy.sentAt !== null ? (
          <Text variant="hint">{copySentText(copy.sentAt)}</Text>
        ) : (
          <View style={styles.actions}>
            <Button variant="secondary" size="small" label="Send now" onPress={onSendNow} />
            <Button variant="secondary" size="small" label="Edit" onPress={onEdit} />
          </View>
        )}
      </View>
    </PostRowCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: layout.cardGap,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
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
