import confirmAsync from '@/utils/confirmAsync';

/** "Discard changes?" for an editor with unsaved changes: resolves to whether to discard them. */
export default function confirmDiscardAsync() {
  return confirmAsync({ title: 'Discard changes?', action: 'Discard', destructive: true });
}
