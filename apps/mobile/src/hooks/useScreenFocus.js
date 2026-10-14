import { NavigationContext } from '@react-navigation/native';
import { use, useEffect, useState } from 'react';

// Whether the screen this renders in is focused; always true outside a navigator (useIsFocused
// throws there). Initialized from the navigator, not `true`: a screen that mounts unfocused gets no
// blur event. React Navigation propagates blur into nested navigators, so a tab under a pushed
// root-stack screen is blurred too.
export default function useScreenFocus() {
  const navigation = use(NavigationContext);
  const [isFocused, setIsFocused] = useState(() => navigation?.isFocused() ?? true);

  useEffect(() => {
    if (!navigation) return;
    setIsFocused(navigation.isFocused());
    const unsubscribeFocus = navigation.addListener('focus', () => setIsFocused(true));
    const unsubscribeBlur = navigation.addListener('blur', () => setIsFocused(false));
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  return isFocused;
}
