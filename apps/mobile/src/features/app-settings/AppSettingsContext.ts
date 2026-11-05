import { createContext } from 'react';

import type { AppSettings } from './AppSettingsProvider';

// A setting's setter, named after it (`isHapticsOn` → `setIsHapticsOn`): it takes the new value or,
// like useState's, a function of the current one. The provider builds them by name, so this mapped
// type says what it builds.
export type AppSettingsSetters = {
  [K in keyof AppSettings as `set${Capitalize<K>}`]: (
    value: AppSettings[K] | ((current: AppSettings[K]) => AppSettings[K]),
  ) => void;
};

export type AppSettingsContextValue = AppSettings & AppSettingsSetters;

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export default AppSettingsContext;
