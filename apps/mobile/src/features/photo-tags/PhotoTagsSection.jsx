import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import useRetag from './useRetag';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import TextButton from '@/components/TextButton';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import listTextStyles from '@/styles/listTextStyles';

/**
 * The tags the assistant sees in the asset, in its details: chips, "No tags" once they were all
 * removed, or, while the assistant is available, "Not tagged yet" with Tag it (the tags land on the
 * asset, which brings them here). A tap opens PhotoTagsScreen to fix them, or to add them by hand
 * without the assistant; `guardPress` (useDetailsPanelDrag's) keeps a touch that dragged the panel
 * from opening it. It never tags by itself.
 */
export default function PhotoTagsSection({ asset, guardPress }) {
  const navigation = useNavigation();
  const isAssistantAvailable = useIsAssistantAvailable();
  const { retag, isRunning, error } = useRetag(asset);

  const open = guardPress(() => navigation.push('PhotoTagsScreen', { assetId: asset.id }));

  if (asset.tags === null && isAssistantAvailable) {
    return (
      <View style={styles.untagged}>
        <Text style={listTextStyles.subtitle}>{error ?? 'Not tagged yet'}</Text>
        <TextButton
          label="Tag it"
          icon="sparkle"
          size="small"
          onPress={guardPress(() => retag())}
          loading={isRunning}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Photo tags"
      accessibilityHint="Opens the tags to fix them"
    >
      {!asset.tags?.length ? (
        <Text style={listTextStyles.subtitle}>No tags</Text>
      ) : (
        <ChipRow>
          {asset.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </ChipRow>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  untagged: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
