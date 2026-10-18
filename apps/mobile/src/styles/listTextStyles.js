import { StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

// A list entry's main line and the smaller grey line below it (ThumbnailRow, the asset's details).
export default StyleSheet.create({
  title: {
    fontSize: typography.base,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
});
