import { createNavigationContainerRef } from '@react-navigation/native';

// Shared ref to the root NavigationContainer. FloatingNavigationBar lives OUTSIDE the navigator
// tree (it's a sibling of RootNavigator), so its useNavigation() would resolve to the container
// root helper — which silently DROPS navigate() calls made before the container is "ready". On the
// first-sync gate flip the heavy provider mount delays "ready" past when the (already-painted)
// library is tappable, so those early taps vanished. Going through this ref with an explicit
// readiness check fixes that: taps before ready are remembered and flushed the instant it is.
export const navigationRef = createNavigationContainerRef();

let pendingTab = null;

// Navigate to a main tab, or remember it if the container isn't ready yet (flushed by onReady).
export function navigateToTab(tab) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('MainTab', { screen: tab });
  } else {
    pendingTab = tab;
  }
}

// Wire to NavigationContainer's onReady: honor a tap that landed during the not-ready window.
export function flushPendingNavigation() {
  if (pendingTab && navigationRef.isReady()) {
    const tab = pendingTab;
    pendingTab = null;
    navigationRef.navigate('MainTab', { screen: tab });
  }
}
