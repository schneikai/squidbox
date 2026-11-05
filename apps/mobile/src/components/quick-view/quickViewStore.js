import createStore from '@/lib/createStore';

// The open quick view, or `null`: `{ asset, routeKey }`, the photo peeked at and the sheet its grid
// lives in (`null` in the main app), so only that surface's QuickViewHost shows it. Grids set it on
// a peek and clear it on the release.
const quickViewStore = createStore(null);

export default quickViewStore;
