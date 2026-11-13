import { CHANNELS, type Channel } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import ChannelLogo from './ChannelLogo';
import channelRulesText from './channelRulesText';
import useChannels from './useChannels';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useHaptics from '@/hooks/useHaptics';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import { addChannel } from '@/sync/channelsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';

/**
 * Adds a channel to the user's list: the built-in channels not added yet, each its logo, name and
 * rules; a tap adds it at the end and closes the sheet.
 */
export default function AddChannelScreen() {
  const navigation = useNavigation();
  const channels = useChannels();
  const padding = useScreenPadding('sheet');
  const haptics = useHaptics();
  const isAddingRef = useRef(false);

  const added = new Set(channels?.map((channel) => channel.id));
  const left = CHANNELS.filter((channel) => !added.has(channel.id));

  // A second tap while the first adds (another row) would add that one too and go back twice.
  async function handleAdd(channel: Channel) {
    if (isAddingRef.current) return;
    isAddingRef.current = true;
    try {
      await addChannel(getDb(), channel);
      requestSync();
      navigation.goBack();
    } catch (error) {
      isAddingRef.current = false;
      console.error('Adding the channel failed', error);
      haptics.error();
    }
  }

  function renderContent() {
    if (!channels) return null;
    if (left.length === 0) return <EmptyState icon="check" title="All channels added" />;
    return (
      <Section>
        {left.map((channel) => (
          <Row
            key={channel.id}
            leading={<ChannelLogo channelId={channel.id} />}
            label={channel.name}
            description={channelRulesText(channel)}
            onPress={() => handleAdd(channel)}
          />
        ))}
      </Section>
    );
  }

  return (
    <ModalSheet testID="add-channel-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add channel"
      />
      <ScrollView contentContainerStyle={[styles.list, padding]}>{renderContent()}</ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: layout.sideGutter,
  },
});
