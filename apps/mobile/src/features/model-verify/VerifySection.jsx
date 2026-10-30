import { useFocusEffect, useNavigation } from '@react-navigation/native';

import VerifyRunRow from './VerifyRunRow';
import useVerifyRun from './useVerifyRun';
import verifyFootnote from './verifyFootnote';
import verifySummary from './verifySummary';

import CatalogStatus from '@/components/CatalogStatus';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';

/**
 * The model page's Verify (`model` the catalog model, null once Venice dropped it): the latest run's
 * status, which opens the Verify page, and Verify (again) with its cost, which confirms once, starts
 * the run and opens the page on it. Read again whenever the page shows, so a run started or
 * finished elsewhere shows here too.
 */
export default function VerifySection({ kind, modelId, name, model }) {
  const navigation = useNavigation();
  const { run, plan, error, retry, show } = useVerifyRun(kind, modelId);
  useFocusEffect(retry);

  const isLoaded = run !== undefined && plan !== undefined;
  const { title, detail } = isLoaded ? verifySummary(kind, run) : {};

  function handleOpen() {
    navigation.navigate('VerifyScreen', { kind, modelId, name });
  }

  function handleStarted(answer) {
    show(answer);
    handleOpen();
  }

  return (
    <>
      <ScreenSectionHeader title="Verify" />
      {isLoaded ? (
        <>
          <Section>
            <Row
              label={title}
              description={detail ?? undefined}
              chevron={run !== null}
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
