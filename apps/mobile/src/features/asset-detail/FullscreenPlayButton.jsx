import { useEvent } from 'expo';
import { StyleSheet } from 'react-native';

import playVideo from './playVideo';

import FadeView from '@/components/FadeView';
import IconButton from '@/components/IconButton';
import FloatingPill from '@/components/floating-bars/FloatingPill';

/**
 * A play button in the middle of the screen while it's fullscreen (`isVisible`) and `player` is
 * paused, since the video controls are hidden then. Expects a fresh mount for each player (keyed).
 */
export default function FullscreenPlayButton({ player, isVisible }) {
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  return (
    <FadeView
      isVisible={isVisible && !isPlaying}
      style={[StyleSheet.absoluteFill, styles.center]}
      pointerEvents="box-none"
    >
      <FloatingPill>
        <IconButton icon="play" onPress={() => playVideo(player)} accessibilityLabel="Play" />
      </FloatingPill>
    </FadeView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
