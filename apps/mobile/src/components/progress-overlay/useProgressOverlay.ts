import ProgressOverlayContext, { type ProgressOverlayActions } from './ProgressOverlayContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useProgressOverlay(): ProgressOverlayActions {
  return useRequiredContext(ProgressOverlayContext, 'useProgressOverlay needs a ProgressOverlayProvider above it');
}
