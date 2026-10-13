// TODO: Pinch is a peek: the image springs back on release. Zooming in place (focal point, panning,
// staying zoomed while the pager is locked) is not implemented yet. A slight crop of the image was
// also reported and still needs checking on a device.

import { memo, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import AssetImage from '@/components/AssetImage';
import { motion } from '@/styles/designTokens';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetItem);

function AssetItem({ asset, style, onTap }) {
  // Created once: a new native event would make the pinch handler reattach it on every render.
  const [{ pinchScale, scale, onPinchGestureEvent }] = useState(() => {
    const value = new Animated.Value(1);
    return {
      pinchScale: value,
      // Pinching in never shrinks the image below its fitted size.
      scale: value.interpolate({ inputRange: [1, 2], outputRange: [1, 2], extrapolateLeft: 'clamp' }),
      onPinchGestureEvent: Animated.event([{ nativeEvent: { scale: value } }], { useNativeDriver: true }),
    };
  });

  function handlePinchStateChange(event) {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;
    Animated.spring(pinchScale, { toValue: 1, ...motion.spring, useNativeDriver: true }).start();
  }

  return (
    <Pressable style={style} onPress={onTap}>
      <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={handlePinchStateChange}>
        <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
          <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
        </Animated.View>
      </PinchGestureHandler>
    </Pressable>
  );
}
