import { StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

// Textarea's text, also for showing the same text where it isn't being edited (AssetNote).
export default StyleSheet.create({
  text: {
    fontSize: typography.body,
    lineHeight: 24,
    color: colors.text,
    textAlignVertical: 'top',
  },
}).text;
