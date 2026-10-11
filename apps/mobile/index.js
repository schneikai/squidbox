// App entry. We can't use expo's default `AppEntry.js` here: under npm workspaces `expo`
// hoists to the ROOT node_modules, and AppEntry.js does `import App from '../../App'`
// relative to ITS OWN location — which now resolves to the repo root, not apps/mobile.
// So register the root component directly (the standard Expo monorepo entry pattern);
// `./App` is resolved relative to this file, so it stays correct regardless of hoisting.
// Must be the entry file's first import (React Navigation: gesture handler setup).
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
