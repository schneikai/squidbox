import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

// A list's vertical scroll offset, kept current on the UI thread: for what reacts to it (a sticky
// photo in Compare) or a gesture that needs it (AssetList's drag-select).
export default function useScrollY() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return { scrollY, onScroll };
}
