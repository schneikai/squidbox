import { StyleSheet, Text as RNText, View } from 'react-native';

import ProgressBar from './ProgressBar';
import VerifyStatusIcon from './VerifyStatusIcon';
import isTurnPassed from './isTurnPassed';
import missSummary from './missSummary';
import runTurns from './runTurns';
import turnUnit from './turnUnit';
import verifySummary from './verifySummary';

import Card from '@/components/Card';
import IntroText from '@/components/IntroText';
import Text from '@/components/Text';
import { colors, space, textStyles } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

/**
 * The top of the Verify page for a `run` of `kind` on the model `name`: while it runs what this turn
 * asks and how far it is; done, how many turns passed, when, how fast and one sentence on the misses;
 * stopped, at which turn and why.
 */
export default function VerifyStatusCard({ kind, name, run, plan }) {
  const unit = turnUnit(kind);
  const { title, detail, icon } = verifySummary(kind, run);

  if (run.status === 'running') {
    const next = plan.sections.flatMap((section) => section.prompts)[run.turnsDone];
    return (
      <Card padded style={styles.card}>
        <Text variant="title">Verifying {name}</Text>
        {kind === 'writing' && next && <IntroText numberOfLines={2}>Now: {next}</IntroText>}
        <ProgressBar progress={run.turnsDone / run.turnsTotal} accessibilityLabel={`Verifying ${name}`} />
        <IntroText>
          {run.turnsDone} of {run.turnsTotal} {unit.plural}
        </IntroText>
      </Card>
    );
  }

  // Stopped: the server's reason (a phrase without an end mark), and that the turns before passed.
  const allBeforePassed = run.turnsDone > 0 && runTurns(run).every(isTurnPassed);
  const before = pluralizeText(`The ${unit.one} before`, `The %{count} ${unit.plural} before`, run.turnsDone);
  const stoppedText = [run.error, allBeforePassed && `${before} passed`].filter(Boolean).join('. ');

  return (
    <Card padded style={styles.card}>
      <View style={styles.heading}>
        <VerifyStatusIcon status={icon} />
        <Text variant="title">{title}</Text>
      </View>
      <IntroText>
        {name} · {detail}
      </IntroText>
      {run.status === 'stopped' && stoppedText !== '' ? (
        <RNText style={[textStyles.subheadline, styles.text]}>{stoppedText}.</RNText>
      ) : null}
      {run.status === 'done' && run.result ? (
        <RNText style={[textStyles.subheadline, styles.text]}>{missSummary(run.result, plan, kind)}</RNText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    marginBottom: space.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  text: {
    color: colors.text.primary,
  },
});
