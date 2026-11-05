import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import { colors, radii, typography } from '@/styles/designTokens';

export type ThumbnailBadgeProps = { icon?: IconName; label?: string; style?: StyleProp<ViewStyle> };

// A small dark label over a picture (a video's length, "+3"), readable on any image. The parent
// positions it through `style`.
export default function ThumbnailBadge({ icon, label, style }: ThumbnailBadgeProps) {
  return (
    <View style={[styles.badge, style]} pointerEvents="none">
      {icon && <Icon name={icon} size={typography.caption2} color={colors.text.inverse} />}
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlay.dim,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  label: {
    color: colors.text.inverse,
    fontSize: typography.caption2,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
