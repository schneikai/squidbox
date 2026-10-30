import { useNavigation } from '@react-navigation/native';

import Button from '@/components/Button';

/** The small pencil beside a row of prompt buttons: opens Settings → Assistant → Prompt buttons. */
export default function EditPromptButtonsButton() {
  const navigation = useNavigation();
  return (
    <Button
      icon="pencil"
      size="small"
      colorPalette="muted"
      onPress={() => navigation.navigate('PromptButtonsScreen')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
