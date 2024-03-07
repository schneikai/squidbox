import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import headerActionStyles from '@/styles/headerActionStyles';

export default function ToggleEditAlbumsAction({ isEditMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[headerActionStyles.button, isEditMode && headerActionStyles.buttonActive]}>
      <Ionicons name="pencil-outline" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
