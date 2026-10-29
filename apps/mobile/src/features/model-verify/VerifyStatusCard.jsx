import { StyleSheet, Text, View } from 'react-native';

import ProgressBar from './ProgressBar';
import countPassed from './countPassed';
import missSummary from './missSummary';
import secondsText from './secondsText';
import turnUnit from './turnUnit';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import IntroText from '@/components/IntroText';
import { colors, lineHeights, sizes, typography } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';
import relativeTime from '@/utils/relativeTime';

/**
 * The top of the Verify page for a `run` of `kind` on the model `name`: while it runs what this turn
 * asks and how far it is; done, how many turns passed, when, how fast and one sentence on the misses;
 * stopped, at which turn and why.
 */
export default function VerifyStatusCard({ kind, name, run, plan }) {
  const unit = turnUnit(kind);
  const turns = run.result?.sections.flatMap((section) => section.turns) ?? [];
  const passed = countPassed(turns);
  const when = relativeTime(Date.parse(run.finishedAt ?? run.startedAt));

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

  if (run.status === 'stopped') {
    const before = pluralizeText(`The ${unit.one} before`, `The %{count} ${unit.plural} before`, run.turnsDone);
    const allBeforePassed = run.turnsDone > 0 && passed === run.turnsDone;
    return (
      <Card style={styles.card}>
        <View style={styles.heading}>
          <Icon name="alert" size={sizes.icon} color={colors.status.danger} />
          <Text style={styles.title}>Verify stopped</Text>
        </View>
        <IntroText>
          {name} · {when} · at turn {run.turnsDone + 1} of {run.turnsTotal}
        </IntroText>
        <Text style={styles.text}>
          {run.error}
          {allBeforePassed && `${/[.!?]$/.test(run.error ?? '') ? '' : '.'} ${before} passed.`}
        </Text>
      </Card>
    );
  }

  const hasMisses = passed < turns.length;
  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <Icon
          name={hasMisses ? 'close-circle' : 'check-circle'}
          size={sizes.icon}
          color={hasMisses ? colors.status.danger : colors.status.success}
        />
        <Text style={styles.title}>
          Passed {passed} of {run.turnsTotal}
        </Text>
      </View>
      <IntroText>
        {name} · {when} · {secondsText(run.result?.medianSeconds ?? 0)} {unit.each}
      </IntroText>
      {run.result && <Text style={styles.text}>{missSummary(run.result, plan, kind)}</Text>}
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
