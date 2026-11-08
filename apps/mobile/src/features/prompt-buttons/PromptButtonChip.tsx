import type { NewPromptButton } from '@squidbox/shared';

import iconOrNone from './iconOrNone';

import Chip, { type ChipProps, type ChipVariant } from '@/components/Chip';

type PromptButtonChipProps = {
  button: NewPromptButton;
  variant?: Extract<ChipVariant, 'tag' | 'raised'>;
  onPress: (button: NewPromptButton) => void;
  accessibilityHint?: ChipProps['accessibilityHint'];
};

/**
 * A prompt button as a chip with its icon; a tap calls `onPress(button)`. `variant` is the Chip's:
 * `raised` (the default, in the assistant's tray) or `tag` (on a card, where white wouldn't show:
 * the Prompt buttons screen).
 */
export default function PromptButtonChip({
  button,
  variant = 'raised',
  onPress,
  accessibilityHint,
}: PromptButtonChipProps) {
  return (
    <Chip
      label={button.name}
      // A stored name Icon doesn't know shows no icon.
      icon={iconOrNone(button.icon)}
      variant={variant}
      onPress={() => onPress(button)}
      accessibilityHint={accessibilityHint}
    />
  );
}
