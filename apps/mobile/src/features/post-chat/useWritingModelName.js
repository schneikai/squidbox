import useAiCatalog from '@/hooks/useAiCatalog';
import usePersona from '@/hooks/usePersona';
import useYourDefaults from '@/hooks/useYourDefaults';
import findCatalogModel from '@/utils/ai/findCatalogModel';
import usedModelId from '@/utils/ai/usedModelId';

/**
 * The name of the writing model the chat uses (an ai_admin's own default, Uncensored when the
 * persona has adult content), for an ai_admin's chat header; null while it loads.
 */
export default function useWritingModelName() {
  const { models } = useAiCatalog();
  const persona = usePersona();
  const { yourDefaults } = useYourDefaults();

  const id = usedModelId(yourDefaults, 'writing', persona);
  if (!id) return null;
  return findCatalogModel(models, id)?.name ?? id;
}
