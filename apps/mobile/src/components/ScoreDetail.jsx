import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import { colors, typography } from '@/styles/designTokens';

/**
 * A model's grey line inside its Text: a score above 0, then the thumbs-up icon, sized to the
 * footnote line, then ` · ${detail}`; only `detail` for a model never compared (`score` null) or
 * with none yet. `isDimmed` greys the icon like a dimmed line. The parent Text carries the spoken
 * label while a score shows (scoreText, not the icon).
 */
export default function ScoreDetail({ score, detail, isDimmed = false }) {
  if (!(score > 0)) return detail;
  return (
    <>
      {`${score} `}
      <Icon
        name="thumbs-up"
        size={typography.footnote}
        color={isDimmed ? colors.text.tertiary : colors.text.secondary}
        style={styles.icon}
      />
      {` · ${detail}`}
    </>
  );
}

const styles = StyleSheet.create({
  // iOS sets an inline view's bottom on the baseline; the icon's strokes end 2/24 above its box, so
  // this puts them on the baseline with the digits.
  icon: {
    transform: [{ translateY: typography.footnote / 12 }],
  },
});
