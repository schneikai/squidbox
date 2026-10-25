import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/**
 * Closes the screen once `shouldClose`, with `message` as an alert when given. A screen that is
 * already leaving isn't focused anymore and says nothing; one whose reason came while another
 * screen was on top of it closes when it is back in focus.
 */
export default function useCloseWhen(shouldClose, message) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!shouldClose) return;
    function closeIfFocused() {
      if (!navigation.isFocused()) return;
      if (message) Alert.alert(message);
      navigation.goBack();
    }
    closeIfFocused();
    return navigation.addListener('focus', closeIfFocused);
  }, [shouldClose]);
}
