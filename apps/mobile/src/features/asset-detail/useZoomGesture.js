import { useEffect, useMemo, useRef } from 'react';
import { Gesture, State } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  clamp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import dragWithin from './dragWithin';
import getPanBounds from './getPanBounds';
import settleWithin from './settleWithin';
import zoomAround from './zoomAround';

import { TAP_SLOP } from '@/constants';
import { motion } from '@/styles/designTokens';

// The viewer shows the 1000 px thumbnail, so zooming further than this only enlarges its pixels.
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
// Above this the image counts as zoomed: a spring settling on 1 stops just short of it.
const ZOOMED_SCALE = 1.01;
// The second tap of a double tap, kept short since a single tap waits for it.
const DOUBLE_TAP_DELAY_MS = 250;

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
 *
 * With `verticalDrag` (worklets `canStart(dy)`, `onStart()`, `onChange(changeY)`, `onEnd(velocityY)`
 * and `isOpen()`), a mostly vertical one-finger drag at 1× goes to it instead, zoomable or not (a
 * video), when `canStart` agrees. While that drag runs or `isOpen()`, pinch and double tap don't
 * zoom, and a double tap counts as a tap. `pagerGesture` (the list paging through the assets)
 * waits for the pan: a sideways swipe at 1× fails it at once, a vertical drag or a zoomed pan holds
 * the pager.
 *
 * With `edgeSwipe` (usePagerEdgeSwipe's worklets), a one-finger zoomed pan that has the image on its
 * left or right edge hands the rest of the sideways movement to the pager, which follows the finger
 * to the neighbouring page; dragging back hands it back to the image. On release the pager snaps,
 * and the image stays on its edge.
 */
export default function useZoomGesture({
  aspectRatio,
  isZoomable,
  onTap,
  onZoomChange,
  verticalDrag,
  pagerGesture,
  edgeSwipe,
}) {
  const size = useSharedValue({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // The previous pinch or pan event, so each one applies only its change.
  const lastPinch = useSharedValue({ scale: 1, focalX: 0, focalY: 0, pointers: 0 });
  const lastPanPointers = useSharedValue(0);
  // Where the finger a pan measures its distance from went down.
  const panStart = useSharedValue({ id: -1, x: 0, y: 0 });
  // The pan under way is `verticalDrag`'s, not the zoomed image's.
  const isDraggingVertically = useSharedValue(false);
  // The pan under way has moved `edgeSwipe`'s pager off its page and not released it yet.
  const isHoldingPager = useSharedValue(false);
  // Spring and decay animations under way, so a tap that catches the image moving isn't a tap.
  const settlingCount = useSharedValue(0);
  // The fingers a tap has had down, and whether it landed while the image was moving.
  const tapTouch = useSharedValue({ pointers: 0, isOnMovingImage: false });
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
    // One finger only, and not one that lands on a gliding or springing image: a quick two-finger
    // touch, a tiny pinch or catching a fling isn't meant as a tap.
    const singleTap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onTouchesDown((event) => {
        const isFirst = event.numberOfTouches === 1;
        tapTouch.value = {
          pointers: Math.max(event.numberOfTouches, isFirst ? 0 : tapTouch.value.pointers),
          isOnMovingImage: isFirst ? settlingCount.value > 0 : tapTouch.value.isOnMovingImage,
        };
      })
      .onStart(() => {
        const { pointers, isOnMovingImage } = tapTouch.value;
        if (onTap && pointers === 1 && !isOnMovingImage) runOnJS(onTap)();
      });

    if (!isZoomable && !verticalDrag) return singleTap;

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

    // Counts an animation as under way until it finishes or is cancelled.
    const settled = () => {
      'worklet';
      settlingCount.value -= 1;
    };
    const settling = () => {
      'worklet';
      settlingCount.value += 1;
      return settled;
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
      scale.value = withSpring(toScale, motion.spring, settling());
      translateX.value = withSpring(clamp(x, -bounds.x, bounds.x), motion.spring, settling());
      translateY.value = withSpring(clamp(y, -bounds.y, bounds.y), motion.spring, settling());
    };

    const dragAxis = (value, delta, bound, dimension) => {
      'worklet';
      value.value = dragWithin({ position: value.value, delta, min: -bound, max: bound, dimension });
    };

    // A one-finger zoomed pan's sideways change: with `edgeSwipe`, the image takes it up to its edge
    // and the pager the rest; once the pager is off its page, it takes all of it until it is back.
    // Says whether the pager is off its page afterwards.
    const dragX = (changeX, bound) => {
      'worklet';
      const isShifted = !!edgeSwipe && edgeSwipe.isShifted();
      const x = translateX.value;
      const room = changeX < 0 ? Math.max(x + bound, 0) : Math.max(bound - x, 0);
      const toImage = isShifted ? 0 : Math.sign(changeX) * Math.min(Math.abs(changeX), room);
      const toPager = changeX - toImage;
      if (!edgeSwipe || toPager === 0) {
        dragAxis(translateX, changeX, bound, size.value.width);
        return isShifted;
      }
      const leftover = edgeSwipe.drag(toPager);
      const hasPagerTakenNone = leftover === toPager;
      if (hasPagerTakenNone) {
        // No page that way: the image pans and rubber-bands as without a pager.
        dragAxis(translateX, changeX, bound, size.value.width);
        return isShifted;
      }
      isHoldingPager.value = true;
      // Flush with the page's edge, also when the pan caught the image rubber-banding past it.
      translateX.value = clamp(x + toImage, -bound, bound);
      if (leftover !== 0) dragAxis(translateX, leftover, bound, size.value.width);
      return edgeSwipe.isShifted();
    };

    const settleAxis = (value, velocity, bound) => {
      'worklet';
      settleWithin({ value, velocity, min: -bound, max: bound, onDone: settling() });
    };

    // The vertical drag, or what it opened, has the photo.
    const isZoomBlocked = () => {
      'worklet';
      return isDraggingVertically.value || (!!verticalDrag && verticalDrag.isOpen());
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
        if (latest.pointers !== 2 || last.pointers !== 2 || isZoomBlocked()) return;
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
        if (isZoomBlocked()) return;
        const { focalX, focalY } = lastPinch.value;
        zoomTo(restingScale(), { x: focalX, y: focalY });
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_DELAY_MS)
      .maxDistance(TAP_SLOP)
      .onStart((event) => {
        if (isZoomBlocked()) {
          if (onTap) runOnJS(onTap)();
          return;
        }
        stop();
        const point = fromCenter(event.x, event.y);
        if (scale.value > ZOOMED_SCALE) zoomTo(1, point);
        else zoomTo(DOUBLE_TAP_SCALE, point, { x: 0, y: 0 });
      });

    // Starts only once a finger moves past the tap's slop and the double tap has failed, so a tap's
    // jitter never starts a pan whose fling would undo the double tap's zoom.
    const pan = Gesture.Pan()
      .manualActivation(true)
      .requireExternalGestureToFail(...(isZoomable ? [doubleTap] : []))
      .blocksExternalGesture(...(pagerGesture ? [pagerGesture] : []))
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
        const dx = touch.x - start.x;
        const dy = touch.y - start.y;
        if (Math.hypot(dx, dy) <= TAP_SLOP) return;
        if (scale.value > ZOOMED_SCALE) {
          manager.activate();
          return;
        }
        // At 1× two fingers may be a pinch zooming in that carries on as a pan.
        if (event.numberOfTouches !== 1) return;
        if (verticalDrag && Math.abs(dy) > Math.abs(dx) && verticalDrag.canStart(dy)) {
          isDraggingVertically.value = true;
          manager.activate();
        } else {
          // One finger swiping sideways swipes the pager.
          manager.fail();
        }
      })
      .onStart((event) => {
        if (isDraggingVertically.value) {
          verticalDrag.onStart();
          return;
        }
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        lastPanPointers.value = event.numberOfPointers;
        // A pan that catches a running snap carries the pager on from where it is.
        if (edgeSwipe) {
          edgeSwipe.stop();
          isHoldingPager.value = edgeSwipe.isShifted();
        }
      })
      .onChange((event) => {
        if (isDraggingVertically.value) {
          verticalDrag.onChange(event.changeY);
          return;
        }
        const hasSamePointers = event.numberOfPointers === lastPanPointers.value;
        lastPanPointers.value = event.numberOfPointers;
        // Two fingers belong to the pinch, which moves the image with them.
        if (event.numberOfPointers !== 1 || !hasSamePointers) return;
        const bounds = boundsAt(scale.value);
        const isPagerShifted = dragX(event.changeX, bounds.x);
        // While the pager moves, only the pager moves.
        if (!isPagerShifted) dragAxis(translateY, event.changeY, bounds.y, size.value.height);
      })
      .onEnd((event) => {
        if (isDraggingVertically.value) {
          verticalDrag.onEnd(event.velocityY);
          return;
        }
        // The pager snaps in onFinalize, also after a pinch took over; the image stays on its edge.
        if (isHoldingPager.value) return;
        // A pan last moved by two fingers was the pinch's, which settles the image itself.
        if (lastPanPointers.value !== 1) return;
        const bounds = boundsAt(restingScale());
        settleAxis(translateX, event.velocityX, bounds.x);
        settleAxis(translateY, event.velocityY, bounds.y);
      })
      .onFinalize((event, success) => {
        isDraggingVertically.value = false;
        // A pan that held the pager snaps it, a cancelled one without velocity: never leave the list
        // between pages.
        if (isHoldingPager.value) {
          isHoldingPager.value = false;
          edgeSwipe.release(success ? event.velocityX : 0);
        }
      });

    if (!isZoomable) return Gesture.Simultaneous(pan, singleTap);
    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  }, [
    aspectRatio,
    isZoomable,
    onTap,
    verticalDrag,
    pagerGesture,
    edgeSwipe,
    size,
    scale,
    translateX,
    translateY,
    lastPinch,
    lastPanPointers,
    panStart,
    isDraggingVertically,
    isHoldingPager,
    settlingCount,
    tapTouch,
  ]);

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
