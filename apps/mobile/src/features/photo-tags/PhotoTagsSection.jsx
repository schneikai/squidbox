import { StyleSheet, Text, View } from 'react-native';

import PhotoTagsField from './PhotoTagsField';
import useRetag from './useRetag';

import Button from '@/components/Button';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import listTextStyles from '@/styles/listTextStyles';

/**
 * The tags the assistant sees in the asset, in its details, edited in place (PhotoTagsField: a tap
 * on a chip takes it off, Add adds one), with Tag again under them while the assistant is available
 * (the field takes no changes while it runs). Never tagged and the assistant available: "Not tagged
 * yet" with Tag it instead. `guardPress` (useDetailsPanelDrag's) keeps a touch that dragged the panel
 * from pressing a chip or a button. It never tags by itself.
 */
export default function PhotoTagsSection({ asset, guardPress }) {
  const isAssistantAvailable = useIsAssistantAvailable();
  const { retag, isRunning, error } = useRetag(asset);

  if (asset.tags === null && isAssistantAvailable) {
    return (
      <View style={styles.line}>
        <Text style={listTextStyles.subtitle}>{error ?? 'Not tagged yet'}</Text>
        <Button label="Tag it" icon="sparkle" size="small" onPress={guardPress(() => retag())} loading={isRunning} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <PhotoTagsField asset={asset} placeholder="No tags" isDisabled={isRunning} guardPress={guardPress} />
      {isAssistantAvailable && (
        <View style={styles.line}>
          {error && <Text style={listTextStyles.subtitle}>{error}</Text>}
          <Button
            label="Tag again"
            icon="sparkle"
            size="small"
            onPress={guardPress(() => retag())}
            loading={isRunning}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
