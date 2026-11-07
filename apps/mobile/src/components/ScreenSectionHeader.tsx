import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import Button from '@/components/Button';
import { colors, layout, space, textStyles } from '@/styles/designTokens';

type ScreenSectionHeaderSize = 'small' | 'regular';

export type ScreenSectionHeaderProps = {
  title: string;
  trailing?: ReactNode;
  link?: { label: string; onPress: () => void };
  isFlush?: boolean;
  isFirst?: boolean;
  size?: ScreenSectionHeaderSize;
};

/**
 * A section label above grouped rows or content: Settings and its screens, the asset's details,
 * a post.
 *
 * When trailing is provided the component renders a flex row with the title
 * on the left and the slot on the right. `link` is a secondary way on (See all 27): a grey link at
 * the row's end, on the title's baseline, never the accent. Over cards it sits a little in from
 * their edge; `isFlush` lines it up with content that has no card around it.
 * `isFirst` drops its top margin, for the first thing under a screen's content top (the Contacts tab's).
 * `size` is `regular` (the default, also for the sections of one item's screen) or `small` (a count
 * or a group over a long list: the contacts, the lists).
 */
export default function ScreenSectionHeader({
  title,
  trailing,
  link,
  isFlush = false,
  isFirst = false,
  size = 'regular',
}: ScreenSectionHeaderProps) {
  const label = [styles.label, LABEL_STYLES[size], isFlush && styles.flush];
  const spacing = [styles.spacing, isFirst && styles.first];

  if (link) {
    return (
      <View style={[styles.row, styles.withLink, spacing]}>
        <Text style={[label, styles.labelInRow]}>{title}</Text>
        <Button label={link.label} size="small" colorPalette="muted" onPress={link.onPress} />
      </View>
    );
  }

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
    color: colors.text.secondary,
    marginLeft: layout.rowInset, // over the rows' text
  },
  label_small: textStyles.subheadlineBold,
  label_regular: textStyles.bodyBold,
  spacing: {
    marginTop: layout.sectionGap,
    marginBottom: space.sm,
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
  // The link's text sits on the title's baseline.
  withLink: {
    alignItems: 'baseline',
    gap: space.sm,
  },
});

const LABEL_STYLES: Record<ScreenSectionHeaderSize, TextStyle> = {
  small: styles.label_small,
  regular: styles.label_regular,
};
