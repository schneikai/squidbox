import { router } from 'expo-router';
import { useContext } from 'react';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import Button from '@/components/Button';

/**
 * The small pen beside a row of prompt buttons: opens the list of prompt buttons (Settings →
 * Assistant → Prompt buttons), pushed inside the chat's sheet. Muted, like every icon button, but
 * on an AssistantTray (AssistantTrayContext) a light violet disc with a violet pen, part of the
 * assistant's look.
 */
export default function EditPromptButtonsButton() {
  const isOnTray = useContext(AssistantTrayContext) !== null;

  return (
    <Button
      icon="edit"
      size="small"
      variant={isOnTray ? 'secondary' : undefined}
      colorPalette={isOnTray ? 'accent' : undefined}
      onPress={() => router.navigate('/prompt-buttons')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
