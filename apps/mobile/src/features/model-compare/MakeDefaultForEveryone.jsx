import { MODEL_DEFAULT_VARIANTS } from '@squidbox/shared';

import modelKindText from './modelKindText';

import ActionButtons from '@/components/ActionButtons';
import { SectionFooter } from '@/components/settings-list/SettingsList';
import useMakeDefaultForEveryone from '@/hooks/useMakeDefaultForEveryone';
import findCatalogModel from '@/utils/ai/findCatalogModel';

// "<lead> A, or B for Adult content." or, for one model, "<lead> A." (`names` by variant).
function usesText(lead, { regular, unrestricted }) {
  return regular === unrestricted ? `${lead} ${regular}.` : `${lead} ${regular}, or ${unrestricted} for Adult content.`;
}

/**
 * The end of a model list of `kind`: what everyone uses now (`defaults`, the published defaults),
 * and while this account's picks (`yourDefaults`) differ, Make default for everyone, which confirms
 * and runs `publishDefaults` (useYourModels'). `catalog` names the models; a published default
 * Venice dropped shows by its id.
 */
export default function MakeDefaultForEveryone({ kind, catalog, defaults, yourDefaults, publishDefaults }) {
  const { isPublishing, publish } = useMakeDefaultForEveryone();

  const text = modelKindText[kind];
  const published = defaults[kind];
  const picked = yourDefaults[kind];
  const isChanged = MODEL_DEFAULT_VARIANTS.some((variant) => picked[variant] !== published[variant]);
  const actions = [
    isChanged && {
      label: 'Make default for everyone',
      tone: 'accent',
      onPress: handlePublish,
      loading: isPublishing,
    },
  ].filter(Boolean);

  function namesOf(ids) {
    return Object.fromEntries(
      MODEL_DEFAULT_VARIANTS.map((variant) => [variant, findCatalogModel(catalog, ids[variant])?.name ?? ids[variant]]),
    );
  }

  function handlePublish() {
    return publish(usesText(text.everyAccountUses, namesOf(picked)), publishDefaults);
  }

  return (
    <>
      <SectionFooter>{usesText(text.everyoneUses, namesOf(published))}</SectionFooter>
      <ActionButtons actions={actions} />
    </>
  );
}
