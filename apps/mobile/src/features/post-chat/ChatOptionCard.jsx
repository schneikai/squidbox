import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import useCopyText from './useCopyText';

import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import OptionCard from '@/components/OptionCard';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import FavoriteHeartButton from '@/features/favorites/FavoriteHeartButton';

// Memoized: a new reply renders only its own options.
export default memo(ChatOptionCard);

/**
 * One option of the chat's reply: its text with a heart (`isFavorite`; `onToggleFavorite(text)`), ⋯ → More like this (`onMoreLikeThis(text)`), and Use (`onUse(text)`, when given) or
 * else Copy.
 */
function ChatOptionCard({ text, isFavorite, onToggleFavorite, onMoreLikeThis, onUse }) {
  const copy = useCopyText();

  return (
    <OptionCard text={text}>
      <FavoriteHeartButton isFavorite={isFavorite} onPress={() => onToggleFavorite(text)} />
      <MenuButton accessibilityLabel="More for this suggestion">
        <MenuOption label="More like this" icon="repeat" onPress={() => onMoreLikeThis(text)} />
      </MenuButton>
      <View style={styles.action}>
        {onUse ? (
          <Button label="Use" size="small" onPress={() => onUse(text)} />
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
