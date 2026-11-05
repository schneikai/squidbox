import { StyleSheet, Text } from 'react-native';

import { colors, radii, textStyles } from '@/styles/designTokens';

const TONES = {
  danger: { backgroundColor: colors.status.dangerLight, color: colors.status.danger },
  accent: { backgroundColor: colors.accent.light, color: colors.accent.base },
  success: { backgroundColor: colors.status.successLight, color: colors.status.success },
  info: { backgroundColor: colors.status.infoLight, color: colors.status.info },
};

// A small uppercase label on a list entry or a screen ("Archived", "Uncensored", "Verified"), in a
// `tone`: danger | accent | success | info. The parent positions it through `style`.
export default function Badge({ label, tone, style }) {
  return <Text style={[styles.badge, TONES[tone], style]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    overflow: 'hidden',
    borderRadius: radii.badge,
    // eslint-disable-next-line no-restricted-syntax -- a label's tight capsule, optically even around caps
    paddingHorizontal: 6,
    // eslint-disable-next-line no-restricted-syntax -- as above
    paddingVertical: 2,
    ...textStyles.caption2Bold,
    textTransform: 'uppercase',
  },
});
