import confirmVerifyAsync from './confirmVerifyAsync';
import verifyEstimate from './verifyEstimate';

import { Row } from '@/components/settings-list/SettingsList';
import useAiCatalog from '@/hooks/useAiCatalog';

/**
 * The row that starts a Verify of `model` for `kind` (a catalog model; `plan` the kind's): "Verify"
 * before the first run, "Verify again" after (`hasRun`), with about what it costs. A tap confirms
 * once, starts it and calls `onStarted({ run, plan })`.
 */
export default function VerifyRunRow({ kind, plan, model, hasRun, onStarted }) {
  const { models } = useAiCatalog();

  const estimate = verifyEstimate(kind, plan, model, models);

  async function handlePress() {
    const answer = await confirmVerifyAsync(kind, model, estimate);
    if (answer) onStarted(answer);
  }

  return <Row label={hasRun ? 'Verify again' : 'Verify'} value={estimate.costText} onPress={handlePress} />;
}
