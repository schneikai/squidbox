import { type ApiAiModel, MODEL_LABEL_NAMES } from '@squidbox/shared';
import { useSyncExternalStore } from 'react';

import uncensoredMarks from './uncensoredMarks';

import Button from '@/components/Button';
import useAiCatalog from '@/hooks/useAiCatalog';
import useHaptics from '@/hooks/useHaptics';
import findCatalogModel from '@/utils/ai/findCatalogModel';

type UncensoredToggleProps = { modelId: string; label: string };

/**
 * A compare card's 18+ button for the model `modelId` (on the card `label`, Model A): its Uncensored
 * label, the same mark as the switch on the model's page (every account sees it), on or off with one
 * tap whether its name is shown or not. It turns at once, on every card of the model.
 */
export default function UncensoredToggle({ modelId, label }: UncensoredToggleProps) {
  const { models } = useAiCatalog();
  const wanted = useSyncExternalStore(uncensoredMarks.wanted.subscribe, uncensoredMarks.wanted.get);

  const model = findCatalogModel(models, modelId);
  const isOn = wanted[modelId] ?? model?.isUncensored ?? false;

  if (!model) return null;

  return <UncensoredButton model={model} label={label} isOn={isOn} />;
}

type UncensoredButtonProps = { model: ApiAiModel; label: string; isOn: boolean };

// The button for a model the catalog has.
function UncensoredButton({ model, label, isOn }: UncensoredButtonProps) {
  const haptics = useHaptics();

  function handlePress() {
    haptics.selection();
    uncensoredMarks.set(model, !isOn, (error) => {
      haptics.error();
      uncensoredMarks.alertFailed(error);
    });
  }

  return (
    <Button
      label="18+"
      variant="secondary"
      isSelected={isOn}
      isSwitch
      onPress={handlePress}
      accessibilityLabel={`${MODEL_LABEL_NAMES.uncensored}, ${label}`}
    />
  );
}
