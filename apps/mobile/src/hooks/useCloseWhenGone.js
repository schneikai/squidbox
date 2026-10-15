import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/**
 * Closes the screen with an alert once its record is gone: `record` is `null` when it doesn't exist
 * (deleted, e.g. by a sync, while the screen was open), `undefined` while it loads. A screen that is
 * already leaving (its own delete went back) isn't focused anymore and says nothing.
 */
export default function useCloseWhenGone(record, message) {
  const navigation = useNavigation();

  useEffect(() => {
    if (record !== null || !navigation.isFocused()) return;
    Alert.alert(message);
    navigation.goBack();
  }, [record]);
}
