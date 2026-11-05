import { StyleSheet } from 'react-native';

import { colors, textStyles } from '@/styles/designTokens';

// A multiline TextInput's text, also for showing the same text where it isn't being edited (AssetNote).
export default StyleSheet.create({
  text: {
    ...textStyles.reading,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
}).text;
