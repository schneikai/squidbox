import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import ChangedBadge from '@/components/ChangedBadge';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// A model's name, its labels (`labels`, from modelLabels) as badges below it: Changed (a default of
// yours that everyone doesn't use), Verified, then the defaults; and a detail line under them (its
// score, Uncensored, reasoning and cost). `isDimmed` greys the text, for a model Venice no longer
// offers.
export default function ModelSummary({ name, labels, detail, isDimmed = false }) {
  const hasBadges = labels.default || labels.uncensoredDefault || labels.verified;
  return (
    <View style={styles.summary}>
      <Text style={[listTextStyles.title, isDimmed && styles.dimmed]}>{name}</Text>
      {hasBadges && (
        <View style={styles.badges}>
          {labels.changed && <ChangedBadge />}
          {labels.verified && <Badge label={MODEL_LABEL_NAMES.verified} tone="success" />}
          {labels.default && <Badge label={MODEL_LABEL_NAMES.default} tone="info" />}
          {/* the long name doesn't fit a badge */}
          {labels.uncensoredDefault && <Badge label={MODEL_LABEL_NAMES.uncensoredDefault} tone="info" />}
        </View>
      )}
      <Text style={[listTextStyles.subtitle, styles.detail, isDimmed && styles.dimmed]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginTop: 4,
  },
  detail: {
    marginTop: 2,
  },
  dimmed: {
    color: colors.text.tertiary,
  },
});
