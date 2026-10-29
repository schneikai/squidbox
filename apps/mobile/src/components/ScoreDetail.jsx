import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import { colors, typography } from '@/styles/designTokens';

/**
 * A model's grey line inside its Text: a score above 0 and the thumbs-up icon, then ` · ${detail}`;
 * only `detail` without one. `isDimmed` greys the icon like the line. The parent Text's
 * accessibilityLabel is scoreDetailLabel.
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
  // Lines the icon's strokes up with the digits (checked on iOS).
  icon: {
    transform: [{ translateY: -typography.footnote / 24 }],
  },
});
