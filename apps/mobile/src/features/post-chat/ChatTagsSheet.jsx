import { ASSET_TAG_LIMITS, CHAT_LIMITS } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import IntroText from '@/components/IntroText';
import TagsField from '@/components/TagsField';
import tagsDifference from '@/utils/tagsDifference';

/**
 * The chat's tags in a sheet (`tags`, postTags'), edited in place: a tag taken off or added changes
 * the post's tags only (`onEditTags({ add, remove })`), never the photos'. `isDisabled` while a
 * tagging runs.
 */
export default function ChatTagsSheet({ isVisible, onClose, tags, onEditTags, isDisabled }) {
  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="Tags">
      <View style={styles.body}>
        <IntroText>What the assistant sees in these photos. It writes from these tags.</IntroText>
        <TagsField
          tags={tags}
          onChange={(next) => onEditTags(tagsDifference(tags, next))}
          placeholder="No tags"
          maxTags={CHAT_LIMITS.tags}
          maxTagLength={ASSET_TAG_LIMITS.tag}
          isDisabled={isDisabled}
        />
        <IntroText>For this post only: your photos keep their own tags.</IntroText>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
});
