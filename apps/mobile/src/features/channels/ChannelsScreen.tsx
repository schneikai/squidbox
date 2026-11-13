import { CHANNELS, type Channel } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, { type DragEndParams } from 'react-native-draggable-flatlist';

import ChannelLogo from './ChannelLogo';
import useChannels from './useChannels';

import Button from '@/components/Button';
import DetailScrollView from '@/components/DetailScrollView';
import Divider from '@/components/Divider';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/Icon';
import MenuButton from '@/components/MenuButton';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useHaptics from '@/hooks/useHaptics';
import { colors, sizes, space } from '@/styles/designTokens';
import { moveChannel, removeChannel } from '@/sync/channelsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';

const ADD_CHANNEL = '/add-channel';

/**
 * Settings → Posts → Channels: the places the user posts to, in their order (the first is what a new
 * post starts as). Drag a row by its handle to move it; hold it for Delete. Saves as it goes.
 */
export default function ChannelsScreen() {
  const navigation = useNavigation();
  const channels = useChannels();
  const haptics = useHaptics();

  const canAdd = channels !== undefined && channels.length < CHANNELS.length;

  function handleDragEnd({ data, from, to }: DragEndParams<Channel>) {
    if (from === to) return;
    haptics.drop();
    const moved = data[to]!;
    const afterId = to === 0 ? null : data[to - 1]!.recordId;
    moveChannel(getDb(), moved.recordId, afterId).then(requestSync, (error) => {
      console.error('Moving the channel failed', error);
      haptics.error();
    });
  }

  function handleDelete(channel: Channel) {
    removeChannel(getDb(), channel).then(requestSync, (error) => {
      console.error('Deleting the channel failed', error);
      haptics.error();
    });
  }

  function renderContent() {
    if (!channels) return null;
    if (channels.length === 0) {
      return (
        <View style={styles.empty}>
          <EmptyState
            icon="layers"
            title="No channels yet"
            subtitle="Add the places you post to. A post can then have its own text and media for each channel."
          />
          <Button variant="primary" icon="add" label="Add channel" onPress={() => router.navigate(ADD_CHANNEL)} />
        </View>
      );
    }
    return (
      <Section>
        <DraggableFlatList
          data={channels}
          scrollEnabled={false}
          keyExtractor={(channel) => channel.id}
          onDragBegin={haptics.lift}
          onDragEnd={handleDragEnd}
          ItemSeparatorComponent={Divider}
          renderItem={({ item: channel, drag, isActive }) => (
            <ChannelRow channel={channel} onDrag={drag} isActive={isActive} onDelete={handleDelete} />
          )}
        />
        {canAdd && <AddRow label="Add channel" onPress={() => router.navigate(ADD_CHANNEL)} />}
      </Section>
    );
  }

  return (
    <Page testID="channels-screen">
      <FloatingDetailHeader title="Channels" onBack={() => navigation.goBack()} />
      <DetailScrollView>{renderContent()}</DetailScrollView>
    </Page>
  );
}

type ChannelRowProps = {
  channel: Channel;
  onDrag: () => void;
  isActive: boolean;
  onDelete: (channel: Channel) => void;
};

// A channel's row: its handle (a press on it starts the drag), its logo and name; a hold opens its menu.
function ChannelRow({ channel, onDrag, isActive, onDelete }: ChannelRowProps) {
  return (
    <MenuButton
      trigger={({ openFromLongPress }) => (
        <View style={isActive && styles.active}>
          <Row
            leading={[
              <Pressable
                key="grip"
                onPressIn={onDrag}
                hitSlop={space.sm}
                // No button role: the row is the button (its hold opens the menu), and a button can't hold one.
                accessibilityLabel={`Move ${channel.name}`}
              >
                <Icon name="grip" size={sizes.iconSmall} color={colors.text.tertiary} />
              </Pressable>,
              <ChannelLogo key="logo" channelId={channel.id} />,
            ]}
            label={channel.name}
            onLongPress={openFromLongPress}
          />
        </View>
      )}
    >
      <MenuOption label="Delete" icon="trash" colorPalette="danger" onPress={() => onDelete(channel)} />
    </MenuButton>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: space.md,
  },
  active: {
    backgroundColor: colors.background.surface,
  },
});
