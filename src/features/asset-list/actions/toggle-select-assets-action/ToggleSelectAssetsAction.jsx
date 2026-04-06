import Icon from '@/components/Icon';
import { Pressable } from 'react-native';

import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

export default function ToggleSelectAssetsAction({ isSelectMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[actionButtonStyles.button, isSelectMode && actionButtonStyles.buttonActive]}>
      <Icon name="check" color={colors.text} />
    </Pressable>
  );
}
