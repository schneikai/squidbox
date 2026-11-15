import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import Button from '@/components/Button';

// How long the check stands in for the copy icon after a copy.
const COPIED_MS = 1500;

type CopyButtonProps = {
  /** Copies, and resolves to whether it did. */
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
    if (await onCopy()) setIsCopied(true);
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
