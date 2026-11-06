// A png import is an image source. expo-router ships this declaration in its assets.d.ts, but nothing
// in the program references that file, so it is declared here.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
