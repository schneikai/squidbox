import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import headerActionStyles from '@/styles/headerActionStyles';

export default function ActionButton({ onPress, iconName, destructive = false }) {
  return (
    <Pressable onPress={onPress} style={[headerActionStyles.button, destructive && headerActionStyles.buttonDanger]}>
      <Ionicons name={iconName} style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
