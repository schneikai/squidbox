import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import AppSettingsContext from './AppSettingsContext';

const STORAGE_KEY = 'app-settings';

// Each setting until it is changed. Only changed ones are stored, under these keys.
const DEFAULTS = {
  // "cover" | "contain"
  thumbnailStyle: 'cover',
  // Global album sort applied to every album that isn't on its own custom order.
  albumSortOrder: 'createdAt:desc',
  // Whether a video in the asset detail screen starts by itself.
  isVideoAutoplayOn: true,
  // Whether lifts, drops, peeks and outcomes tap back (useHaptics).
  isHapticsOn: true,
};
const KEYS = Object.keys(DEFAULTS);

// The context holds each setting with its setter, e.g. `isHapticsOn` and `setIsHapticsOn`.
const setterName = (key) => `set${key[0].toUpperCase()}${key.slice(1)}`;

export default function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
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
      Object.fromEntries(
        KEYS.map((key) => [setterName(key), (value) => setSettings((current) => ({ ...current, [key]: value }))]),
      ),
    [],
  );
  const value = useMemo(() => ({ ...settings, ...setters }), [settings, setters]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

// The stored settings over the defaults, each only when it has its default's type.
function readStoredSettings(stored) {
  const settings = { ...DEFAULTS };
  for (const key of KEYS) {
    if (typeof stored[key] === typeof DEFAULTS[key]) settings[key] = stored[key];
  }
  return settings;
}
