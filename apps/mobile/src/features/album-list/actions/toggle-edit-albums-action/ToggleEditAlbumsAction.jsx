import { Pressable } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

export default function ToggleEditAlbumsAction({ isEditMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[actionButtonStyles.button, isEditMode && actionButtonStyles.buttonActive]}>
      <Icon name="pencil" color={colors.text} />
    </Pressable>
  );
}
