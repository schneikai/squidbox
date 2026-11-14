import { CHAT_LIMITS } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import type { LiveChat } from './useChatSession';

import BottomSheet from '@/components/BottomSheet';
import IntroText from '@/components/IntroText';
import TagsField from '@/components/TagsField';
import MentionSuggestions from '@/features/post-mentions/MentionSuggestions';
import { space } from '@/styles/designTokens';
import tagsDifference from '@/utils/tagsDifference';

type ChatMentionsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  handles: string[];
  // The post's photos: their contacts come first among the suggestions.
  assetIds: string[];
  onEditMentions: LiveChat['editMentions'];
};

/**
 * The handles the chat may mention, in a sheet (`handles`), edited in place like its tags: a tap
 * takes one off, and Add types one in, suggesting the contacts' handles it may mean as the post
 * editor does (MentionSuggestions, those on the photos `assetIds` first), a tap adding one. Each
 * change is the chat's only (`onEditMentions({ add, remove })`), never the posts'.
 */
export default function ChatMentionsSheet({
  isVisible,
  onClose,
  handles,
  assetIds,
  onEditMentions,
}: ChatMentionsSheetProps) {
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
          itemName="handle"
          renderSuggestions={(text, add) => (
            <MentionSuggestions
              query={text.trim().replace(/^@/, '')}
              assetIds={assetIds}
              onPick={(handle) => add(`@${handle}`)}
            />
          )}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
  },
});
