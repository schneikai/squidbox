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
 * Apply changes for everyone (`publishDefaults`, confirmed with what `readDefaultsToApply` reads)
 * and Reset changes (`resetDefaults`), all useYourModels'. `isScreenEnd` as ActionButtons'.
 */
export default function ModelDefaultsActions({
  kind,
  readDefaultsToApply,
  publishDefaults,
  resetDefaults,
  isScreenEnd,
}) {
  const { isResetting, reset } = useResetChanges();
  const { isPublishing, publish } = useApplyChangesForEveryone();

  const actions = [
    { label: 'Apply changes for everyone', colorPalette: 'accent', onPress: handlePublish, loading: isPublishing },
    { label: 'Reset changes', colorPalette: 'danger', onPress: handleReset, loading: isResetting },
  ];

  // The confirm names the models that will apply, read fresh.
  function handlePublish() {
    return publish(async () => {
      const { models, ids } = await readDefaultsToApply();
      const names = Object.fromEntries(
        MODEL_DEFAULT_VARIANTS.map((variant) => [
          variant,
          findCatalogModel(models, ids[variant])?.name ?? ids[variant],
        ]),
      );
      return usesText(modelKindText[kind].everyAccountUses, names);
    }, publishDefaults);
  }

  // Back to the published defaults, a local write like a pick on a model's page.
  function handleReset() {
    return reset("Your picks are replaced by the app's.", resetDefaults);
  }

  return <ActionButtons actions={actions} isScreenEnd={isScreenEnd} />;
}
