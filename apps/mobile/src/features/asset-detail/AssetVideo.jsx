import { useEvent } from 'expo';
import { VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import Icon from '@/components/Icon';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import { colors, motion, spacing, typography } from '@/styles/designTokens';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';

const MESSAGES = {
  error: { icon: 'alert', text: "Couldn't load this video." },
  playerError: { icon: 'alert', text: "This video can't be played." },
};

/**
 * The current page's video (`useAssetVideo`'s result), laid over its thumbnail: the video fades in
 * once its first frame is drawn, a cloud copy shows a spinner while it loads or buffers, and a video
 * that can't play says why. Touches pass through to the page. Expects a fresh mount per `video.key`.
 */
export default function AssetVideo({ video }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {video.player ? (
        <Playback player={video.player} isRemote={video.isRemote} />
      ) : (
        <Message message={messageFor(video.status)} />
      )}
    </View>
  );
}

function Playback({ player, isRemote }) {
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [hasFirstFrame, setHasFirstFrame] = useState(false);

  const isFailed = status === 'error';
  const isWaiting = isRemote && !isFailed && (!hasFirstFrame || status === 'loading');
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
          <ActivityIndicator color={colors.textSecondary} style={styles.spinner} />
        </FloatingPill>
      )}
      {isFailed && <Message message={MESSAGES.playerError} />}
    </>
  );
}

function messageFor(status) {
  const unavailable = assetFileUnavailableMessages[status];
  if (!unavailable) return MESSAGES[status];
  return { icon: 'cloud-offline', text: `${unavailable.title}. ${unavailable.message}` };
}

function Message({ message }) {
  if (!message) return null;

  return (
    <FloatingPill style={styles.message}>
      <Icon name={message.icon} color={colors.textSecondary} />
      <Text style={styles.messageText}>{message.text}</Text>
    </FloatingPill>
  );
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
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
  },
  message: {
    marginHorizontal: spacing.floatingBarSide,
  },
  messageText: {
    flexShrink: 1,
    paddingHorizontal: spacing.barPaddingX,
    fontSize: typography.sm,
    color: colors.text,
  },
});
