import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import TextButton from '@/components/TextButton';
import { colors, typography } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

/**
 * What the assistant sees in the chat's photos (`rows`, the live assets, and their `attempts`, as
 * useAssetTags gives them): "It sees:" and each distinct tag, in the assets' order, a tap opening the
 * tags of the first photo with it (`onOpen(assetId)`) to fix them; "Looking at the photos…" while any
 * is tagged; the photos whose tagging failed, with Retry (`onRetry(assetId)` for each); a photo never
 * tagged, with Tag.
 */
export default function ItSeesRow({ rows, attempts, onOpen, onRetry }) {
  const tags = distinctTags(rows);
  const isLoading = rows.some((row) => attempts[row.id]?.status === 'loading');
  const failed = rows.filter((row) => row.tags === null && attempts[row.id]?.status === 'error');
  const untagged = rows.filter((row) => row.tags === null && !attempts[row.id]);

  function retryAll(list) {
    for (const row of list) onRetry(row.id);
  }

  return (
    <View style={styles.rows}>
      {tags.length > 0 && (
        <ChipRow>
          <Text style={[styles.text, styles.label]}>It sees:</Text>
          {tags.map(({ tag, assetId }) => (
            <Chip key={tag} label={tag} onPress={() => onOpen(assetId)} accessibilityHint="Opens the photo's tags" />
          ))}
          <Text style={[styles.text, styles.label]}>Tap to fix</Text>
        </ChipRow>
      )}
      {isLoading && (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={colors.text.secondary} />
          <Text style={styles.text}>Looking at the photos…</Text>
        </View>
      )}
      {failed.length > 0 && !isLoading && (
        <View style={styles.line}>
          <Text style={styles.text}>
            {pluralizeText("Couldn't tag %{count} photo", "Couldn't tag %{count} photos", failed.length)}
            {failed.length === 1 && attempts[failed[0].id].error ? `: ${attempts[failed[0].id].error}` : ''}
          </Text>
          <TextButton label="Retry" size="small" onPress={() => retryAll(failed)} />
        </View>
      )}
      {untagged.length > 0 && !isLoading && (
        <View style={styles.line}>
          <Text style={styles.text}>Not tagged</Text>
          <TextButton label="Tag" icon="sparkle" size="small" onPress={() => retryAll(untagged)} />
        </View>
      )}
    </View>
  );
}

// Each tag once (without case), with the first asset that has it, in the assets' order.
function distinctTags(rows) {
  const byKey = new Map();
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const key = tag.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { tag, assetId: row.id });
    }
  }
  return [...byKey.values()];
}

const styles = StyleSheet.create({
  rows: {
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flexShrink: 1,
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  // In line with the chips beside it.
  label: {
    alignSelf: 'center',
  },
});
