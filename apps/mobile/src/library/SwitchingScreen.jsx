import libraryLabel from './libraryLabel';

import StatusScreen from '@/components/StatusScreen';

// Shown while one library closes and another opens (LibraryGate in App.js): nothing of the app is
// mounted meanwhile, so no screen reads across the switch.
export default function SwitchingScreen({ library }) {
  return <StatusScreen busy title={`Opening ${libraryLabel(library)}…`} />;
}
