import { StyleSheet } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

// A multiline TextInput's text, also for showing the same text where it isn't being edited (AssetNote).
export default StyleSheet.create({
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
}).text;
