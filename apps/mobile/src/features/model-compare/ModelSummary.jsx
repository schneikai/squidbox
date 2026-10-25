import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import Icon from '@/components/Icon';
import { colors, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// A model's name with Venice's Uncensored label, and a detail line under it (its cost, score) with
// an optional leading icon. `isDimmed` greys both, for a model Venice no longer offers.
export default function ModelSummary({ name, isUncensored, detail, detailIcon, isDimmed = false }) {
  return (
    <View style={styles.summary}>
      <View style={styles.titleLine}>
        <Text style={[listTextStyles.title, styles.name, isDimmed && styles.dimmed]}>{name}</Text>
        {isUncensored && <Badge label="Uncensored" tone="accent" />}
      </View>
      <View style={styles.detailLine}>
        {detailIcon && <Icon name={detailIcon} size={typography.footnote} color={colors.text.secondary} />}
        <Text style={[listTextStyles.subtitle, styles.detail, isDimmed && styles.dimmed]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  name: {
    flexShrink: 1,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detail: {
    flexShrink: 1,
    marginTop: 0,
  },
  dimmed: {
    color: colors.text.tertiary,
  },
});
