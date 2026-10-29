import { StyleSheet, Text, View } from 'react-native';

import ProgressBar from './ProgressBar';
import VerifyStatusIcon from './VerifyStatusIcon';
import isTurnPassed from './isTurnPassed';
import missSummary from './missSummary';
import turnUnit from './turnUnit';
import verifySummary from './verifySummary';

import Card from '@/components/Card';
import IntroText from '@/components/IntroText';
import { colors, lineHeights, typography } from '@/styles/designTokens';
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
      <Card style={styles.card}>
        <Text style={styles.title}>Verifying {name}</Text>
        {kind === 'writing' && next && <IntroText numberOfLines={2}>Now: {next}</IntroText>}
        <ProgressBar progress={run.turnsDone / run.turnsTotal} accessibilityLabel={`Verifying ${name}`} />
        <IntroText>
          {run.turnsDone} of {run.turnsTotal} {unit.plural}
        </IntroText>
      </Card>
    );
  }

  // Stopped: the server's reason (a phrase without an end mark), and that the turns before passed.
  const turns = run.result?.sections.flatMap((section) => section.turns) ?? [];
  const allBeforePassed = run.turnsDone > 0 && turns.every(isTurnPassed);
  const before = pluralizeText(`The ${unit.one} before`, `The %{count} ${unit.plural} before`, run.turnsDone);
  const stoppedText = [run.error, allBeforePassed && `${before} passed`].filter(Boolean).join('. ');

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <VerifyStatusIcon status={icon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <IntroText>
        {name} · {detail}
      </IntroText>
      {run.status === 'stopped'
        ? stoppedText && <Text style={styles.text}>{stoppedText}.</Text>
        : run.result && <Text style={styles.text}>{missSummary(run.result, plan, kind)}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    marginBottom: 8,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  text: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.primary,
  },
});
