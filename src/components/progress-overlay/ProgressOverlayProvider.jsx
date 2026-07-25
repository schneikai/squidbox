import { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import ProgressOverlayContext from './ProgressOverlayContext';
import ProgressRing from './ProgressRing';

export default function ProgressOverlayProvider({ children }) {
  const [mode, setMode] = useState(null); // null | 'progress' | 'blocking'
  const [progress, setProgress] = useState(0);

  const show = useCallback(() => setMode('progress'), []);
  const showBlocking = useCallback(() => setMode('blocking'), []);
  const hide = useCallback(() => {
    setMode(null);
    setProgress(0);
  }, []);
  const updateProgress = useCallback((value) => setProgress(value), []);

  return (
    <ProgressOverlayContext.Provider value={{ show, showBlocking, hide, updateProgress }}>
      {children}
      {mode !== null && (
        <View style={styles.overlay} pointerEvents="box-only">
          {mode === 'progress' ? <ProgressRing value={progress} /> : <ActivityIndicator size="large" color="white" />}
        </View>
      )}
    </ProgressOverlayContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
  },
});
