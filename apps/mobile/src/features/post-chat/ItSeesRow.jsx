import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import TextButton from '@/components/TextButton';
import PhotoTagsField from '@/features/photo-tags/PhotoTagsField';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

/**
 * What the assistant sees in the chat's photos (`rows`, the live assets, their `attempts` and
 * `isTagging` and `untagged`, as useAssetTags gives them): "It sees:" and the tags the chat sends,
 * edited in place (PhotoTagsField: a tag taken off leaves every photo, one added goes on each, the
 * field taking no changes while a tagging runs); "Looking at the photos…" while any is tagged; the
 * photos whose tagging failed, with Retry (`onRetry(assetId)` for each); a photo never tagged, with
 * Tag. The field shows once a photo is tagged, or once nothing is being tagged.
 */
export default function ItSeesRow({ rows, attempts, isTagging, untagged, onRetry }) {
  const failed = rows.filter((row) => row.tags === null && attempts[row.id]?.status === 'error');
  const isTagged = rows.some((row) => row.tags !== null);

  function retryAll(list) {
    for (const row of list) onRetry(row.id);
  }

  return (
    <View style={styles.rows}>
      {(isTagged || !isTagging) && (
        <View style={styles.field}>
          <Text style={listTextStyles.subtitle}>It sees:</Text>
          <PhotoTagsField rows={rows} placeholder="No tags" isDisabled={isTagging} isBare />
        </View>
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
  field: {
    gap: 6,
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
