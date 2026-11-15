import { useEffect, useState } from 'react';
import { Alert, type StyleProp, type ViewStyle } from 'react-native';

import Button from '@/components/Button';

// How long the check stands in for the copy icon after a copy.
const COPIED_MS = 1500;

type CopyButtonProps = {
  /** Copies, and resolves to whether it did; one that rejects says "Couldn't copy the text". */
  onCopy: () => Promise<boolean>;
  style?: StyleProp<ViewStyle>;
};

/**
 * A bare copy icon: a tap calls `onCopy`, and once it copied a check stands in for a moment, like a
 * chat app's. style is for layout only.
 */
export default function CopyButton({ onCopy, style }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timer = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  async function handlePress() {
    try {
      if (await onCopy()) setIsCopied(true);
    } catch (error) {
      // Before the clipboard: what was to be copied couldn't be read (useCopyText says the rest).
      console.error("Couldn't copy the text", error);
      Alert.alert("Couldn't copy the text");
    }
  }

  return (
    <Button
      icon={isCopied ? 'check' : 'copy'}
      size="small"
      accessibilityLabel={isCopied ? 'Copied' : 'Copy text'}
      onPress={handlePress}
      style={style}
    />
  );
}
