import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, scale } from '@/styles/designTokens';

// The sizes it is drawn at: a chip's and a list stack's, a row's, the favorites row's, the contact screen's.
const SIZES = { small: scale(32), regular: scale(44), large: scale(56), hero: scale(96) };

/**
 * A contact's round avatar: its initials on the accent's soft surface, like the account button.
 * `size` is `small`, `regular`, `large` or `hero`. With `isFavorite` it wears a red heart on a white
 * disc at its bottom right; `isStacked` rings it in white, for avatars overlapping in a stack.
 * VoiceOver reads the contact's name. style is for layout only.
 */
export default function ContactAvatar({ contact, size = 'regular', isFavorite = false, isStacked = false, style }) {
  const diameter = SIZES[size];
  const heart = Math.max(scale(14), Math.round(diameter * 0.32));

  return (
    <View
      style={[
        styles.avatar,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        isStacked && styles.stacked,
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={contact.name}
    >
      <Text style={[styles.initials, { fontSize: Math.round(diameter * 0.38) }]} numberOfLines={1}>
        {initialsOf(contact.name)}
      </Text>
      {isFavorite && (
        <View style={[styles.heart, { width: heart, height: heart, borderRadius: heart / 2 }]}>
          <Icon name="heart" size={Math.round(heart * 0.62)} color={colors.status.danger} filled />
        </View>
      )}
    </View>
  );
}

// The first letters of the name's first two words ("Maya Lindqvist" → "ML").
function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => [...word][0].toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stacked: {
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  initials: {
    color: colors.accent.base,
    fontWeight: '600',
  },
  heart: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
