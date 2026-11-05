import { StyleSheet } from 'react-native';

import { lineHeights, radii } from '@/styles/designTokens';

// A Chip's pill frame, also for an input that stands in for one while a tag is typed (TagInput). A
// fixed height, so a text input (which sizes and places its text unlike a Text) lines up with the
// chips beside it.
export default StyleSheet.create({
  frame: {
    height: lineHeights.subheadline + 14,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 11,
  },
}).frame;
