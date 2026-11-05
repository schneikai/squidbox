import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import AppSettingsContext, { type AppSettingsContextValue, type AppSettingsSetters } from './AppSettingsContext';
import DEFAULTS, { type AppSettings } from './appSettingsDefaults';

const STORAGE_KEY = 'app-settings';

const KEYS = Object.keys(DEFAULTS) as (keyof AppSettings)[];

// The context holds each setting with its setter (AppSettingsSetters).
const setterName = (key: string) => `set${key[0].toUpperCase()}${key.slice(1)}`;

type AppSettingsProviderProps = { children: ReactNode };

export default function AppSettingsProvider({ children }: AppSettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  // Nothing is saved before the stored settings are read, so the defaults never overwrite them.
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      try {
        setSettings(readStoredSettings(JSON.parse(stored)));
      } catch (error) {
        console.error('Error loading app settings', error);
      }
    }

    loadSettings().finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const changed = Object.fromEntries(
      KEYS.filter((key) => settings[key] !== DEFAULTS[key]).map((key) => [key, settings[key]]),
    );
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(changed));
  }, [isLoaded, settings]);

  const setters = useMemo(
    () =>
      // Built by name, so the mapped type AppSettingsSetters is what the names promise.
      Object.fromEntries(
        KEYS.map((key) => [
          setterName(key),
          (value: unknown) =>
            setSettings((current) => ({
              ...current,
              [key]: typeof value === 'function' ? value(current[key]) : value,
            })),
        ]),
      ) as AppSettingsSetters,
    [],
  );
  const value = useMemo<AppSettingsContextValue>(() => ({ ...settings, ...setters }), [settings, setters]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

// The stored settings over the defaults, each only when it has its default's type (a plain object
// for an object).
function readStoredSettings(stored: Partial<Record<string, unknown>>): AppSettings {
  const settings: Record<string, unknown> = { ...DEFAULTS };
  for (const key of KEYS) {
    const value = stored[key];
    if (typeof value !== typeof DEFAULTS[key] || value === null || Array.isArray(value)) continue;
    settings[key] = value;
  }
  // Each key holds its default's type, checked above.
  return settings as AppSettings;
}
