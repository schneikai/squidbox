import AppSettingsContext, { type AppSettingsContextValue } from './AppSettingsContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useAppSettings(): AppSettingsContextValue {
  return useRequiredContext(AppSettingsContext, 'useAppSettings needs an AppSettingsProvider above it');
}
