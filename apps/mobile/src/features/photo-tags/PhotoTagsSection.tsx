import { StyleSheet, Text, View } from 'react-native';

import PhotoTagsField from './PhotoTagsField';
import useRetag from './useRetag';

import Button from '@/components/Button';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import type { GuardPress } from '@/lib/unguarded';
import { space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { AssetRow } from '@/sync/db/schema';

export type PhotoTagsSectionProps = { asset: AssetRow; guardPress: GuardPress };

/**
 * The asset's tags, in its details, always edited in place (PhotoTagsField: a chip's × takes it
 * off, Add adds one), with the assistant's Tag it (Tag again once tagged) under them while it is
 * available (the field takes no changes while it runs). `guardPress` (useDetailsPanelDrag's) keeps a touch that dragged the panel
 * from pressing a chip or a button. It never tags by itself.
 */
export default function PhotoTagsSection({ asset, guardPress }: PhotoTagsSectionProps) {
  const isAssistantAvailable = useIsAssistantAvailable();
  const { retag, isRunning, error } = useRetag(asset);

  return (
    <View style={styles.section}>
      <PhotoTagsField asset={asset} placeholder="No tags" disabled={isRunning} guardPress={guardPress} />
      {isAssistantAvailable && (
        <View style={styles.line}>
          {error && <Text style={listTextStyles.subtitle}>{error}</Text>}
          <Button
            label={asset.tags === null ? 'Tag it' : 'Tag again'}
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
    gap: space.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
