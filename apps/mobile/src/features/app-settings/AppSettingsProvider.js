import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import AppSettingsContext from './AppSettingsContext';

const STORAGE_KEY = 'app-settings';

export default function AppSettingsProvider({ children }) {
  // "cover" | "contain"
  const defaultThumbnailStyle = 'cover';
  // Global album sort applied to every album that isn't on its own custom order.
  const defaultAlbumSortOrder = 'createdAt:desc';
  // Whether a video in the asset detail screen starts by itself.
  const defaultIsVideoAutoplayOn = true;
  const [thumbnailStyle, setThumbnailStyle] = useState(defaultThumbnailStyle);
  const [albumSortOrder, setAlbumSortOrder] = useState(defaultAlbumSortOrder);
  const [isVideoAutoplayOn, setIsVideoAutoplayOn] = useState(defaultIsVideoAutoplayOn);
  // Nothing is saved before the stored settings are read, so the defaults never overwrite them.
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const settings = await AsyncStorage.getItem(STORAGE_KEY);
      if (!settings) return;

      try {
        const { thumbnailStyle, albumSortOrder, isVideoAutoplayOn } = JSON.parse(settings);

        if (thumbnailStyle) {
          setThumbnailStyle(thumbnailStyle);
        }
        if (albumSortOrder) {
          setAlbumSortOrder(albumSortOrder);
        }
        if (typeof isVideoAutoplayOn === 'boolean') {
          setIsVideoAutoplayOn(isVideoAutoplayOn);
        }
      } catch (error) {
        console.error('Error loading app settings', error);
      }
    }

    loadSettings().finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    async function saveSettings() {
      const settings = {};
      if (thumbnailStyle !== defaultThumbnailStyle) {
        settings.thumbnailStyle = thumbnailStyle;
      }
      if (albumSortOrder !== defaultAlbumSortOrder) {
        settings.albumSortOrder = albumSortOrder;
      }
      if (isVideoAutoplayOn !== defaultIsVideoAutoplayOn) {
        settings.isVideoAutoplayOn = isVideoAutoplayOn;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    saveSettings();
  }, [isLoaded, thumbnailStyle, albumSortOrder, isVideoAutoplayOn]);

  const value = useMemo(
    () => ({
      thumbnailStyle,
      setThumbnailStyle,
      albumSortOrder,
      setAlbumSortOrder,
      isVideoAutoplayOn,
      setIsVideoAutoplayOn,
    }),
    [thumbnailStyle, albumSortOrder, isVideoAutoplayOn],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}
