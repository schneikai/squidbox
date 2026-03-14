import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import actionButtonStyles from '@/styles/actionButtonStyles';

export default function ToggleSelectAssetsAction({ isSelectMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[actionButtonStyles.button, isSelectMode && actionButtonStyles.buttonActive]}>
      <Ionicons name="checkmark" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
