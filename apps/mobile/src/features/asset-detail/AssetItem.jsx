// TODO: Pinch is a peek: the image springs back on release. Zooming in place (focal point, panning,
// staying zoomed while the pager is locked) is not implemented yet. A slight crop of the image was
// also reported and still needs checking on a device.

import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import AssetImage from '@/components/AssetImage';

export default function AssetItem({ asset, style, onTap }) {
  const pinchScale = useRef(new Animated.Value(1)).current;
  // Pinching in never shrinks the image below its fitted size.
  const scale = pinchScale.interpolate({ inputRange: [1, 2], outputRange: [1, 2], extrapolateLeft: 'clamp' });

  const onPinchGestureEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });

  function handlePinchStateChange(event) {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;
    Animated.spring(pinchScale, { toValue: 1, useNativeDriver: true }).start();
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
