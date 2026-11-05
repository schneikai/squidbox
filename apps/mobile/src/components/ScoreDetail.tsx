import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import { colors, typography } from '@/styles/designTokens';

export type ScoreDetailProps = { score?: number | null; detail: string };

/**
 * A model's grey line inside its Text: a score above 0 and the thumbs-up icon, then ` · ${detail}`;
 * only `detail` without one. The parent Text's accessibilityLabel is scoreDetailLabel.
 */
export default function ScoreDetail({ score, detail }: ScoreDetailProps): ReactNode {
  if (!((score ?? 0) > 0)) return detail;
  return (
    <>
      {`${score} `}
      <Icon name="thumbs-up" size={typography.footnote} color={colors.text.secondary} style={styles.icon} />
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
