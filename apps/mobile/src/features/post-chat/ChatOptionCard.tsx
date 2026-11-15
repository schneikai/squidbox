import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import Icon from '@/components/Icon';
import MenuButton from '@/components/MenuButton';
import OptionCard, { type OptionCardProps } from '@/components/OptionCard';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import CopyPostTextButton from '@/features/post-mentions/CopyPostTextButton';
import MentionRuns from '@/features/post-mentions/MentionRuns';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import type { MentionTextValue } from '@/features/post-mentions/mentionParts';
import { colors, layout, sizes } from '@/styles/designTokens';

// Memoized: a new reply renders only its own options.
export default memo(ChatOptionCard);

export type ChatOptionCardProps = Pick<OptionCardProps, 'style' | 'textSize' | 'isUsed'> & {
  value: MentionTextValue;
  // The contacts its chips mention, by id (useMentionedContacts): their names and avatars.
  contactsById: ReadonlyMap<string, MentionContact>;
  replyId: string;
  index: number;
  onMoreLikeThis: ((text: string) => void) | null;
  onUse: ((replyId: string, index: number) => void) | null;
};

/**
 * The option `index` of the reply `replyId`: its text with its mentions (`value`, each a chip that
 * takes no tap: the card has its own buttons) with a copy icon (CopyPostTextButton), ⋯ → More like
 * this (`onMoreLikeThis(text)`, its plain text, when given: the chat's, not the tray's), and Use
 * (`onUse(replyId, index)`, when given); once `isUsed` (the tray's), "✓ Used" in place of Use, and
 * the card outlined. style is for layout only.
 */
function ChatOptionCard({
  value,
  contactsById,
  replyId,
  index,
  onMoreLikeThis,
  onUse,
  isUsed = false,
  style,
  textSize,
}: ChatOptionCardProps) {
  return (
    <OptionCard
      text={<MentionRuns value={value} contactsById={contactsById} />}
      textSize={textSize}
      isUsed={isUsed}
      style={style}
    >
      <CopyPostTextButton post={value} />
      {onMoreLikeThis && (
        <MenuButton accessibilityLabel="More for this idea">
          <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(value.text)} />
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
