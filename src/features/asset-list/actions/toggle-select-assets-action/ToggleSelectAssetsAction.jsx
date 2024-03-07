import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import headerActionStyles from '@/styles/headerActionStyles';

export default function ToggleSelectAssetsAction({ isSelectMode, onPress }) {
  return (
    <Pressable onPress={onPress} style={[headerActionStyles.button, isSelectMode && headerActionStyles.buttonActive]}>
      <Ionicons name="checkmark" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
