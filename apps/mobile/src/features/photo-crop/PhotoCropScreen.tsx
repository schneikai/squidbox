import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector, type PanGestureConfig, usePanGesture } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import cropPhotoAsync from './cropPhotoAsync';

import EditSheet from '@/components/EditSheet';
import Text from '@/components/Text';
import useHaptics from '@/hooks/useHaptics';
import useSheetRoute from '@/hooks/useSheetRoute';
import usePhotoCrop from '@/providers/photo-crop/usePhotoCrop';
import { colors, space } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const OUTLINE = 2;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The crop of usePhotoCrop (`?uri=&width=&height=`, the picture and its size in pixels): the picture
 * fitted into the sheet, with a circle as wide as its short side over it, the contact's photo to be.
 * Dragging anywhere slides the circle along the long side; Choose hands the square around it
 * (cropPhotoAsync) to the caller. No zoom: the circle always spans the picture's short side.
 */
export default function PhotoCropScreen() {
  const params = useLocalSearchParams<{ uri: string; width: string; height: string }>();
  const navigation = useNavigation();
  const sheet = useSheetRoute();
  const haptics = useHaptics();
  const { finishPhotoCrop } = usePhotoCrop();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  // Where the circle is along the long side: 0 at its start, 1 at its end (squareCrop's position).
  const position = useSharedValue(0.5);
  const photo = { uri: params.uri, width: Number(params.width), height: Number(params.height) };
  const isWide = photo.width > photo.height;

  // The picture fitted into the area, the circle's diameter on it, and how far the circle can slide.
  const fit = Math.min(area.width / photo.width, area.height / photo.height) || 0;
  const shown = { width: photo.width * fit, height: photo.height * fit };
  const side = Math.min(shown.width, shown.height);
  const travel = Math.max(shown.width, shown.height) - side;

  // Closing without Choose (×, Back) crops nothing.
  useEffect(() => () => finishPhotoCrop(null), [finishPhotoCrop]);

  // A drag down on a tall picture moves the circle; it mustn't take the sheet away.
  useEffect(() => {
    sheet?.setOptions({ gestureEnabled: false });
    return () => sheet?.setOptions({ gestureEnabled: true });
  }, [sheet?.setOptions]);

  // Memoized: a new config re-sends the gesture to native.
  const pan = useMemo<PanGestureConfig>(
    () => ({
      onUpdate: (event) => {
        'worklet';
        if (travel <= 0) return;
        const change = isWide ? event.changeX : event.changeY;
        position.value = clamp(position.value + change / travel, 0, 1);
      },
    }),
    [position, travel, isWide],
  );
  const gesture = usePanGesture(pan);

  const circleStyle = useAnimatedStyle(() => {
    const at = position.value * travel;
    return { transform: isWide ? [{ translateX: at }] : [{ translateY: at }] };
  });

  // The picture dimmed around the circle: one layer the picture's size, its hole following the circle.
  const dimProps = useAnimatedProps(() => {
    const at = position.value * travel;
    return { d: dimPath(shown.width, shown.height, isWide ? at : 0, isWide ? 0 : at, side) };
  });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  }

  async function handleChoose() {
    setIsCropping(true);
    try {
      finishPhotoCrop(await cropPhotoAsync(photo, position.value));
      navigation.goBack();
    } catch (error) {
      console.error("Couldn't crop the photo", error);
      haptics.error();
      Alert.alert("Couldn't crop the photo", apiErrorMessage(error));
      setIsCropping(false);
    }
  }

  return (
    <EditSheet
      title="Move photo"
      confirmLabel="Choose"
      canConfirm={side > 0}
      isSaving={isCropping}
      onCancel={() => navigation.goBack()}
      onConfirm={handleChoose}
      isFilling
      testID="photo-crop"
    >
      <GestureDetector gesture={gesture}>
        <View style={styles.area} onLayout={handleLayout}>
          {side > 0 && (
            <View style={[styles.picture, shown]}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
              <Svg width={shown.width} height={shown.height} style={StyleSheet.absoluteFill}>
                <AnimatedPath animatedProps={dimProps} fill={colors.overlay.cropped} fillRule="evenodd" />
              </Svg>
              <Animated.View
                style={[styles.outline, { width: side, height: side, borderRadius: side / 2 }, circleStyle]}
              />
            </View>
          )}
        </View>
      </GestureDetector>
      <Text variant="hint" style={styles.hint}>
        Drag to choose what shows in the circle.
      </Text>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picture: {
    overflow: 'hidden',
  },
  outline: {
    position: 'absolute',
    borderWidth: OUTLINE,
    borderColor: colors.text.inverse,
  },
  hint: {
    textAlign: 'center',
    marginTop: space.lg,
  },
});

// A `width` × `height` picture with a circle of diameter `side` cut out of it, its square's corner at `x`, `y`.
function dimPath(width: number, height: number, x: number, y: number, side: number) {
  'worklet';
  const radius = side / 2;
  return (
    `M0 0H${width}V${height}H0Z` +
    `M${x} ${y + radius}a${radius} ${radius} 0 1 0 ${side} 0a${radius} ${radius} 0 1 0 ${-side} 0Z`
  );
}
