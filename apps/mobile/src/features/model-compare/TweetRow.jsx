import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import Text from '@/components/Text';
import { colors, layout, radii, space } from '@/styles/designTokens';

// A tweet a model wrote, with its thumbs up: `level` 0, 1 (a thumb up) or 2 (two, an outstanding
// one); `onToggle` steps it on, from two back to none.
export default function TweetRow({ text, level, onToggle }) {
  const isLiked = level > 0;
  return (
    <View style={styles.row}>
      <Text selectable style={styles.text}>
        {text}
      </Text>
      <Button
        icon="thumbs-up"
        variant="secondary"
        iconCount={level === 2 ? 2 : 1}
        isSelected={isLiked}
        filled={isLiked}
        onPress={onToggle}
        accessibilityLabel={LEVEL_LABELS[level]}
      />
    </View>
  );
}

// What a tap does, for a screen reader.
const LEVEL_LABELS = ['Thumbs up', 'Two thumbs up', 'Remove thumbs up'];

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.background.base,
    borderRadius: radii.cover,
    paddingVertical: layout.rowPaddingYCompact,
    paddingLeft: layout.cardInset,
    paddingRight: space.sm,
  },
  text: {
    flex: 1,
  },
});
