import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { VERIFY_JUDGE_MODEL_ID } from '@squidbox/shared';

import confirmVerifyAsync from './confirmVerifyAsync';
import findCatalogModel from './findCatalogModel';
import secondsText from './secondsText';
import turnUnit from './turnUnit';
import useVerifyRun from './useVerifyRun';
import verifyCostText from './verifyCostText';
import verifyFootnote from './verifyFootnote';
import verifyStatusText from './verifyStatusText';

import CatalogStatus from '@/components/CatalogStatus';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useAiCatalog from '@/hooks/useAiCatalog';
import relativeTime from '@/utils/relativeTime';

// When the run finished (or started, while it runs) and how it went, under the status row: "just
// now · 1.8 s a reply", "2 h ago · at turn 8 of 21".
function runDetail(kind, run) {
  if (run === null || run.status === 'running') return undefined;
  const when = relativeTime(Date.parse(run.finishedAt ?? run.startedAt));
  if (run.status === 'stopped') return `${when} · at turn ${run.turnsDone + 1} of ${run.turnsTotal}`;
  return `${when} · ${secondsText(run.result?.medianSeconds ?? 0)} ${turnUnit(kind).each}`;
}

/**
 * The model page's Verify (`model` the catalog model, null once Venice dropped it): the latest run's
 * status, which opens the Verify page, and Verify (again) with its cost, which confirms once, starts
 * the run and opens the page on it. Read again whenever the page shows, so a run started or
 * finished on the Verify page shows here too.
 */
export default function VerifySection({ kind, modelId, name, model }) {
  const navigation = useNavigation();
  const { models } = useAiCatalog();
  const { run, plan, error, retry, show } = useVerifyRun(kind, modelId);
  useFocusEffect(retry);

  const judge = findCatalogModel(models, VERIFY_JUDGE_MODEL_ID);
  const isLoaded = run !== undefined && plan !== undefined;

  function handleOpen() {
    navigation.navigate('VerifyScreen', { kind, modelId, name, initial: { run, plan } });
  }

  async function handleVerify() {
    const answer = await confirmVerifyAsync(kind, model, models);
    if (!answer) return;
    show(answer);
    navigation.navigate('VerifyScreen', { kind, modelId, name, initial: answer });
  }

  return (
    <>
      <ScreenSectionHeader title="Verify" />
      {isLoaded ? (
        <>
          <Section>
            <Row
              label={verifyStatusText(run)}
              description={runDetail(kind, run)}
              chevron={run !== null}
              onPress={run !== null ? handleOpen : undefined}
            />
            {model && run?.status !== 'running' && (
              <Row
                label={run ? 'Verify again' : 'Verify'}
                value={verifyCostText(kind, model, judge)}
                onPress={handleVerify}
              />
            )}
          </Section>
          <SectionFooter>{verifyFootnote(kind, plan)}</SectionFooter>
        </>
      ) : (
        <CatalogStatus title="Couldn't load Verify" error={error} retry={retry} />
      )}
    </>
  );
}
