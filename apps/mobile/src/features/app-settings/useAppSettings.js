import { use } from 'react';

import AppSettingsContext from './AppSettingsContext';

export default function useAppSettings() {
  return use(AppSettingsContext);
}
