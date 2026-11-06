import { StyleSheet } from 'react-native';

import { colors, space, textStyles } from '@/styles/designTokens';

// A list entry's main line and the smaller grey line below it (ThumbnailRow, the asset's details), and
// a contact's or a contact list's: the name in bold over its details, which wrap rather than cut off;
// the small bold grey caption under a post or an album (its date, counts, a thread's "Thread · 3").
export default StyleSheet.create({
  title: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: space.hair,
    ...textStyles.footnote,
    color: colors.text.secondary,
  },
  name: {
    ...textStyles.bodyBold,
    color: colors.text.primary,
  },
  detail: {
    marginTop: space.hair,
    ...textStyles.subheadline,
    color: colors.text.secondary,
  },
  caption: {
    ...textStyles.footnoteBold,
    color: colors.text.secondary,
  },
});
