import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';

import headerActionStyles from '@/styles/headerActionStyles';

export default function AddPostAction() {
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.navigate('AddEditPostModal')}
      style={[headerActionStyles.button, { marginRight: 20 }]}
    >
      <Ionicons name="add" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
