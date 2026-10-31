import Button from '@/components/Button';
import useCopyText from '@/hooks/useCopyText';
import isPresent from '@/utils/isPresent';

// Copy as a small text link that puts `text` on the clipboard (useCopyText); nothing without text.
// style is for layout only.
export default function CopyTextButton({ text, style }) {
  const copy = useCopyText();

  if (!isPresent(text)) return null;

  return <Button label="Copy" icon="copy" size="small" onPress={() => copy(text)} style={style} />;
}
