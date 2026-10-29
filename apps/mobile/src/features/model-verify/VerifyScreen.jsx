import { useEffect, useRef } from 'react';

import VerifyConversationsSection from './VerifyConversationsSection';
import VerifyPhotosSection from './VerifyPhotosSection';
import VerifyRunRow from './VerifyRunRow';
import VerifyStatusCard from './VerifyStatusCard';
import findCatalogModel from './findCatalogModel';
import useVerifyRun from './useVerifyRun';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useAiCatalog from '@/hooks/useAiCatalog';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

/**
 * A model's latest Verify of a kind (route params `kind`, `modelId`, `name`; an ai_admin tool), in
 * any state, the same run the model page shows (useVerifyRun): its status on top, then its
 * conversations (writing) or its photos (vision), and Verify again once it's no longer running. A
 * haptic marks the run finishing while the page is open.
 */
export default function VerifyScreen({ navigation, route }) {
  const { kind, modelId, name } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const haptics = useHaptics();
  const { models } = useAiCatalog();
  const { run, plan, error, retry, show } = useVerifyRun(kind, modelId);
  const previousStatus = useRef(run?.status);

  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = run?.status;
    if (before !== 'running') return;
    if (run?.status === 'done') haptics.success();
    if (run?.status === 'stopped') haptics.error();
  }, [run?.status, haptics]);

  // The catalog's model, null once Venice no longer offers it (no new run).
  const model = findCatalogModel(models, modelId);
  const canVerify = model !== null && run?.status !== 'running';

  function renderBody() {
    if (run === undefined || plan === undefined) {
      return <CatalogStatus title="Couldn't load Verify" error={error} retry={retry} />;
    }
    return (
      <>
        {error && (
          <Section>
            <Row label="Couldn't refresh Verify" description={error} value="Try again" onPress={retry} />
          </Section>
        )}
        {run === null ? (
          <EmptyState icon="list-checks" title="Not verified yet" />
        ) : (
          <>
            <VerifyStatusCard kind={kind} name={name} run={run} plan={plan} />
            {kind === 'vision' ? (
              <VerifyPhotosSection run={run} plan={plan} />
            ) : (
              <VerifyConversationsSection kind={kind} modelId={modelId} name={name} run={run} plan={plan} />
            )}
          </>
        )}
        {canVerify && (
          <Section isHeaderless>
            <VerifyRunRow kind={kind} plan={plan} model={model} hasRun={run !== null} onStarted={show} />
          </Section>
        )}
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Verify" onBack={() => navigation.goBack()} />
      <DetailScrollView>{renderBody()}</DetailScrollView>
    </Page>
  );
}
