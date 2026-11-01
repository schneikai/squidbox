import { useNavigation } from '@react-navigation/native';

import Button from '@/components/Button';

/** The small pen beside a row of prompt buttons: opens Settings → Assistant → Prompt buttons. */
export default function EditPromptButtonsButton() {
  const navigation = useNavigation();
  return (
    <Button
      icon="edit"
      size="small"
      onPress={() => navigation.navigate('PromptButtonsScreen')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
