import { CHAT_LIMITS } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import IntroText from '@/components/IntroText';
import TagsField from '@/components/TagsField';
import tagsDifference from '@/utils/tagsDifference';

/**
 * The handles the chat may mention, in a sheet (`handles`), edited in place like its tags: a tap
 * takes one off, Add types one in, and the posts' other handles (`more`) come back with a tap. Each
 * change is the chat's only (`onEditMentions({ add, remove })`), never the posts'.
 */
export default function ChatMentionsSheet({ isVisible, onClose, handles, more, onEditMentions }) {
  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="Mentions">
      <View style={styles.body}>
        <IntroText>Who the assistant may mention in this chat. Your posts stay as they are.</IntroText>
        <TagsField
          tags={handles}
          onChange={(next) => onEditMentions(tagsDifference(handles, next))}
          placeholder="No mentions"
          maxTags={CHAT_LIMITS.mentions}
          maxTagLength={CHAT_LIMITS.mention}
        />
        {more.length > 0 && (
          <View style={styles.more}>
            <IntroText>More from your posts</IntroText>
            <ChipRow>
              {more.map((handle) => (
                <Chip
                  key={handle}
                  label={handle}
                  variant="add"
                  onPress={() => onEditMentions({ add: [handle] })}
                  accessibilityHint="Adds this handle"
                />
              ))}
            </ChipRow>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  more: {
    gap: 8,
  },
});
