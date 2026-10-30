import { StyleSheet, View } from 'react-native';

import isTurnPassed from './isTurnPassed';
import missReason from './missReason';
import secondsText from './secondsText';

import Badge from '@/components/Badge';
import IntroText from '@/components/IntroText';
import Text from '@/components/Text';

/** Under a reply of a Verify conversation: Passed or Missed, how long it took, and why it missed. */
export default function VerifyVerdict({ turn }) {
  const isPassed = isTurnPassed(turn);
  return (
    <View style={styles.verdict}>
      <View style={styles.line}>
        <Badge label={isPassed ? 'Passed' : 'Missed'} tone={isPassed ? 'success' : 'danger'} />
        {turn.seconds !== null && <IntroText>{secondsText(turn.seconds)}</IntroText>}
      </View>
      {!isPassed && (
        <Text variant="error" size="small">
          {missReason(turn)}
        </Text>
      )}
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
