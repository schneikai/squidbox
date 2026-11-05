import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import cornerStyles from '@/styles/cornerStyles';
import { colors, layout, radii, textStyles, typography } from '@/styles/designTokens';

export type ThumbnailBadgeProps = {
  icon?: IconName;
  label?: string;
  corner?: keyof typeof cornerStyles;
  style?: StyleProp<ViewStyle>;
};

// A small dark label over a picture (a video's length, "+3"), readable on any image. `corner`
// (topLeft, topRight, bottomRight, bottomRightSmall on a small thumbnail) puts it in that corner of its parent at the badge inset; style is
// for layout only.
export default function ThumbnailBadge({ icon, label, corner, style }: ThumbnailBadgeProps) {
  return (
    <View style={[styles.badge, corner && cornerStyles[corner], style]} pointerEvents="none">
      {icon && <Icon name={icon} size={typography.caption2} color={colors.text.inverse} />}
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGapSmall,
    backgroundColor: colors.overlay.dim,
    borderRadius: radii.pill,
    paddingHorizontal: layout.capsulePaddingX,
    paddingVertical: layout.capsulePaddingY,
  },
  label: {
    color: colors.text.inverse,
    ...textStyles.caption2Bold,
    fontVariant: ['tabular-nums'],
  },
});
