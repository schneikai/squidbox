import { StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

// A list entry's main line and the smaller grey line below it (ThumbnailRow, the asset's details), and
// the small bold grey caption under a post or an album (its date, counts), and the same in the accent
// for what marks the entry out (a thread's "3 posts").
export default StyleSheet.create({
  title: {
    fontSize: typography.body,
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  captionAccent: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.accent.base,
  },
});
