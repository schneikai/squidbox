import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// react-native-draggable-flatlist 4.0.3 (the latest) calls InteractionManager whenever a list's
// keys change; React Native 0.88 removed it, so adding, removing or reordering a photo in the post
// editor or a channel in Settings → Channels crashed. patches/ (applied on install by the root
// postinstall) moves it to requestIdleCallback. Rendering the list needs a native runtime this suite
// doesn't have, so this checks every build of the package Metro or Node may resolve.
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('react-native-draggable-flatlist/package.json'));
const BUILDS = [
  'src/components/DraggableFlatList.tsx',
  'lib/module/components/DraggableFlatList.js',
  'lib/commonjs/components/DraggableFlatList.js',
];

describe('react-native-draggable-flatlist as installed', () => {
  it.each(BUILDS)("doesn't use React Native's removed InteractionManager in %s", (build) => {
    const code = readFileSync(join(root, build), 'utf8').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/InteractionManager/);
  });
});
