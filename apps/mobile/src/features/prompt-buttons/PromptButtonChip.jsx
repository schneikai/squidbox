import Chip from '@/components/Chip';

/** A prompt button as an outlined chip with its icon; a tap calls `onPress(button)`. */
export default function PromptButtonChip({ button, onPress, accessibilityHint }) {
  return (
    <Chip
      label={button.name}
      icon={button.icon}
      variant="outlined"
      onPress={() => onPress(button)}
      accessibilityHint={accessibilityHint}
    />
  );
}
