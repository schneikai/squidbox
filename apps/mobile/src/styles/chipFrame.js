import { StyleSheet } from 'react-native';

import { radii, sizes, space } from '@/styles/designTokens';

// A Chip's pill frame, also for an input that stands in for one while a tag is typed (TagInput). The
// same minimum height for both, with the text centred, so a text input (which sizes and places its
// text unlike a Text) lines up with the chips beside it; a row of chips at `space.sm` gaps has a
// 44 pt pitch, and a larger text size grows them instead of clipping.
export default StyleSheet.create({
  frame: {
    minHeight: sizes.smallButton + space.sm,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 11, // with its 1 pt border, the label sits space.md from the pill's edge
  },
}).frame;
