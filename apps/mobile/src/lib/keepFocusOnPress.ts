import { Platform } from 'react-native';

/**
 * Props for a View of suggestions under a text field. On the web a mousedown moves the focus, so a
 * press on a suggestion would blur the field and take the suggestions away before its click lands:
 * the mousedown keeps the focus in the field instead. On iOS the sheet or screen's ScrollView keeps
 * it (`keyboardShouldPersistTaps`). react-native-web passes onMouseDown to the DOM; React Native's
 * types don't name it.
 */
const keepFocusOnPress: object =
  Platform.OS === 'web' ? { onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() } : {};

export default keepFocusOnPress;
