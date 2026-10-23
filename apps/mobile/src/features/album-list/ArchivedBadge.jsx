import { StyleSheet, Text } from 'react-native';

import { colors, radii, typography } from '@/styles/designTokens';

// Marks an archived album, in its list cell and on its screen.
export default function ArchivedBadge({ style }) {
  return <Text style={[styles.badge, style]}>Archived</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: colors.status.dangerLight,
    color: colors.status.danger,
    borderRadius: radii.badge,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: typography.caption2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
