import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import useCopyText from './useCopyText';

import IconMenuButton from '@/components/IconMenuButton';
import OptionCard from '@/components/OptionCard';
import TextButton from '@/components/TextButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import FavoriteHeartButton from '@/features/favorites/FavoriteHeartButton';
import { colors } from '@/styles/designTokens';

// Memoized: a new reply renders only its own options.
export default memo(ChatOptionCard);

/**
 * One option of the chat's reply: its text with a heart (`isFavorite`; `onToggleFavorite(text,
 * source)`), ⋯ → More like this (`onMoreLikeThis(text)`), and Use (`onUse(text)`, when given) or
 * else Copy.
 */
function ChatOptionCard({ text, source, isFavorite, onToggleFavorite, onMoreLikeThis, onUse }) {
  const copy = useCopyText();

  return (
    <OptionCard text={text}>
      <FavoriteHeartButton isFavorite={isFavorite} onPress={() => onToggleFavorite(text, source)} />
      <IconMenuButton color={colors.text.secondary} accessibilityLabel="More for this option">
        <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
      </IconMenuButton>
      <View style={styles.action}>
        {onUse ? (
          <TextButton label="Use" size="small" onPress={() => onUse(text)} />
        ) : (
          <TextButton label="Copy" icon="copy" size="small" onPress={() => copy(text)} />
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
