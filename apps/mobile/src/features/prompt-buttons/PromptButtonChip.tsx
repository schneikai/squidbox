import type { NewPromptButton } from '@squidbox/shared';

import isIconName from './isIconName';

import Chip, { type ChipProps, type ChipVariant } from '@/components/Chip';

type PromptButtonChipProps = {
  button: NewPromptButton;
  variant?: Extract<ChipVariant, 'action' | 'raised'>;
  onPress: (button: NewPromptButton) => void;
  accessibilityHint?: ChipProps['accessibilityHint'];
};

/**
 * A prompt button as a chip with its icon; a tap calls `onPress(button)`. `variant` is the Chip's:
 * `action` (outlined, the default) or `raised` (lifted, in a
 * PromptButtonRow).
 */
export default function PromptButtonChip({
  button,
  variant = 'action',
  onPress,
  accessibilityHint,
}: PromptButtonChipProps) {
  return (
    <Chip
      label={button.name}
      // A stored name Icon doesn't know shows no icon.
      icon={isIconName(button.icon) ? button.icon : undefined}
      variant={variant}
      onPress={() => onPress(button)}
      accessibilityHint={accessibilityHint}
    />
  );
}
