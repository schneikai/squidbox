import IconButton from '@/components/IconButton';

/**
 * Standard × close / dismiss button for modal headers.
 * ModalHeader wraps it in FloatingPill automatically.
 */
export default function ModalCloseButton({ onPress }) {
  return <IconButton icon="close" onPress={onPress} accessibilityLabel="Close" />;
}
