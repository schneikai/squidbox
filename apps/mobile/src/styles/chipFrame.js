import { StyleSheet } from 'react-native';

import { radii } from '@/styles/designTokens';

// A Chip's pill frame, also for an input that stands in for one while a tag is typed (TagInput).
export default StyleSheet.create({
  frame: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
}).frame;
