import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import useCopyText from './useCopyText';

import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import OptionCard, { type OptionCardProps } from '@/components/OptionCard';
import MenuOption from '@/components/popup-menu-options/MenuOption';

// Memoized: a new reply renders only its own options.
export default memo(ChatOptionCard);

export type ChatOptionCardProps = Pick<OptionCardProps, 'style'> & {
  text: string;
  replyId: string;
  index: number;
  onMoreLikeThis: ((text: string) => void) | null;
  onUse: ((replyId: string, index: number) => void) | null;
};

/**
 * The option `index` of the reply `replyId`: its text with ⋯ → More like this
 * (`onMoreLikeThis(text)`, when given: the chat's, not the tray's), and Use (`onUse(replyId,
 * index)`, when given) or else Copy. style is for layout only.
 */
function ChatOptionCard({ text, replyId, index, onMoreLikeThis, onUse, style }: ChatOptionCardProps) {
  const copy = useCopyText();

  return (
    <OptionCard text={text} style={style}>
      {onMoreLikeThis && (
        <MenuButton accessibilityLabel="More for this idea">
          <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
        </MenuButton>
      )}
      <View style={styles.action}>
        {onUse ? (
          <Button label="Use" size="small" onPress={() => onUse(replyId, index)} />
        ) : (
          <Button label="Copy" icon="copy" size="small" onPress={() => copy(text)} />
        )}
      </View>
    </OptionCard>
  );
}

const styles = StyleSheet.create({
  action: {
    marginLeft: 'auto',
  },
});
