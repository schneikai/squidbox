import type { StyleProp, ViewStyle } from 'react-native';

import CopyButton from '@/components/CopyButton';
import useCopyText from '@/hooks/useCopyText';

type CopyTextButtonProps = {
  text: string;
  style?: StyleProp<ViewStyle>;
};

/** A copy icon (CopyButton) that puts `text` on the clipboard (useCopyText). style is for layout only. */
export default function CopyTextButton({ text, style }: CopyTextButtonProps) {
  const copy = useCopyText();

  return <CopyButton onCopy={() => copy(text)} style={style} />;
}
