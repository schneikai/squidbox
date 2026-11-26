import { StyleSheet } from 'react-native';

import { colors, textStyles } from '@/styles/designTokens';

// A list entry's main line (ThumbnailRow, the asset's details), a contact's or a contact list's name
// in bold, and `meta`: the app's one style for the facts about an item, small, regular and grey, under
// or beside it: counts, dates, places ("10 Assets · Posted 12 days ago", "3 threads", a contact's
// places). Text's `meta` variant is the same. Its gap from the line above is the parent's layout.
export default StyleSheet.create({
  title: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  name: {
    ...textStyles.bodyBold,
    color: colors.text.primary,
  },
  meta: {
    ...textStyles.footnote,
    color: colors.text.secondary,
  },
});
