import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';

import actionButtonStyles from '@/styles/actionButtonStyles';

export default function AddPostAction() {
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.navigate('CreatePostModal')}
      style={[actionButtonStyles.button, { marginRight: 20 }]}
    >
      <Ionicons name="add" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
