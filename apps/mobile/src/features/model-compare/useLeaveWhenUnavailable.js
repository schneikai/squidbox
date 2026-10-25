import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

import useIsAssistantAvailable from './useIsAssistantAvailable';

/** Goes back from an Assistant screen once it isn't available anymore (a sign-out, say). */
export default function useLeaveWhenUnavailable() {
  const navigation = useNavigation();
  const isAvailable = useIsAssistantAvailable();

  useEffect(() => {
    if (!isAvailable && navigation.canGoBack()) navigation.goBack();
  }, [isAvailable]);

  return isAvailable;
}
