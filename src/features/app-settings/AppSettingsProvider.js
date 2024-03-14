import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import AppSettingsContext from './AppSettingsContext';

const STORAGE_KEY = 'app-settings';

export default function AppSettingsProvider({ children }) {
  // "cover" | "contain"
  const defaultThumbnailStyle = 'cover';
  const [thumbnailStyle, setThumbnailStyle] = useState(defaultThumbnailStyle);
  const [postsQuery, setPostsQuery] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const settings = await AsyncStorage.getItem(STORAGE_KEY);
      if (!settings) return;

      try {
        const { thumbnailStyle } = JSON.parse(settings);

        if (thumbnailStyle) {
          setThumbnailStyle(thumbnailStyle);
        }
      } catch (error) {
        console.error('Error loading app settings', error);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    async function saveSettings() {
      const settings = {};
      if (thumbnailStyle !== defaultThumbnailStyle) {
        settings.thumbnailStyle = thumbnailStyle;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    saveSettings();
  }, [thumbnailStyle]);

  const value = {
    thumbnailStyle,
    setThumbnailStyle,
    postsQuery,
    setPostsQuery,
  };

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
