import { MODEL_DEFAULT_VARIANTS } from '@squidbox/shared';

import modelKindText from './modelKindText';

import ActionButtons from '@/components/ActionButtons';
import { SectionFooter } from '@/components/settings-list/SettingsList';
import useHaptics from '@/hooks/useHaptics';
import useMakeDefaultForEveryone from '@/hooks/useMakeDefaultForEveryone';
import findCatalogModel from '@/utils/ai/findCatalogModel';

// "<lead> A, or B for Adult content." or, for one model, "<lead> A." (`names` by variant).
function usesText(lead, { regular, unrestricted }) {
  return regular === unrestricted ? `${lead} ${regular}.` : `${lead} ${regular}, or ${unrestricted} for Adult content.`;
}

/**
 * The end of a model list of `kind`: what everyone uses now (`defaults`, the published defaults),
 * and while this account's picks (`yourDefaults`) differ (`isChanged`), Make default for everyone,
 * which confirms and runs `publishDefaults`, and Reset to default, which runs `resetDefaults` (both
 * useYourModels'). `catalog` names the models; a published default Venice dropped shows by its id.
 */
export default function ModelDefaultsFooter({
  kind,
  catalog,
  defaults,
  yourDefaults,
  isChanged,
  publishDefaults,
  resetDefaults,
}) {
  const haptics = useHaptics();
  const { isPublishing, publish } = useMakeDefaultForEveryone();

  const text = modelKindText[kind];
  const actions = isChanged
    ? [
        { label: 'Make default for everyone', tone: 'accent', onPress: handlePublish, loading: isPublishing },
        { label: 'Reset to default', tone: 'danger', onPress: handleReset },
      ]
    : [];

  function namesOf(ids) {
    return Object.fromEntries(
      MODEL_DEFAULT_VARIANTS.map((variant) => [variant, findCatalogModel(catalog, ids[variant])?.name ?? ids[variant]]),
    );
  }

  function handlePublish() {
    return publish(usesText(text.everyAccountUses, namesOf(yourDefaults[kind])), publishDefaults);
  }

  // Back to the published defaults, a local write like a pick on a model's page.
  async function handleReset() {
    await resetDefaults();
    haptics.success();
  }

  return (
    <>
      <SectionFooter>{usesText(text.everyoneUses, namesOf(defaults[kind]))}</SectionFooter>
      <ActionButtons actions={actions} />
    </>
  );
}
