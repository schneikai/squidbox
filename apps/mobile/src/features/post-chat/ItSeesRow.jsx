import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import ChatTagsSheet from './ChatTagsSheet';
import EditableLine from './EditableLine';
import postTags from './postTags';

import Button from '@/components/Button';
import IntroText from '@/components/IntroText';
import { colors } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

/**
 * What the assistant sees in the chat's photos (`rows`, the live assets, their `attempts` and
 * `isTagging` and `untagged`, as useAssetTags gives them), as grey lines: "Sees" and the post's tags
 * the chat sends (postTags, with the chat's `tagEdits`), a tap opening ChatTagsSheet to edit them
 * (`onEditTags({ add, remove })`, the chat's editTags; the post's tags only, never the photos');
 * "Looking at the photos…" while any is tagged; the photos whose tagging failed, with Retry
 * (`onRetry(assetId)` for each); a photo never tagged, with Tag. The tags line shows once a photo is
 * tagged, or once nothing is being tagged.
 */
export default function ItSeesRow({ rows, attempts, isTagging, untagged, tagEdits, onEditTags, onRetry }) {
  const [isEditing, setIsEditing] = useState(false);

  const failed = rows.filter((row) => row.tags === null && attempts[row.id]?.status === 'error');
  const isTagged = rows.some((row) => row.tags !== null);
  const tags = postTags(rows, tagEdits);

  function retryAll(list) {
    for (const row of list) onRetry(row.id);
  }

  return (
    <>
      {(isTagged || !isTagging) && (
        <EditableLine label="Sees" editHint="Edits the tags" onPress={() => setIsEditing(true)}>
          {tags.length > 0 ? tags.join(', ') : 'no tags'}
        </EditableLine>
      )}
      {isTagging && (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={colors.text.secondary} />
          <IntroText style={styles.text}>Looking at the photos…</IntroText>
        </View>
      )}
      {failed.length > 0 && !isTagging && (
        <View style={styles.line}>
          <IntroText style={styles.text}>
            {pluralizeText("Couldn't tag %{count} photo", "Couldn't tag %{count} photos", failed.length)}
            {failed.length === 1 && attempts[failed[0].id].error ? `: ${attempts[failed[0].id].error}` : ''}
          </IntroText>
          <Button label="Retry" size="small" onPress={() => retryAll(failed)} />
        </View>
      )}
      {untagged.length > 0 && !isTagging && (
        <View style={styles.line}>
          <IntroText style={styles.text}>Not tagged</IntroText>
          <Button label="Tag" icon="sparkle" size="small" onPress={() => retryAll(untagged)} />
        </View>
      )}
      <ChatTagsSheet
        isVisible={isEditing}
        onClose={() => setIsEditing(false)}
        tags={tags}
        onEditTags={onEditTags}
        disabled={isTagging}
      />
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
  },
});
