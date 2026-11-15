import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import Button from '@/components/Button';
import useCopyText from '@/hooks/useCopyText';

// How long the check stands in for the copy icon after a copy.
const COPIED_MS = 1500;

type CopyTextButtonProps = {
  text: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A bare copy icon that puts `text` on the clipboard (useCopyText), then shows a check for a moment,
 * like a chat app's. style is for layout only.
 */
export default function CopyTextButton({ text, style }: CopyTextButtonProps) {
  const copy = useCopyText();
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timer = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  async function handlePress() {
    await copy(text);
    setIsCopied(true);
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
