import { useEffect, useMemo, useRef } from 'react';
import { Gesture, State } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  clamp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from 'react-native-reanimated';

import dragWithin from './dragWithin';
import getPanBounds from './getPanBounds';
import zoomAround from './zoomAround';

import { motion } from '@/styles/designTokens';

// The viewer shows the 1000 px thumbnail, so zooming further than this only enlarges its pixels.
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
// Above this the image counts as zoomed: a spring settling on 1 stops just short of it.
const ZOOMED_SCALE = 1.01;
// The second tap of a double tap, kept short since a single tap waits for it.
const DOUBLE_TAP_DELAY_MS = 250;
// A tap that moves further is a swipe or a pan, and only then can a pan start.
const TAP_SLOP = 10;

/**
 * Apple Photos-style zoom for an image fitted into its view: pinch around the fingers, stay zoomed,
 * pan (one finger) within the image's edges, fling, and double tap to zoom in on a point or back out.
 * Pan only takes the touch while zoomed, so at 1× a swipe stays with the pager around the view.
 * Everything runs on the UI thread; `onZoomChange(isZoomed)` reports the transitions. Without a
 * known `aspectRatio` (width / height), the image is taken to fill the view. While not `isZoomable`
 * only the tap is on, and a view that stops being zoomable (or unmounts) goes back to 1×.
 *
 * The gesture goes on an untransformed container (focal points are measured in it) that reports
 * `onLayout`; `zoomStyle` goes on the view inside it.
 */
export default function useZoomGesture({ aspectRatio, isZoomable, onTap, onZoomChange }) {
  const size = useSharedValue({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // The previous pinch or pan event, so each one applies only its change.
  const lastPinch = useSharedValue({ scale: 1, focalX: 0, focalY: 0, pointers: 0 });
  const lastPanPointers = useSharedValue(0);
  // Where the finger a pan measures its distance from went down.
  const panStart = useSharedValue({ id: -1, x: 0, y: 0 });
  // For the report on unmount, after the reaction below has stopped.
  const onZoomChangeRef = useRef(onZoomChange);

  // Reported on (re)start too, so a restart with a new `onZoomChange` doesn't lose the current state.
  useAnimatedReaction(
    () => scale.value > ZOOMED_SCALE,
    (isZoomed, wasZoomed) => {
      if (isZoomed === wasZoomed) return;
      runOnJS(onZoomChange)(isZoomed);
    },
    [onZoomChange],
  );

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  // Back to 1× once the view stops being zoomable (its page swiped away) or unmounts.
  useEffect(() => {
    if (!isZoomable) return;
    return () => {
      if (scale.value > ZOOMED_SCALE) onZoomChangeRef.current(false);
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    };
  }, [isZoomable, scale, translateX, translateY]);

  const gesture = useMemo(() => {
    const singleTap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onStart(() => {
        if (onTap) runOnJS(onTap)();
      });

    if (!isZoomable) return singleTap;

    const boundsAt = (atScale) => {
      'worklet';
      return getPanBounds({ scale: atScale, ...size.value, aspectRatio });
    };

    // The scale a release settles on.
    const restingScale = () => {
      'worklet';
      return clamp(scale.value, 1, MAX_SCALE);
    };

    // Positions relative to the view's center, the transform origin.
    const fromCenter = (x, y) => {
      'worklet';
      return { x: x - size.value.width / 2, y: y - size.value.height / 2 };
    };

    // What the next pinch event compares against.
    const pinchSnapshot = (event) => {
      'worklet';
      return {
        scale: event.scale,
        focalX: event.focalX - size.value.width / 2,
        focalY: event.focalY - size.value.height / 2,
        pointers: event.numberOfPointers,
      };
    };

    const touchAnchor = (event) => {
      'worklet';
      const [touch] = event.allTouches;
      return { id: touch.id, x: touch.x, y: touch.y };
    };

    const stop = () => {
      'worklet';
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };

    // Animates to `toScale` keeping the content under `focal` there (or moving it to `to`), with the
    // image's edges pulled back inside the view. Scale and translation share one spring from rest,
    // so the focal point holds still all the way.
    const zoomTo = (toScale, focal, to = focal) => {
      'worklet';
      const ratio = toScale / scale.value;
      const bounds = boundsAt(toScale);
      const x = zoomAround({ translation: translateX.value, from: focal.x, to: to.x, ratio });
      const y = zoomAround({ translation: translateY.value, from: focal.y, to: to.y, ratio });
      scale.value = withSpring(toScale, motion.spring);
      translateX.value = withSpring(clamp(x, -bounds.x, bounds.x), motion.spring);
      translateY.value = withSpring(clamp(y, -bounds.y, bounds.y), motion.spring);
    };

    const dragAxis = (value, delta, bound, dimension) => {
      'worklet';
      value.value = dragWithin({ position: value.value, delta, min: -bound, max: bound, dimension });
    };

    // A fling glides on and stops at the edge; released past the edge, it springs back.
    const settleAxis = (value, velocity, bound) => {
      'worklet';
      const isPastEdge = Math.abs(value.value) > bound || bound === 0;
      value.value = isPastEdge
        ? withSpring(clamp(value.value, -bound, bound), { ...motion.spring, velocity })
        : withDecay({ velocity, clamp: [-bound, bound], rubberBandEffect: true });
    };

    const pinch = Gesture.Pinch()
      .onStart((event) => {
        stop();
        lastPinch.value = pinchSnapshot(event);
      })
      .onUpdate((event) => {
        const last = lastPinch.value;
        const latest = pinchSnapshot(event);
        lastPinch.value = latest;
        // A finger lifting or landing moves the focal point in one jump.
        if (latest.pointers !== 2 || last.pointers !== 2) return;
        const current = scale.value;
        const next = dragWithin({
          position: current,
          delta: current * (latest.scale / last.scale - 1),
          min: 1,
          max: MAX_SCALE,
          dimension: 1,
        });
        const ratio = next / current;
        scale.value = next;
        translateX.value = zoomAround({ translation: translateX.value, from: last.focalX, to: latest.focalX, ratio });
        translateY.value = zoomAround({ translation: translateY.value, from: last.focalY, to: latest.focalY, ratio });
      })
      .onEnd(() => {
        const { focalX, focalY } = lastPinch.value;
        zoomTo(restingScale(), { x: focalX, y: focalY });
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_DELAY_MS)
      .maxDistance(TAP_SLOP)
      .onStart((event) => {
        stop();
        const point = fromCenter(event.x, event.y);
        if (scale.value > ZOOMED_SCALE) zoomTo(1, point);
        else zoomTo(DOUBLE_TAP_SCALE, point, { x: 0, y: 0 });
      });

    // Starts only once a finger moves past the tap's slop and the double tap has failed, so a tap's
    // jitter never starts a pan whose fling would undo the double tap's zoom.
    const pan = Gesture.Pan()
      .manualActivation(true)
      .requireExternalGestureToFail(doubleTap)
      .onTouchesDown((event) => {
        if (event.numberOfTouches === 1) panStart.value = touchAnchor(event);
      })
      .onTouchesMove((event, manager) => {
        if (event.state !== State.BEGAN) return;
        const start = panStart.value;
        const touch = event.allTouches.find(({ id }) => id === start.id);
        // The finger it measured from lifted: measure from the one still down.
        if (!touch) {
          panStart.value = touchAnchor(event);
          return;
        }
        if (Math.hypot(touch.x - start.x, touch.y - start.y) <= TAP_SLOP) return;
        if (scale.value > ZOOMED_SCALE) manager.activate();
        // At 1× one finger swipes the pager; two may be a pinch zooming in that carries on as a pan.
        else if (event.numberOfTouches === 1) manager.fail();
      })
      .onStart((event) => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        lastPanPointers.value = event.numberOfPointers;
      })
      .onChange((event) => {
        const hasSamePointers = event.numberOfPointers === lastPanPointers.value;
        lastPanPointers.value = event.numberOfPointers;
        // Two fingers belong to the pinch, which moves the image with them.
        if (event.numberOfPointers !== 1 || !hasSamePointers) return;
        const bounds = boundsAt(scale.value);
        dragAxis(translateX, event.changeX, bounds.x, size.value.width);
        dragAxis(translateY, event.changeY, bounds.y, size.value.height);
      })
      .onEnd((event) => {
        // A pan last moved by two fingers was the pinch's, which settles the image itself.
        if (lastPanPointers.value !== 1) return;
        const bounds = boundsAt(restingScale());
        settleAxis(translateX, event.velocityX, bounds.x);
        settleAxis(translateY, event.velocityY, bounds.y);
      });

    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  }, [aspectRatio, isZoomable, onTap, size, scale, translateX, translateY, lastPinch, lastPanPointers, panStart]);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  function handleLayout(event) {
    const { width, height } = event.nativeEvent.layout;
    size.value = { width, height };
    // A new size (a rotation) moves the image's edges: keep it within them.
    const bounds = getPanBounds({ scale: scale.value, width, height, aspectRatio });
    if (Math.abs(translateX.value) > bounds.x) translateX.value = clamp(translateX.value, -bounds.x, bounds.x);
    if (Math.abs(translateY.value) > bounds.y) translateY.value = clamp(translateY.value, -bounds.y, bounds.y);
  }

  return { gesture, zoomStyle, onLayout: handleLayout };
}
