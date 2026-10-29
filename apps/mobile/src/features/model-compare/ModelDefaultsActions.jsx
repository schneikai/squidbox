import { MODEL_DEFAULT_VARIANTS } from '@squidbox/shared';

import modelKindText from './modelKindText';

import ActionButtons from '@/components/ActionButtons';
import useApplyChangesForEveryone from '@/hooks/useApplyChangesForEveryone';
import useResetChanges from '@/hooks/useResetChanges';
import findCatalogModel from '@/utils/ai/findCatalogModel';

// "<lead> A, or B for Adult content." or, for one model, "<lead> A." (`names` by variant).
function usesText(lead, { regular, unrestricted }) {
  return regular === unrestricted ? `${lead} ${regular}.` : `${lead} ${regular}, or ${unrestricted} for Adult content.`;
}

/**
 * The end of a model list of `kind` while this account's picks differ from the published defaults:
 * Apply changes for everyone (`publishDefaults`, confirmed with `yourDefaults` named from `catalog`)
 * and Reset changes (`resetDefaults`), all useYourModels'. `style` from the parent.
 */
export default function ModelDefaultsActions({ kind, catalog, yourDefaults, publishDefaults, resetDefaults, style }) {
  const reset = useResetChanges();
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
  function handleReset() {
    return reset("Your picks are replaced by the app's.", resetDefaults);
  }

  return <ActionButtons actions={actions} style={style} />;
}
