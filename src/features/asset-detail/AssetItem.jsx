// TODO: Added pinch zoom but needs work:
// The image has a slight crop that must be fixed
// The image should zoom in where you pinch, not just from the center as it does now

import { useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

import AssetImage from '@/components/AssetImage';

export default function AssetItem({ asset, style }) {
  const [scale, setScale] = useState(1);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;

  const onPinchGestureEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      setScale(scale * event.nativeEvent.scale);
      pinchScale.setValue(1);
    }
  };

  return (
    <View style={style}>
      <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: Animated.multiply(baseScale, pinchScale) }] }]}>
          <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );
}
