import type { AiModelKind, ApiAiModel, VerifyRunResponse } from '@squidbox/shared';
import { router, useFocusEffect } from 'expo-router';

import VerifyRunRow from './VerifyRunRow';
import useVerifyRun from './useVerifyRun';
import verifyFootnote from './verifyFootnote';
import verifySummary from './verifySummary';

import CatalogStatus from '@/components/CatalogStatus';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';

type VerifySectionProps = { kind: AiModelKind; modelId: string; name: string; model: ApiAiModel | null };

/**
 * The model page's Verify (`model` the catalog model, null once Venice dropped it): the latest run's
 * status, which opens the Verify page, and Verify (again) with its cost, which confirms once, starts
 * the run and opens the page on it. Read again whenever the page shows, so a run started or
 * finished elsewhere shows here too.
 */
export default function VerifySection({ kind, modelId, name, model }: VerifySectionProps) {
  const { run, plan, error, retry, show } = useVerifyRun(kind, modelId);
  useFocusEffect(retry);

  // Null until the run is in.
  const summary = run === undefined ? null : verifySummary(kind, run);

  function handleOpen() {
    router.navigate({
      pathname: '/settings/assistant/models/[kind]/[modelId]/verify',
      params: { kind, modelId, name },
    });
  }

  function handleStarted(answer: VerifyRunResponse) {
    show(answer);
    handleOpen();
  }

  return (
    <>
      <ScreenSectionHeader title="Verify" />
      {summary && plan ? (
        <>
          <Section>
            <Row
              label={summary.title}
              description={summary.detail ?? undefined}
              hasChevron={run !== null}
              onPress={run !== null ? handleOpen : undefined}
            />
            {model && run?.status !== 'running' && (
              <VerifyRunRow kind={kind} plan={plan} model={model} hasRun={run !== null} onStarted={handleStarted} />
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
