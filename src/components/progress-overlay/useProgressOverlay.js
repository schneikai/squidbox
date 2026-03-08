import { useContext } from 'react';

import ProgressOverlayContext from './ProgressOverlayContext';

export default function useProgressOverlay() {
  return useContext(ProgressOverlayContext);
}
