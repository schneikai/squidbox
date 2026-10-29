import { StyleSheet, Text, View } from 'react-native';

import countPassed from './countPassed';
import missReason from './missReason';
import secondsText from './secondsText';

import Badge from '@/components/Badge';
import IntroText from '@/components/IntroText';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/** Under a reply of a Verify conversation: Passed or Missed, how long it took, and why it missed. */
export default function VerifyVerdict({ turn }) {
  const isPassed = countPassed([turn]) === 1;
  return (
    <View style={styles.verdict}>
      <View style={styles.line}>
        <Badge label={isPassed ? 'Passed' : 'Missed'} tone={isPassed ? 'success' : 'danger'} />
        {turn.seconds !== null && <IntroText>{secondsText(turn.seconds)}</IntroText>}
      </View>
      {!isPassed && <Text style={styles.reason}>{missReason(turn)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: {
    gap: 4,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reason: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.status.danger,
  },
});
