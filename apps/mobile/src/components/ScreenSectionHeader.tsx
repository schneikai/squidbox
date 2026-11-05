import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

type ScreenSectionHeaderSize = 'small' | 'regular' | 'large';

export type ScreenSectionHeaderProps = {
  title: string;
  trailing?: ReactNode;
  isFlush?: boolean;
  isFirst?: boolean;
  size?: ScreenSectionHeaderSize;
};

/**
 * A section label above grouped rows or content: Settings and its screens, the asset's details,
 * a post.
 *
 * When trailing is provided the component renders a flex row with the title
 * on the left and the slot on the right. Over cards it sits a little in from
 * their edge; `isFlush` lines it up with content that has no card around it.
 * `isFirst` drops its top margin, for the first thing under a screen's content top (the Contacts tab's).
 * `size` is `regular` (the default), `small` (a count or a group over a long list: the contacts,
 * the lists) or `large` (a section of one item's screen: a contact's Places, a photo's Contacts).
 */
export default function ScreenSectionHeader({
  title,
  trailing,
  isFlush = false,
  isFirst = false,
  size = 'regular',
}: ScreenSectionHeaderProps) {
  const label = [styles.label, LABEL_STYLES[size], isFlush && styles.flush];
  const spacing = [SPACING_STYLES[size], isFirst && styles.first];

  if (!trailing) {
    return <Text style={[label, spacing]}>{title}</Text>;
  }

  return (
    <View style={[styles.row, spacing]}>
      <Text style={[label, styles.labelInRow]}>{title}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: 4,
  },
  label_small: {
    fontSize: typography.subheadline,
    marginLeft: 6,
  },
  label_regular: {
    fontSize: typography.body,
  },
  label_large: {
    fontSize: typography.title3,
    fontWeight: '700',
    marginLeft: 6,
  },
  spacing_small: {
    marginTop: 22,
    marginBottom: 8,
  },
  spacing_regular: {
    marginTop: 20,
    marginBottom: 8,
  },
  spacing_large: {
    marginTop: 26,
    marginBottom: 10,
  },
  labelInRow: {
    flex: 1,
  },
  first: {
    marginTop: 0,
  },
  flush: {
    marginLeft: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

const LABEL_STYLES: Record<ScreenSectionHeaderSize, TextStyle> = {
  small: styles.label_small,
  regular: styles.label_regular,
  large: styles.label_large,
};

const SPACING_STYLES: Record<ScreenSectionHeaderSize, ViewStyle> = {
  small: styles.spacing_small,
  regular: styles.spacing_regular,
  large: styles.spacing_large,
};
