import { StyleSheet } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

// A list entry's main line and the smaller grey line below it (ThumbnailRow, the asset's details), and
// a contact's or a contact list's: the name in bold over its details, which wrap rather than cut off;
// the small bold grey caption under a post or an album (its date, counts, a thread's "Thread · 3").
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
  name: {
    fontSize: typography.callout,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detail: {
    marginTop: 2,
    fontSize: typography.detail,
    lineHeight: lineHeights.subheadline,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
