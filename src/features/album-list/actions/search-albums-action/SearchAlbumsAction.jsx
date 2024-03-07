import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import headerActionStyles from '@/styles/headerActionStyles';

export default function SearchAlbumsAction({ isSearchBarVisible, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[headerActionStyles.button, isSearchBarVisible && headerActionStyles.buttonActive]}
    >
      <Ionicons name="search-outline" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
