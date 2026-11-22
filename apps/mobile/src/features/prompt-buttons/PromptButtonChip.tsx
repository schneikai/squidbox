import type { NewPromptButton } from '@squidbox/shared';

import iconOrNone from './iconOrNone';

import Chip, { type ChipProps } from '@/components/Chip';

type PromptButtonChipProps = {
  button: NewPromptButton;
  onPress: (button: NewPromptButton) => void;
  disabled?: boolean;
  accessibilityHint?: ChipProps['accessibilityHint'];
};

/**
 * A prompt button as a chip with its icon (a plain `tag` chip, in the assistant's tray, the chat and
 * the Prompt buttons screen alike); a tap calls `onPress(button)`. `disabled` dims it and takes no
 * presses.
 */
export default function PromptButtonChip({ button, onPress, disabled, accessibilityHint }: PromptButtonChipProps) {
  return (
    <Chip
      label={button.name}
      // A stored name Icon doesn't know shows no icon.
      icon={iconOrNone(button.icon)}
      onPress={() => onPress(button)}
      disabled={disabled}
      accessibilityHint={accessibilityHint}
    />
  );
}
