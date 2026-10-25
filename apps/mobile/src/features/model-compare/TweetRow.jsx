import { StyleSheet, Text, View } from 'react-native';

import IconButton from '@/components/IconButton';
import { colors, lineHeights, radii, typography } from '@/styles/designTokens';

// A tweet a model wrote, with its thumbs up.
export default function TweetRow({ text, isLiked, onToggle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.text} selectable>
        {text}
      </Text>
      <IconButton
        icon="thumbs-up"
        variant="tinted"
        isActive={isLiked}
        filled={isLiked}
        color={colors.text.secondary}
        onPress={onToggle}
        accessibilityLabel={isLiked ? 'Remove thumbs up' : 'Thumbs up'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background.base,
    borderRadius: radii.cover,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
  },
  text: {
    flex: 1,
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
});
