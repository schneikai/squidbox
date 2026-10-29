import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import ChangedBadge from '@/components/ChangedBadge';
import ScoreDetail from '@/components/ScoreDetail';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import scoreText from '@/utils/ai/scoreText';

// A model's name, its labels (`labels`, from modelLabels) as badges below it: Changed (a default of
// yours that everyone doesn't use), Verified, then the defaults; and a detail line under them, led
// by a `score` above 0 (thumbs up, or tags that fit, for `kind`). `isDimmed` greys the text, for a
// model Venice no longer offers.
export default function ModelSummary({ name, labels, detail, kind, score, isDimmed = false }) {
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
      <Text
        style={[listTextStyles.subtitle, styles.detail, isDimmed && styles.dimmed]}
        accessibilityLabel={score > 0 ? `${scoreText(score, kind)} · ${detail}` : undefined}
      >
        <ScoreDetail score={score} detail={detail} isDimmed={isDimmed} />
      </Text>
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
