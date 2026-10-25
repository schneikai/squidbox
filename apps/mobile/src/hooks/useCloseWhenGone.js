import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/**
 * Closes the screen with an alert once its record is gone: `record` is `null` when it doesn't exist
 * (deleted, e.g. by a sync, while the screen was open), `undefined` while it loads. A screen that is
 * already leaving (its own delete went back) isn't focused anymore and says nothing; one gone while
 * another screen was on top of it closes when it is back in focus. Without a `message` it closes
 * without an alert.
 */
export default function useCloseWhenGone(record, message) {
  const navigation = useNavigation();

  useEffect(() => {
    if (record !== null) return;
    function closeIfFocused() {
      if (!navigation.isFocused()) return;
      if (message) Alert.alert(message);
      navigation.goBack();
    }
    closeIfFocused();
    return navigation.addListener('focus', closeIfFocused);
  }, [record]);
}
