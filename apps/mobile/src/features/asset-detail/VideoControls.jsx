import { useIsFocused } from '@react-navigation/native';
import { useEvent, useEventListener } from 'expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import VideoScrubber from './VideoScrubber';
import playVideo from './playVideo';

import IconButton from '@/components/IconButton';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { colors, scale, typography } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';

/**
 * Play/pause, the position (elapsed time, scrubber, length) and mute for `player`, in a floating
 * pill. Until the player knows the length it shows the asset's `fallbackDuration` (ms). With video
 * autoplay on (Settings), starts the video once it's ready, unless the screen has lost focus by then
 * or the user has played, paused or scrubbed already. Expects a fresh mount for each player (keyed).
 */
export default function VideoControls({ player, fallbackDuration }) {
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  // Re-renders once the source has loaded, when the player knows the length.
  useEvent(player, 'statusChange', { status: player.status });
  const isFocused = useIsFocused();
  const { isVideoAutoplayOn } = useAppSettings();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const progress = useSharedValue(0);
  const isAutoplayPendingRef = useRef(true);
  const isScrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const duration = player.duration || (fallbackDuration ?? 0) / 1000;

  // Waits for 'readyToPlay', not just the player: the web player only plays a mounted <video>.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') autoplay();
  });
  useEffect(() => {
    if (player.status === 'readyToPlay') autoplay();
  }, [player]);
  // Eased from one update to the next, so the scrubber glides between them.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (isScrubbingRef.current || !duration) return;
    const toValue = Math.min(currentTime / duration, 1);
    progress.value = withTiming(toValue, { duration: player.timeUpdateEventInterval * 1000, easing: Easing.linear });
    setElapsedSeconds(Math.floor(currentTime));
  });
  useEventListener(player, 'playToEnd', () => {
    progress.value = 1;
    setElapsedSeconds(Math.round(duration));
  });

  function autoplay() {
    if (!isAutoplayPendingRef.current) return;
    isAutoplayPendingRef.current = false;
    // Read now, not at mount: the settings may still have been loading then.
    if (isFocused && isVideoAutoplayOn) player.play();
  }

  function handlePlayPause() {
    isAutoplayPendingRef.current = false;
    if (isPlaying) player.pause();
    else playVideo(player);
  }

  function handleToggleMute() {
    player.muted = !muted;
  }

  // Paused while scrubbing (as expo-video advises on iOS) and in its scrubbing mode, and playing again
  // after if it was.
  const handleScrubStart = useCallback(() => {
    isScrubbingRef.current = true;
    isAutoplayPendingRef.current = false;
    wasPlayingRef.current = player.playing;
    player.pause();
    player.scrubbingModeOptions = { scrubbingModeEnabled: true };
  }, [player]);
  const handleScrub = useCallback(
    (fraction) => {
      const time = fraction * duration;
      player.currentTime = time;
      setElapsedSeconds(Math.floor(time));
    },
    [player, duration],
  );
  const handleScrubEnd = useCallback(() => {
    isScrubbingRef.current = false;
    player.scrubbingModeOptions = { scrubbingModeEnabled: false };
    if (wasPlayingRef.current) player.play();
  }, [player]);

  return (
    <FloatingPill style={styles.pill}>
      <IconButton
        icon={isPlaying ? 'pause' : 'play'}
        onPress={handlePlayPause}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      />
      <Text style={styles.time}>{formatVideoDuration(elapsedSeconds * 1000)}</Text>
      <VideoScrubber
        progress={progress}
        onScrubStart={handleScrubStart}
        onScrub={handleScrub}
        onScrubEnd={handleScrubEnd}
      />
      <Text style={styles.time}>{formatVideoDuration(duration * 1000)}</Text>
      <IconButton
        icon={muted ? 'volume-off' : 'volume-on'}
        onPress={handleToggleMute}
        accessibilityLabel={muted ? 'Unmute' : 'Mute'}
      />
    </FloatingPill>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'stretch',
  },
  time: {
    minWidth: typography.footnote * 3,
    marginHorizontal: scale(4),
    fontSize: typography.footnote,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
