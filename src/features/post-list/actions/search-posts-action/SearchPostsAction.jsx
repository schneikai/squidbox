import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import actionButtonStyles from '@/styles/actionButtonStyles';

export default function SearchPostsAction({ isSearchBarVisible, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[actionButtonStyles.button, isSearchBarVisible && actionButtonStyles.buttonActive]}
    >
      <Ionicons name="search-outline" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
