import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { useSyncExternalStore } from 'react';

import uncensoredMarks from './uncensoredMarks';

import IconButton from '@/components/IconButton';
import useAiCatalog from '@/hooks/useAiCatalog';
import useHaptics from '@/hooks/useHaptics';
import { colors } from '@/styles/designTokens';
import findCatalogModel from '@/utils/ai/findCatalogModel';

/**
 * A compare card's 18+ button for the model `modelId` (on the card `label`, Model A): its Uncensored
 * label, the same mark as the switch on the model's page (every account sees it), on or off with one
 * tap whether its name is shown or not. It turns at once, on every card of the model.
 */
export default function UncensoredToggle({ modelId, label }) {
  const haptics = useHaptics();
  const { models } = useAiCatalog();
  const wanted = useSyncExternalStore(uncensoredMarks.wanted.subscribe, uncensoredMarks.wanted.get);

  const model = findCatalogModel(models, modelId);
  const isOn = wanted[modelId] ?? model?.isUncensored ?? false;

  function handlePress() {
    haptics.selection();
    uncensoredMarks.set(model, !isOn, (error) => {
      haptics.error();
      uncensoredMarks.alertFailed(error);
    });
  }

  if (!model) return null;

  return (
    <IconButton
      label="18+"
      variant="tinted"
      color={colors.text.secondary}
      isActive={isOn}
      onPress={handlePress}
      accessibilityLabel={`${MODEL_LABEL_NAMES.uncensored}, ${label}`}
    />
  );
}
