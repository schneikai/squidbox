import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import actionButtonStyles from '@/styles/actionButtonStyles';

export default function ToggleEditAlbumsAction({ isEditMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[actionButtonStyles.button, isEditMode && actionButtonStyles.buttonActive]}>
      <Ionicons name="pencil-outline" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
