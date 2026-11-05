import Chip from '@/components/Chip';

/**
 * A prompt button as a chip with its icon; a tap calls `onPress(button)`. `variant` is the Chip's:
 * `action` (outlined, the default) or `raised` (on the assistant's tray).
 */
export default function PromptButtonChip({ button, variant = 'action', onPress, accessibilityHint }) {
  return (
    <Chip
      label={button.name}
      icon={button.icon}
      variant={variant}
      onPress={() => onPress(button)}
      accessibilityHint={accessibilityHint}
    />
  );
}
