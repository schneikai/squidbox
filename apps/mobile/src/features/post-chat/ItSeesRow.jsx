import { uniqueTags } from '@squidbox/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import TextButton from '@/components/TextButton';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

/**
 * What the assistant sees in the chat's photos (`rows`, the live assets, their `attempts` and
 * `isTagging` and `untagged`, as useAssetTags gives them): "It sees:" and the tags the chat sends, a tap opening
 * the tags of the first photo with it (`onOpen(assetId)`) to fix them; "Looking at the photos…"
 * while any is tagged; the photos whose tagging failed, with Retry (`onRetry(assetId)` for each); a
 * photo never tagged, with Tag.
 */
export default function ItSeesRow({ rows, attempts, isTagging, untagged, onOpen, onRetry }) {
  const tags = uniqueTags(rows.flatMap((row) => row.tags ?? []));
  const failed = rows.filter((row) => row.tags === null && attempts[row.id]?.status === 'error');

  function firstAssetWith(tag) {
    const key = tag.toLowerCase();
    return rows.find((row) => row.tags?.some((each) => each.trim().toLowerCase() === key))?.id;
  }

  function retryAll(list) {
    for (const row of list) onRetry(row.id);
  }

  return (
    <View style={styles.rows}>
      {tags.length > 0 && (
        <ChipRow>
          <Text style={[listTextStyles.subtitle, styles.inline]}>It sees:</Text>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onPress={() => onOpen(firstAssetWith(tag))}
              accessibilityHint="Opens the photo's tags"
            />
          ))}
          <Text style={[listTextStyles.subtitle, styles.inline]}>Tap to fix</Text>
        </ChipRow>
      )}
      {isTagging && (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={colors.text.secondary} />
          <Text style={[listTextStyles.subtitle, styles.inline]}>Looking at the photos…</Text>
        </View>
      )}
      {failed.length > 0 && !isTagging && (
        <View style={styles.line}>
          <Text style={[listTextStyles.subtitle, styles.inline]}>
            {pluralizeText("Couldn't tag %{count} photo", "Couldn't tag %{count} photos", failed.length)}
            {failed.length === 1 && attempts[failed[0].id].error ? `: ${attempts[failed[0].id].error}` : ''}
          </Text>
          <TextButton label="Retry" size="small" onPress={() => retryAll(failed)} />
        </View>
      )}
      {untagged.length > 0 && !isTagging && (
        <View style={styles.line}>
          <Text style={[listTextStyles.subtitle, styles.inline]}>Not tagged</Text>
          <TextButton label="Tag" icon="sparkle" size="small" onPress={() => retryAll(untagged)} />
        </View>
      )}
    </View>
  );
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
  // In line with the chips or the spinner beside it.
  inline: {
    flexShrink: 1,
    marginTop: 0,
    alignSelf: 'center',
  },
});
