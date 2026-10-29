import confirmVerifyAsync from './confirmVerifyAsync';
import verifyCostText from './verifyCostText';

import { Row } from '@/components/settings-list/SettingsList';
import useAiCatalog from '@/hooks/useAiCatalog';

/**
 * The row that starts a Verify of `model` for `kind` (a catalog model; `plan` the kind's): "Verify"
 * before the first run, "Verify again" after (`hasRun`), with about what it costs. A tap confirms
 * once, starts it and calls `onStarted({ run, plan })`.
 */
export default function VerifyRunRow({ kind, plan, model, hasRun, onStarted }) {
  const { models } = useAiCatalog();

  async function handlePress() {
    const answer = await confirmVerifyAsync(kind, plan, model, models);
    if (answer) onStarted(answer);
  }

  return (
    <Row
      label={hasRun ? 'Verify again' : 'Verify'}
      value={verifyCostText(kind, plan, model, models)}
      onPress={handlePress}
    />
  );
}
