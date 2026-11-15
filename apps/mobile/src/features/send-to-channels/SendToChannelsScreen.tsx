import { channelById, type Channel } from '@squidbox/shared';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import ChannelCopyCard from './ChannelCopyCard';
import useSendCopies from './useSendCopies';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import MenuButton from '@/components/MenuButton';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import ChannelLogo from '@/features/channels/ChannelLogo';
import usePost from '@/features/post-list/usePost';
import useMentionSheet from '@/features/post-mentions/useMentionSheet';
import useMentionedContacts from '@/features/post-mentions/useMentionedContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import usePosts from '@/providers/posts/usePosts';
import { layout, sizes } from '@/styles/designTokens';
import readChannelCopies, { channelCopiesTables, type ChannelCopy } from '@/sync/queries/readChannelCopies';
import { useLiveQuery } from '@/sync/useLiveQuery';
import confirmRemoveAsync from '@/utils/confirmRemoveAsync';

/**
 * Send to channels, a sheet over a post: a card for each of the user's channels, in their order, then
 * the copies of channels no longer among them (ChannelCopyCard, readChannelCopies; a channel this
 * build doesn't know is left out). A card the user hasn't touched shows the post and its thread as
 * they are now; Edit's Save, Send now, Send all or Remove stores it as the channel's own copy. Each
 * is composed like a post on its own screen pushed in the sheet (ChannelCopyScreen), a tap on a card
 * opening it as it goes out (ChannelCopyViewScreen). Remove keeps the channel's card away from the
 * post; + (there only once a card was removed) brings it back, filled from the post as it is then.
 * At the bottom, Send all with two or more unsent cards (it only marks them sent), Send to <channel>
 * with one (its Send now), nothing with none. A post deleted meanwhile closes the sheet.
 */
export default function SendToChannelsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const navigation = useNavigation();
  const post = usePost(postId);
  const read = useLiveQuery((db) => readChannelCopies(db, postId), channelCopiesTables(postId), [postId]);
  const { contactsById, isRead: areContactsRead } = useMentionedContacts(read?.copies.flatMap((copy) => copy.posts));
  const { onPressMention, sheet } = useMentionSheet(contactsById);
  const { sendNow, sendAll } = useSendCopies();
  const { addPostCopy, removePostCopy, setPostCopiesSent } = usePosts();
  const padding = useScreenPadding('sheet');
  const actionPadding = useFloatingPrimaryActionPadding();
  useCloseWhenGone(post, 'This post was deleted');

  const shown = (read?.copies ?? []).flatMap((copy) => {
    const channel = channelById(copy.channelId);
    return channel ? [{ copy, channel }] : [];
  });
  const addable = (read?.addableChannelIds ?? []).flatMap((channelId) => channelById(channelId) ?? []);
  const unsent = shown.filter(({ copy }) => copy.sentAt === null);
  const hasNoChannels = shown.length === 0 && addable.length === 0;

  function editCopy(copy: ChannelCopy) {
    router.navigate({
      pathname: '/send-to-channels/[postId]/copies/[copyId]/edit',
      params: { postId, copyId: copy.id },
    });
  }

  function openCopy(copy: ChannelCopy) {
    router.navigate({ pathname: '/send-to-channels/[postId]/copies/[copyId]', params: { postId, copyId: copy.id } });
  }

  async function removeCopy(copy: ChannelCopy, channel: Channel) {
    if (await confirmRemoveAsync(`this ${channel.name} copy`)) await removePostCopy(copy);
  }

  // The cards show once their chips' contacts are read: their handles and warnings don't move in.
  if (!post || !read || !areContactsRead) return null;

  const bottomAction =
    unsent.length > 1 ? (
      <Button variant="primary" label="Send all" onPress={() => sendAll(unsent.map(({ copy }) => copy))} />
    ) : unsent.length === 1 ? (
      <Button
        variant="primary"
        label={`Send to ${unsent[0]!.channel.name}`}
        onPress={() => sendNow(unsent[0]!.copy, unsent[0]!.channel)}
      />
    ) : null;

  return (
    <ModalSheet testID="send-to-channels-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Send to channels"
        trailing={
          addable.length > 0 && (
            <MenuButton variant="primary" icon="add" accessibilityLabel="Add channel" title="Add channel">
              {addable.map((channel) => (
                <MenuOption
                  key={channel.id}
                  label={channel.name}
                  trailing={<ChannelLogo channelId={channel.id} size={sizes.menuIcon} />}
                  onPress={() => addPostCopy(postId, channel.id)}
                />
              ))}
            </MenuButton>
          )
        }
      />
      {shown.length === 0 ? (
        <View style={[styles.empty, padding]}>
          <EmptyState
            icon="send"
            title="Send this post to your channels"
            subtitle={
              hasNoChannels
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
          {shown.map(({ copy, channel }) => (
            <ChannelCopyCard
              key={copy.id}
              copy={copy}
              channel={channel}
              contactsById={contactsById}
              onPressMention={onPressMention}
              onOpen={() => openCopy(copy)}
              onSendNow={() => sendNow(copy, channel)}
              onEdit={() => editCopy(copy)}
              onRemove={() => removeCopy(copy, channel)}
              onMarkNotSent={() => setPostCopiesSent([copy], null)}
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
