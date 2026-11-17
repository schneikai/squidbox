import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import ChannelCopyCard from './ChannelCopyCard';
import useCopyActions from './useCopyActions';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import MenuButton from '@/components/MenuButton';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import ChannelLogo from '@/features/channels/ChannelLogo';
import useMentionSheet from '@/features/post-mentions/useMentionSheet';
import useMentionedContacts from '@/features/post-mentions/useMentionedContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout, sizes } from '@/styles/designTokens';
import readChannelCopies, { channelCopiesTables, type ChannelCopy } from '@/sync/queries/readChannelCopies';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * Send to channels, a sheet over a post: a card for each of the user's channels, in their order, then
 * the sent and saved copies of channels no longer among them (ChannelCopyCard, readChannelCopies; a
 * channel this build doesn't know is left out). A card shows the post and its thread as they are now
 * until it is saved in its composer (ChannelCopyScreen, pushed in the sheet) or sent; a tap on a card
 * opens it as it goes out (ChannelCopyViewScreen). Remove takes the channel off the post; + (there
 * only once a card was removed) brings it back. At the bottom, Send all with two or more unsent cards
 * (it only marks them sent), Send to <channel> with one (its Send now), nothing with none. A post
 * deleted meanwhile closes the sheet.
 */
export default function SendToChannelsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const navigation = useNavigation();
  const read = useLiveQuery((db) => readChannelCopies(db, postId), channelCopiesTables, [postId]);
  const { contactsById, isRead: areContactsRead } = useMentionedContacts(read?.copies.flatMap((copy) => copy.posts));
  const { onPressMention, sheet } = useMentionSheet(contactsById);
  const { sendNow, sendAll, markNotSent, discardChanges, remove, addBack } = useCopyActions();
  const padding = useScreenPadding('sheet');
  const actionPadding = useFloatingPrimaryActionPadding();
  useCloseWhenGone(read, 'This post was deleted');

  const copies = read?.copies ?? [];
  const unsent = copies.filter((copy) => copy.sentAt === null);

  function editCopy(copy: ChannelCopy) {
    router.navigate({
      pathname: '/send-to-channels/[postId]/copies/[copyId]/edit',
      params: { postId, copyId: copy.id },
    });
  }

  function openCopy(copy: ChannelCopy) {
    router.navigate({ pathname: '/send-to-channels/[postId]/copies/[copyId]', params: { postId, copyId: copy.id } });
  }

  // The cards show once their chips' contacts are read: their handles and warnings don't move in.
  if (!read || !areContactsRead) return null;

  const bottomAction =
    unsent.length > 1 ? (
      <Button variant="primary" label="Send all" onPress={() => sendAll(unsent)} />
    ) : unsent.length === 1 ? (
      <Button variant="primary" label={`Send to ${unsent[0]!.channel.name}`} onPress={() => sendNow(unsent[0]!)} />
    ) : null;

  return (
    <ModalSheet testID="send-to-channels-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Send to channels"
        trailing={
          read.addable.length > 0 && (
            <MenuButton variant="primary" icon="add" accessibilityLabel="Add channel" title="Add channel">
              {read.addable.map((channel) => (
                <MenuOption
                  key={channel.id}
                  label={channel.name}
                  trailing={<ChannelLogo channelId={channel.id} size={sizes.menuIcon} />}
                  onPress={() => addBack(postId, channel.id)}
                />
              ))}
            </MenuButton>
          )
        }
      />
      {copies.length === 0 ? (
        <View style={[styles.empty, padding]}>
          <EmptyState
            icon="send"
            title="Send this post to your channels"
            subtitle={
              !read.hasChannels
                ? 'Add your channels in Settings → Posts → Channels first.'
                : 'Add a channel with + to get a copy of the post for it. Change it if you like, then send.'
            }
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            padding,
            bottomAction && { paddingBottom: Math.max(padding.paddingBottom, actionPadding) },
          ]}
        >
          {copies.map((copy) => (
            <ChannelCopyCard
              key={copy.id}
              copy={copy}
              contactsById={contactsById}
              onPressMention={onPressMention}
              onOpen={() => openCopy(copy)}
              onSendNow={() => sendNow(copy)}
              onEdit={() => editCopy(copy)}
              onDiscardChanges={() => discardChanges(copy)}
              onRemove={() => remove(copy)}
              onMarkNotSent={() => markNotSent(copy)}
            />
          ))}
        </ScrollView>
      )}
      {bottomAction && <FloatingPrimaryAction>{bottomAction}</FloatingPrimaryAction>}
      {sheet}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: layout.sideGutter,
    gap: layout.cardGap,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.sideGutter,
  },
});
