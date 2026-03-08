import { use } from 'react';

import ProgressOverlayContext from './ProgressOverlayContext';

export default function useProgressOverlay() {
  return use(ProgressOverlayContext);
}
