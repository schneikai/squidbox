import type { AiModelKind, VerifyPlan, VerifyRun } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

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
import { space } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

type VerifyStatusCardProps = { kind: AiModelKind; name: string; run: VerifyRun; plan: VerifyPlan };

/**
 * The top of the Verify page for a `run` of `kind` on the model `name`: while it runs what this turn
 * asks and how far it is; done, how many turns passed, when, how fast and one sentence on the misses;
 * stopped, at which turn and why.
 */
export default function VerifyStatusCard({ kind, name, run, plan }: VerifyStatusCardProps) {
  const unit = turnUnit(kind);
  const { title, detail, icon } = verifySummary(kind, run);

  if (run.status === 'running') {
    const next = plan.sections.flatMap((section) => section.prompts)[run.turnsDone];
    return (
      <Card padded>
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
    <Card padded>
      <View style={styles.heading}>
        <VerifyStatusIcon status={icon} />
        <Text variant="title">{title}</Text>
      </View>
      <IntroText>
        {name} · {detail}
      </IntroText>
      {run.status === 'stopped' && stoppedText !== '' ? <Text size="small">{stoppedText}.</Text> : null}
      {run.status === 'done' && run.result ? <Text size="small">{missSummary(run.result, plan, kind)}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm, // an icon from its title
  },
});
