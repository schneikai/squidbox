import { router } from 'expo-router';

import Button from '@/components/Button';

/**
 * The small pen beside a row of prompt buttons: opens the list of prompt buttons (Settings →
 * Assistant → Prompt buttons), pushed inside the chat's sheet. `colorPalette` is the Button's (muted
 * by default; `accent` on the assistant's tray, an exception to muted icon buttons).
 */
export default function EditPromptButtonsButton({ colorPalette }) {
  return (
    <Button
      icon="edit"
      size="small"
      colorPalette={colorPalette}
      onPress={() => router.navigate('/prompt-buttons')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
