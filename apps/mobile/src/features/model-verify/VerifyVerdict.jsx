import { StyleSheet, View } from 'react-native';

import isTurnPassed from './isTurnPassed';
import missReason from './missReason';
import secondsText from './secondsText';

import Badge from '@/components/Badge';
import ErrorText from '@/components/ErrorText';
import IntroText from '@/components/IntroText';

/** Under a reply of a Verify conversation: Passed or Missed, how long it took, and why it missed. */
export default function VerifyVerdict({ turn }) {
  const isPassed = isTurnPassed(turn);
  return (
    <View style={styles.verdict}>
      <View style={styles.line}>
        <Badge label={isPassed ? 'Passed' : 'Missed'} tone={isPassed ? 'success' : 'danger'} />
        {turn.seconds !== null && <IntroText>{secondsText(turn.seconds)}</IntroText>}
      </View>
      {!isPassed && <ErrorText isSmall>{missReason(turn)}</ErrorText>}
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
});
