import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import Button from '@/components/Button';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import { colors, motion, radii, space, textStyles } from '@/styles/designTokens';

// Off screen before the panel has measured itself.
// eslint-disable-next-line no-restricted-syntax -- a position far below the screen, not a spacing
const HIDDEN_OFFSET = 1000;

/**
 * A sheet over the current screen, as tall as its content (up to most of the screen, then
 * `children` scroll under the title): a title with a close button over `children`. It slides up while `isVisible` and back down once it turns false;
 * a tap on the dimmed screen around it, the close button or Android's back calls `onClose`. The
 * grabber only says it's a sheet: there is no pan to close it. It rises above the keyboard, for a
 * field in it. Drawn in-app rather than as a native
 * form sheet, so it needs no route of its own and works on the web too.
 */
export default function BottomSheet({ isVisible, onClose, title, children }) {
  const [isMounted, setIsMounted] = useState(isVisible);
  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(HIDDEN_OFFSET);
  const bottomInset = useKeyboardInset();

  useEffect(() => {
    if (isVisible) {
      setIsMounted(true);
      progress.value = withTiming(1, motion.enter);
    } else {
      progress.value = withTiming(0, motion.exit, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setIsMounted, false);
      });
    }
  }, [isVisible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    paddingBottom: bottomInset.value,
    transform: [{ translateY: (1 - progress.value) * panelHeight.value }],
  }));

  function handlePanelLayout(event) {
    panelHeight.value = event.nativeEvent.layout.height;
  }

  return (
    <Modal transparent visible={isMounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[styles.panel, panelStyle]} onLayout={handlePanelLayout} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Button icon="close" variant="secondary" onPress={onClose} accessibilityLabel="Close" />
          </View>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: colors.overlay.dim,
  },
  panel: {
    maxHeight: '85%',
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingHorizontal: SCREEN_PADDING,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.background.placeholder,
    marginTop: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: space.sm,
  },
  // The content scrolls edge to edge and pads itself, so a child may reach into the side padding
  // without the scroll view clipping it.
  content: {
    flexGrow: 0,
    marginHorizontal: -SCREEN_PADDING,
  },
  contentInner: {
    paddingHorizontal: SCREEN_PADDING,
  },
  title: {
    flex: 1,
    ...textStyles.title2,
    color: colors.text.primary,
  },
});
