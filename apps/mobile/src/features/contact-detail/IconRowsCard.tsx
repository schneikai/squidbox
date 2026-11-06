import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon, { type IconName } from '@/components/Icon';
import IconSlotContext from '@/components/IconSlotContext';
import AddRow from '@/components/settings-list/AddRow';
import { colors, layout, press, scale, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

type IconRow = {
  key: string;
  title: string;
  detail?: string;
  /** Opens the row; without it the row doesn't press. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 'chevron' for a row that opens, or a button (like ×) that sits in a 44 pt slot. */
  trailing: 'chevron' | ReactNode;
};

/**
 * A card of rows that each lead with the same icon (a contact's places and lists): a title, an
 * optional detail line under it, a trailing chevron or button, a line under every row inset to the
 * text, and the add row at the card's end (left out without `addLabel`). `twoLine` rows are tall
 * enough for a detail line; one-line rows cut a long title.
 */
type IconRowsCardProps = {
  icon: IconName;
  rows: readonly IconRow[];
  twoLine?: boolean;
  addLabel?: string;
  onAdd: () => void;
};

export default function IconRowsCard({ icon, rows, twoLine = false, addLabel, onAdd }: IconRowsCardProps) {
  return (
    <Card>
      {rows.map((row) => {
        const hasButton = row.trailing !== 'chevron';
        return (
          <View key={row.key}>
            <Pressable
              onPress={row.onPress}
              disabled={!row.onPress}
              accessibilityRole={row.onPress ? 'button' : undefined}
              accessibilityLabel={row.accessibilityLabel}
              accessibilityHint={row.accessibilityHint}
              style={({ pressed }) => [
                styles.row,
                twoLine ? styles.twoLine : styles.oneLine,
                hasButton && styles.withButton,
                pressed && press.flat,
              ]}
            >
              <Icon name={icon} size={sizes.icon} color={colors.text.secondary} />
              <View style={styles.labels}>
                <Text style={styles.title} numberOfLines={twoLine ? undefined : 1}>
                  {row.title}
                </Text>
                {!!row.detail && <Text style={listTextStyles.detail}>{row.detail}</Text>}
              </View>
              {hasButton ? (
                <IconSlotContext.Provider value>{row.trailing}</IconSlotContext.Provider>
              ) : (
                <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
              )}
            </Pressable>
            <Divider style={styles.divider} />
          </View>
        );
      })}
      {addLabel !== undefined && <AddRow label={addLabel} onPress={onAdd} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    paddingHorizontal: layout.rowInset,
  },
  oneLine: {
    minHeight: scale(52),
  },
  twoLine: {
    minHeight: scale(60),
    paddingVertical: space.sm,
  },
  // A button sits in a 44 pt slot, so the row's right inset is smaller than its left: its glyph
  // ends rowInset from the edge.
  withButton: {
    paddingRight: layout.rowInset - (sizes.iconButton - sizes.icon) / 2,
  },
  labels: {
    flex: 1,
  },
  title: listTextStyles.title,
  // Under every row, the line starts at the text, the one above the add row too.
  divider: {
    marginLeft: layout.rowInset + sizes.icon + layout.rowLeadingGap,
  },
});
