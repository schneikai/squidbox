import { useEvent } from 'expo';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import AssetMessage, { type AssetMessageText } from './AssetMessage';
import type { AssetVideo as AssetVideoValue, VideoStatus } from './useAssetVideo';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { colors, motion, sizes } from '@/styles/designTokens';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import isUnavailableStatus from '@/utils/assets/files/isUnavailableStatus';

const MESSAGES = {
  error: { icon: 'alert', message: "Couldn't load this video." },
  playerError: { icon: 'alert', message: "This video can't be played." },
} satisfies Record<string, AssetMessageText>;

type AssetVideoProps = {
  video: AssetVideoValue;
};

/**
 * The current page's video (`useAssetVideo`'s result), laid over its thumbnail: the video fades in
 * once its first frame is drawn, a cloud copy shows a spinner while it loads or buffers on its way
 * to playing (a paused one just shows its thumbnail), and a video that can't play says why. Touches
 * pass through to the page. Expects a fresh mount per `video.key`.
 */
export default function AssetVideo({ video }: AssetVideoProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {video.player ? (
        <Playback player={video.player} isRemote={video.isRemote} />
      ) : (
        <AssetMessage message={messageFor(video.status)} />
      )}
    </View>
  );
}

type PlaybackProps = {
  player: VideoPlayer;
  isRemote: boolean;
};
function Playback({ player, isRemote }: PlaybackProps) {
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { isVideoAutoplayOn } = useAppSettings();
  const [hasFirstFrame, setHasFirstFrame] = useState(false);

  const isFailed = status === 'error';
  // Autoplay starts it once it's ready, so until then it counts as on its way to playing.
  const isAboutToPlay = isPlaying || (isVideoAutoplayOn && status !== 'readyToPlay');
  const isWaiting = isRemote && !isFailed && isAboutToPlay && (!hasFirstFrame || status === 'loading');
  const videoStyle = useAnimatedStyle(() => ({ opacity: withTiming(hasFirstFrame ? 1 : 0, motion.enter) }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          playsInline
          onFirstFrameRender={() => setHasFirstFrame(true)}
        />
      </Animated.View>
      {isWaiting && (
        <FloatingPill>
          <ActivityIndicator color={colors.text.secondary} style={styles.spinner} />
        </FloatingPill>
      )}
      {isFailed && <AssetMessage message={MESSAGES.playerError} />}
    </>
  );
}

function messageFor(status: VideoStatus): AssetMessageText | undefined {
  if (isUnavailableStatus(status)) return assetFileUnavailableMessages[status];
  return status === 'error' ? MESSAGES.error : undefined;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  // Sized explicitly: on web it's a <video>, which keeps its own size inside an absolute fill.
  video: {
    width: '100%',
    height: '100%',
  },
  spinner: {
    width: sizes.iconButton,
    height: sizes.iconButton,
  },
});
