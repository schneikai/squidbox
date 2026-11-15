import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import CopyButton from '@/components/CopyButton';
import Icon from '@/components/Icon';
import MenuButton from '@/components/MenuButton';
import OptionCard, { type OptionCardProps } from '@/components/OptionCard';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import relinkMentions, { type MentionCandidate } from '@/features/post-mentions/relinkMentions';
import useCopyPostText from '@/features/post-mentions/useCopyPostText';
import { colors, layout, sizes } from '@/styles/designTokens';

// Memoized: a new reply renders only its own options.
export default memo(ChatOptionCard);

export type ChatOptionCardProps = Pick<OptionCardProps, 'style' | 'textSize' | 'isUsed'> & {
  text: string;
  replyId: string;
  index: number;
  // The contacts the reply's turn was told it may mention: their names in the text are mentions when copied.
  mentioned: readonly MentionCandidate[];
  onMoreLikeThis: ((text: string) => void) | null;
  onUse: ((replyId: string, index: number) => void) | null;
};

/**
 * The option `index` of the reply `replyId`: its text with a copy icon (useCopyPostText; each name of
 * `mentioned` in it is that contact, linked when tapped, relinkMentions), ⋯ → More like this
 * (`onMoreLikeThis(text)`, when given: the chat's, not the tray's), and Use (`onUse(replyId,
 * index)`, when given); once `isUsed` (the tray's), "✓ Used" in place of Use, and the
 * card outlined. style is for layout only.
 */
function ChatOptionCard({
  text,
  replyId,
  index,
  mentioned,
  onMoreLikeThis,
  onUse,
  isUsed = false,
  style,
  textSize,
}: ChatOptionCardProps) {
  const { copyPostText, sheet } = useCopyPostText();

  return (
    <OptionCard text={text} textSize={textSize} isUsed={isUsed} style={style}>
      <CopyButton onCopy={() => copyPostText(relinkMentions({ text, mentions: null }, text, mentioned))} />
      {sheet}
      {onMoreLikeThis && (
        <MenuButton accessibilityLabel="More for this idea">
          <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
        </MenuButton>
      )}
      <View style={styles.action}>
        {isUsed ? (
          <View style={styles.used}>
            <Icon name="check" size={sizes.menuIcon} color={colors.accent.base} />
            <Text variant="assistant">Used</Text>
          </View>
        ) : (
          onUse && <Button label="Use" size="small" onPress={() => onUse(replyId, index)} />
        )}
      </View>
    </OptionCard>
  );
}

const styles = StyleSheet.create({
  action: {
    marginLeft: 'auto',
  },
  // As tall as the small Use it takes the place of.
  used: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    minHeight: sizes.smallButton,
  },
});
