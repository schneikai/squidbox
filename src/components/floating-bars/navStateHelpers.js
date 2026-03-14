/**
 * Shared navigation state helpers for floating bar components.
 * Extracted to avoid duplication across FloatingHeader, FloatingActionsBar,
 * FloatingNavigationBar.
 */

export const MAIN_TABS = ['AssetsTab', 'AlbumsTab', 'PostsTab'];

/**
 * Returns the active tab name (e.g. 'AssetsTab') from the full nav state.
 * Defaults to 'AssetsTab' while the tab navigator is mounting for the first time.
 */
export function getActiveTabName(state) {
  if (!state) return 'AssetsTab';
  const route = state.routes[state.index];
  if (!route) return 'AssetsTab';
  if (route.name === 'MainTab') {
    if (!route.state) return 'AssetsTab'; // tab state not yet initialised
    const tabRoute = route.state.routes[route.state.index ?? 0];
    return tabRoute?.name ?? 'AssetsTab';
  }
  return route.name;
}

/**
 * Returns how many screens deep we are inside the active tab stack.
 * 0 = root tab screen, >0 = pushed detail screen.
 */
export function getActiveStackDepth(state) {
  if (!state) return 0;
  const route = state.routes[state.index];
  if (!route) return 0;
  if (route.name === 'MainTab') {
    if (!route.state) return 0;
    const tabRoute = route.state.routes[route.state.index ?? 0];
    if (tabRoute?.state) return tabRoute.state.index ?? 0;
  }
  return 0;
}
