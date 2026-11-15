// React Native's TextInputState, outside its public API (exports map: no types for Libraries/*):
// the calls MentionInput makes, as React Native's own generated types declare them.
declare module 'react-native/Libraries/Components/TextInput/TextInputState' {
  import type { HostInstance } from 'react-native';

  const TextInputState: {
    focusInput(textField: HostInstance | null | undefined): void;
    blurInput(textField: HostInstance | null | undefined): void;
    registerInput(textField: HostInstance): void;
    unregisterInput(textField: HostInstance): void;
  };
  export default TextInputState;
}
