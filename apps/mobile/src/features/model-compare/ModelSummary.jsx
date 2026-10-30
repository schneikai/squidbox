import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import ChangedBadge from '@/components/ChangedBadge';
import ScoreDetail from '@/components/ScoreDetail';
import { colors } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import scoreDetailLabel from '@/utils/ai/scoreDetailLabel';

// A model's name, its labels (`labels`, from modelLabels) as badges below it: Changed (a default of
// yours that everyone doesn't use), Verified, then the defaults; and a detail line under them, led
// by a `score` above 0 (its thumbs up); the admin's `note` under it, at most two lines. `isDimmed`
// greys the text, for a model Venice no longer offers.
export default function ModelSummary({ name, labels, detail, score, note, isDimmed = false }) {
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
        accessibilityLabel={scoreDetailLabel(score, detail)}
      >
        <ScoreDetail score={score} detail={detail} />
      </Text>
      {!!note && (
        <Text style={[listTextStyles.subtitle, styles.note]} numberOfLines={2}>
          {note}
        </Text>
      )}
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
    alignItems: 'flex-start',
    columnGap: 8,
    rowGap: 4,
    marginTop: 4,
  },
  detail: {
    marginTop: 2,
  },
  note: {
    color: colors.text.primary,
  },
  dimmed: {
    color: colors.text.tertiary,
  },
});
