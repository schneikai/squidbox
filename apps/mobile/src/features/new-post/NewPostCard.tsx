import { Pressable, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { colors, press, scale, sizes } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

export type NewPostCardProps = { onPress: () => void };

/**
 * The New post sheet's way into the editor: a card that looks like the editor's empty first card
 * ("What's new?" over the photo button's mark). A tap anywhere on it opens the editor (`onPress`).
 */
export default function NewPostCard({ onPress }: NewPostCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="New post"
      style={({ pressed }) => pressed && press.flat}
    >
      <Card padded hasControlRow>
        <Text style={[textareaTextStyle, styles.placeholder]}>What's new?</Text>
        <View style={styles.toolbar}>
          <Icon name="image" size={sizes.icon} color={colors.accent.base} />
        </View>
      </Card>
    </Pressable>
  );
}

// The editor's first card (PostCard, PostCardToolbar) without its text field and buttons.
const styles = StyleSheet.create({
  placeholder: {
    minHeight: scale(84),
    color: colors.text.tertiary,
  },
  toolbar: {
    height: sizes.iconButton,
    justifyContent: 'center',
  },
});
