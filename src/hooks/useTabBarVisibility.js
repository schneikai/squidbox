import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useLayoutEffect } from 'react';

export default function useTabBarVisibility(navigation, route, screenName) {
  const getTabBarVisibility = (route) => {
    const routeName = getFocusedRouteNameFromRoute(route) ?? '';

    if (routeName === screenName) {
      return 'none';
    }
    return 'flex';
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: getTabBarVisibility(route) },
    });
  }, [navigation, route]);
}
