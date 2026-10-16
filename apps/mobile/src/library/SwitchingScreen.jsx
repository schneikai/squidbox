import StatusScreen from '@/components/StatusScreen';

// Shown while one library closes and another opens (LibraryGate in App.js): nothing of the app is
// mounted meanwhile, so no screen reads across the switch.
export default function SwitchingScreen() {
  return <StatusScreen busy title="Opening your library…" />;
}
