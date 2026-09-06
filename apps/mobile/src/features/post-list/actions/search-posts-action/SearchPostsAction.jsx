import { Pressable } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

export default function SearchPostsAction({ isSearchBarVisible, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[actionButtonStyles.button, isSearchBarVisible && actionButtonStyles.buttonActive]}
    >
      <Icon name="search" color={colors.text} />
    </Pressable>
  );
}
