import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import AppSettingsContext from './AppSettingsContext';

const STORAGE_KEY = 'app-settings';

export default function AppSettingsProvider({ children }) {
  // "cover" | "contain"
  const defaultThumbnailStyle = 'cover';
  // Global album sort applied to every album that isn't on its own custom order.
  const defaultAlbumSortOrder = 'createdAt:desc';
  const [thumbnailStyle, setThumbnailStyle] = useState(defaultThumbnailStyle);
  const [albumSortOrder, setAlbumSortOrder] = useState(defaultAlbumSortOrder);
  const [postsQuery, setPostsQuery] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const settings = await AsyncStorage.getItem(STORAGE_KEY);
      if (!settings) return;

      try {
        const { thumbnailStyle, albumSortOrder } = JSON.parse(settings);

        if (thumbnailStyle) {
          setThumbnailStyle(thumbnailStyle);
        }
        if (albumSortOrder) {
          setAlbumSortOrder(albumSortOrder);
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
      if (albumSortOrder !== defaultAlbumSortOrder) {
        settings.albumSortOrder = albumSortOrder;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    saveSettings();
  }, [thumbnailStyle, albumSortOrder]);

  const value = useMemo(
    () => ({
      thumbnailStyle,
      setThumbnailStyle,
      albumSortOrder,
      setAlbumSortOrder,
      postsQuery,
      setPostsQuery,
    }),
    [thumbnailStyle, albumSortOrder, postsQuery],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
