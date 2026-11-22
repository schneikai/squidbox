import { Pressable, StyleSheet, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import Text from '@/components/Text';
import { colors, press, sizes, space } from '@/styles/designTokens';

type PinnedRowEmptyProps = {
  icon: IconName;
  title: string;
  hint: string;
  // The slot's tap, when there is a way to fill the list from here (a list of the user's: Add contacts).
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * The pinned row on Contacts while its list is empty: an empty slot where the first avatar will be
 * (a dashed circle with the list's icon) and what fills it beside it, as tall as the row of avatars,
 * so the header above it (the list's name, All lists) keeps its place and the tab doesn't jump when
 * the first contact lands.
 */
export default function PinnedRowEmpty({ icon, title, hint, onPress, accessibilityLabel }: PinnedRowEmptyProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.slot, pressed && press.flat]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
      >
        <Icon name={icon} size={sizes.avatar.medium * 0.36} color={colors.text.tertiary} />
      </Pressable>
      <View style={styles.text}>
        <Text variant="hint" tone="primary">
          {title}
        </Text>
        <Text variant="hint">{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingBottom: space.lg,
  },
  slot: {
    width: sizes.avatar.medium,
    height: sizes.avatar.medium,
    borderRadius: sizes.avatar.medium / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border.dashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: space.xs,
  },
});
