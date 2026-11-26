import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { type ComponentRef, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import ChannelCopyCard from './ChannelCopyCard';
import useCopyActions from './useCopyActions';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import MenuButton from '@/components/MenuButton';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
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
 * opens it as it goes out (ChannelCopyViewScreen). Remove takes the channel off the post; + on the right (there
 * only once a card was removed) brings it back, from a menu of the removed channels or, with one, at once, and
 * scrolls to its card. At the bottom, the screen's one primary action: Send all with
 * two or more unsent cards (it only marks them sent), Send to <channel> with one (that card then has no Send
 * now of its own), nothing with none. A post deleted meanwhile closes the sheet. Every change saves as it is
 * made, so × on the left closes the sheet like every sheet that is not a draft (HIG: Close closes a modal
 * view; Done is for a sheet whose task it completes).
 */
export default function SendToChannelsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const navigation = useNavigation();
  const read = useLiveQuery((db) => readChannelCopies(db, postId), channelCopiesTables, [postId]);
  const { contactsById, isRead: areContactsRead } = useMentionedContacts(read?.copies.flatMap((copy) => copy.posts));
  const { onPressMention, sheet } = useMentionSheet(contactsById);
  const { sendNow, sendAll, markNotSent, discardChanges, remove, addBack } = useCopyActions();
  const padding = useScreenPadding('sheet');
  const { paddingBottom: actionPadding } = useScreenPadding('sheet', { bottomBar: true });
  useCloseWhenGone(read, 'This post was deleted');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // The channel just added back: its card scrolls into view once it is laid out.
  const addedChannelId = useRef<string | null>(null);

  const copies = read?.copies ?? [];
  const unsent = copies.filter((copy) => copy.sentAt === null);

  function editCopy(copy: ChannelCopy) {
    router.navigate({
      pathname: '/send-to-channels/[postId]/copies/[copyId]/edit',
      params: { postId, copyId: copy.id },
    });
  }

  function addChannel(channelId: string) {
    addedChannelId.current = channelId;
    return addBack(postId, channelId);
  }

  function handleCardLayout(copy: ChannelCopy, event: LayoutChangeEvent) {
    if (copy.channel.id !== addedChannelId.current) return;
    addedChannelId.current = null;
    scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - padding.paddingTop) });
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
          read.addable.length === 1 ? (
            <Button
              icon="add"
              accessibilityLabel={`Add ${read.addable[0]!.name}`}
              onPress={() => addChannel(read.addable[0]!.id)}
            />
          ) : read.addable.length > 1 ? (
            <MenuButton icon="add" accessibilityLabel="Add channel" title="Add channel">
              {read.addable.map((channel) => (
                <MenuOption
                  key={channel.id}
                  label={channel.name}
                  trailing={<ChannelLogo channelId={channel.id} size={sizes.menuIcon} />}
                  onPress={() => addChannel(channel.id)}
                />
              ))}
            </MenuButton>
          ) : undefined
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
          ref={scrollRef}
          contentContainerStyle={[styles.list, padding, bottomAction && { paddingBottom: actionPadding }]}
        >
          {copies.map((copy) => (
            <View key={copy.id} onLayout={(event) => handleCardLayout(copy, event)}>
              <ChannelCopyCard
                copy={copy}
                contactsById={contactsById}
                onPressMention={onPressMention}
                onOpen={() => openCopy(copy)}
                onSendNow={unsent.length > 1 ? () => sendNow(copy) : undefined}
                onEdit={() => editCopy(copy)}
                onDiscardChanges={() => discardChanges(copy)}
                onRemove={() => remove(copy)}
                onMarkNotSent={() => markNotSent(copy)}
              />
            </View>
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
