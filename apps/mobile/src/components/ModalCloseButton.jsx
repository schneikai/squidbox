import IconButton from '@/components/IconButton';

/**
 * Standard × close / dismiss button for modal headers; `kind="back"` makes it the Back chevron of a
 * step pushed inside a sheet. ModalHeader wraps it in FloatingPill automatically.
 */
export default function ModalCloseButton({ onPress, kind = 'close' }) {
  const isBack = kind === 'back';
  return (
    <IconButton
      icon={isBack ? 'chevron-left' : 'close'}
      onPress={onPress}
      accessibilityLabel={isBack ? 'Back' : 'Close'}
    />
  );
}
