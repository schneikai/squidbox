import { useContext } from 'react';

import AppSettingsContext from './AppSettingsContext';

export default function useAppSettings() {
  return useContext(AppSettingsContext);
}
