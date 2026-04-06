/**
 * Shared navigation state helpers for floating bar components.
 * Extracted to avoid duplication across FloatingHeader, FloatingActionsBar,
 * FloatingNavigationBar.
 */

/**
 * Finds the MainTab route regardless of whether a modal is currently on top.
 * When a modal is active the root stack's active index points to the modal,
 * not to MainTab — so we search all routes instead of only looking at index.
 */
function getMainTabRoute(state) {
  if (!state) return null;
  // Prefer the active route if it is MainTab (common case, no modal open)
  const active = state.routes[state.index];
  if (active?.name === 'MainTab') return active;
  // A modal is on top — find MainTab in the route list
  return state.routes.find((r) => r.name === 'MainTab') ?? null;
}

/**
 * Returns the active tab name (e.g. 'AssetsTab') from the full nav state.
 * Defaults to 'AssetsTab' while the tab navigator is mounting for the first time.
 * Works correctly even when a modal is layered on top of MainTab.
 */
export function getActiveTabName(state) {
  const mainTab = getMainTabRoute(state);
  if (!mainTab?.state) return 'AssetsTab';
  const tabRoute = mainTab.state.routes[mainTab.state.index ?? 0];
  return tabRoute?.name ?? 'AssetsTab';
}

/**
 * Returns how many screens deep we are inside the active tab stack.
 * 0 = root tab screen, >0 = pushed detail screen.
 * Works correctly even when a modal is layered on top of MainTab.
 */
export function getActiveStackDepth(state) {
  const mainTab = getMainTabRoute(state);
  if (!mainTab?.state) return 0;
  const tabRoute = mainTab.state.routes[mainTab.state.index ?? 0];
  if (tabRoute?.state) return tabRoute.state.index ?? 0;
  return 0;
}
