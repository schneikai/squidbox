// App entry. We can't use expo's default `AppEntry.js` here: under npm workspaces `expo`
// hoists to the ROOT node_modules, and AppEntry.js does `import App from '../../App'`
// relative to ITS OWN location — which now resolves to the repo root, not apps/mobile.
// So register the root component directly (the standard Expo monorepo entry pattern);
// `./App` is resolved relative to this file, so it stays correct regardless of hoisting.
// Must be the entry file's first import (React Navigation: gesture handler setup).
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { enableFreeze } from 'react-native-screens';

import App from './App';

// Screens that aren't visible (other tabs, screens under a pushed one) don't re-render; they
// catch up once when they come back. Without this, every write to the library re-sorts and
// re-renders screens nobody sees. Makes `freezeOnBlur` the default for all navigators.
enableFreeze(true);

registerRootComponent(App);
