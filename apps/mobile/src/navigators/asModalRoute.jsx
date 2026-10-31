import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProgressOverlayHost from '@/components/progress-overlay/ProgressOverlayHost';

// Modal routes present as iOS pageSheets whose own top safe-area inset is 0. Without a
// SafeAreaProvider INSIDE the sheet, screens read the root provider's window inset (~notch/status-bar
// height) and render a large empty gap below the sheet's top edge. Wrapping each modal route in its
// own provider makes useSafeAreaInsets() measure the sheet's view. The full-screen copies of these
// screens on the root stack are unaffected — they keep using the root provider, which is correct there.
export default function asModalRoute(Component) {
  function ModalRoute(props) {
    return (
      <SafeAreaProvider>
        {/* The root MenuProvider's menus would show behind the sheet too, so it has its own. */}
        <MenuProvider skipInstanceCheck>
          <Component {...props} />
        </MenuProvider>
        {/* This modal is a native sheet presented above the root, so the root's overlay host can't
            cover it. Render a host here too, inside the sheet, so a blocking/progress overlay
            triggered from within the modal covers the modal itself. */}
        <ProgressOverlayHost />
      </SafeAreaProvider>
    );
  }
  return ModalRoute;
}
