import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// A model's name with its labels (`labels`, from modelLabels), and a detail line under it (its score, cost and thinking). `isDimmed`
// greys both, for a model Venice no longer offers.
export default function ModelSummary({ name, labels, detail, isDimmed = false }) {
  return (
    <View style={styles.summary}>
      <View style={styles.titleLine}>
        <Text style={[listTextStyles.title, styles.name, isDimmed && styles.dimmed]}>{name}</Text>
        {labels.verified && <Badge label={MODEL_LABEL_NAMES.verified} tone="success" />}
        {labels.unrestricted && <Badge label={MODEL_LABEL_NAMES.unrestricted} tone="accent" />}
        {labels.default && <Badge label={MODEL_LABEL_NAMES.default} tone="info" />}
        {/* the long name doesn't fit a badge */}
        {labels.adultDefault && <Badge label="Adult default" tone="warning" />}
      </View>
      <Text style={[listTextStyles.subtitle, styles.detail, isDimmed && styles.dimmed]} numberOfLines={1}>
        {detail}
      </Text>
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
  detail: {
    marginTop: 2,
  },
  dimmed: {
    color: colors.text.tertiary,
  },
});
