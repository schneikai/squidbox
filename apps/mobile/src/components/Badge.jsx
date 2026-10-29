import { StyleSheet, Text } from 'react-native';

import { colors, radii, typography } from '@/styles/designTokens';

const TONES = {
  danger: { backgroundColor: colors.status.dangerLight, color: colors.status.danger },
  accent: { backgroundColor: colors.accent.light, color: colors.accent.base },
  success: { backgroundColor: colors.status.successLight, color: colors.status.success },
  info: { backgroundColor: colors.status.infoLight, color: colors.status.info },
  warning: { backgroundColor: colors.status.warningLight, color: colors.status.warning },
};

// A small uppercase label on a list entry or a screen ("Archived", "Unrestricted", "Verified"), in a
// `tone`: danger | accent | success | info | warning. The parent positions it through `style`.
export default function Badge({ label, tone, style }) {
  return <Text style={[styles.badge, TONES[tone], style]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radii.badge,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: typography.caption2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
