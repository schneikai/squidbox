import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import ChangedBadge from '@/components/ChangedBadge';
import ScoreDetail, { type ScoreDetailProps } from '@/components/ScoreDetail';
import { colors, radii, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { ModelLabels } from '@/utils/ai/modelLabels';
import scoreDetailLabel from '@/utils/ai/scoreDetailLabel';

type ModelSummaryProps = {
  name: string;
  labels: ModelLabels;
  detail: string;
  score?: ScoreDetailProps['score'];
  note?: string | null;
  isDimmed?: boolean;
};

// A model's name, its labels (`labels`, from modelLabels) as badges below it: Changed (a default of
// yours that everyone doesn't use), Verified, then the defaults; and a detail line under them, led
// by a `score` above 0 (its thumbs up); the admin's `note` under it on a sticky note, at most two lines. `isDimmed`
// greys the text, for a model Venice no longer offers.
export default function ModelSummary({ name, labels, detail, score, note, isDimmed = false }: ModelSummaryProps) {
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
    columnGap: space.sm,
    rowGap: space.xs,
    marginTop: space.xs,
  },
  detail: {
    marginTop: space.hair,
  },
  // A sticky note under the model.
  note: {
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radii.badge,
    overflow: 'hidden',
    backgroundColor: colors.background.note,
    color: colors.text.primary,
  },
  dimmed: {
    color: colors.text.tertiary,
  },
});
