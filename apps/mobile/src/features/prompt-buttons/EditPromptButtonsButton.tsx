import { router } from 'expo-router';

import Button from '@/components/Button';

/**
 * The small pen beside the chat's row of prompt buttons: opens the list of prompt buttons (Settings
 * → Assistant → Prompt buttons), pushed inside the chat's sheet. Muted, like every icon button.
 */
export default function EditPromptButtonsButton() {
  return (
    <Button
      icon="edit"
      size="small"
      onPress={() => router.navigate('/prompt-buttons')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
