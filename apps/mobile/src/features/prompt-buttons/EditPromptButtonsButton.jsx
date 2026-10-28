import { useNavigation } from '@react-navigation/native';

import IconButton from '@/components/IconButton';
import { colors, sizes } from '@/styles/designTokens';

/** The small pencil beside a row of prompt buttons: opens Settings → Assistant → Prompt buttons. */
export default function EditPromptButtonsButton() {
  const navigation = useNavigation();
  return (
    <IconButton
      icon="pencil"
      size={sizes.iconSmall}
      color={colors.text.secondary}
      onPress={() => navigation.navigate('PromptButtonsScreen')}
      accessibilityLabel="Edit prompt buttons"
    />
  );
}
