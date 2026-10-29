import { MODEL_DEFAULT_VARIANTS } from '@squidbox/shared';

import modelKindText from './modelKindText';

import ActionButtons from '@/components/ActionButtons';
import useApplyChangesForEveryone from '@/hooks/useApplyChangesForEveryone';
import useHaptics from '@/hooks/useHaptics';
import findCatalogModel from '@/utils/ai/findCatalogModel';

// "<lead> A, or B for Adult content." or, for one model, "<lead> A." (`names` by variant).
function usesText(lead, { regular, unrestricted }) {
  return regular === unrestricted ? `${lead} ${regular}.` : `${lead} ${regular}, or ${unrestricted} for Adult content.`;
}

/**
 * The end of a model list of `kind`, while this account's picks of the defaults differ from the
 * published ones: Apply changes for everyone, which confirms with `yourDefaults` (named from
 * `catalog`, or by id) and runs `publishDefaults`, and Reset changes, which runs `resetDefaults`
 * (all useYourModels'). The parent renders it only then.
 */
export default function ModelDefaultsActions({ kind, catalog, yourDefaults, publishDefaults, resetDefaults }) {
  const haptics = useHaptics();
  const { isPublishing, publish } = useApplyChangesForEveryone();

  const ids = yourDefaults[kind];
  const names = Object.fromEntries(
    MODEL_DEFAULT_VARIANTS.map((variant) => [variant, findCatalogModel(catalog, ids[variant])?.name ?? ids[variant]]),
  );
  const actions = [
    { label: 'Apply changes for everyone', tone: 'accent', onPress: handlePublish, loading: isPublishing },
    { label: 'Reset changes', tone: 'danger', onPress: handleReset },
  ];

  function handlePublish() {
    return publish(usesText(modelKindText[kind].everyAccountUses, names), publishDefaults);
  }

  // Back to the published defaults, a local write like a pick on a model's page.
  async function handleReset() {
    await resetDefaults();
    haptics.success();
  }

  return <ActionButtons actions={actions} />;
}
