import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ChannelBarPart } from './ChannelBar';
import orderPostChannels from './orderPostChannels';

import useReduceMotion from '@/hooks/useReduceMotion';
import { motion } from '@/styles/designTokens';

// As the main tabs' switch (app/(main)/(tabs)/_layout.tsx): a subtle nudge from the side, not a page swipe.
const SLIDE_DISTANCE = 40;

/**
 * The style for what a post's channel bar switches (the selected channel's cards): when `selectedKey`
 * changes it fades in and slides from the side of the chip that was tapped, as the main tabs switch,
 * the bar's order (orderPostChannels over `channelOrder`) telling left from right. Still with Reduce
 * Motion.
 */
export default function useChannelSlide(selectedKey: string, parts: ChannelBarPart[], channelOrder: string[]) {
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const previousRef = useRef(selectedKey);
  const keys = orderPostChannels(parts, (part) => part.channelId, channelOrder).map((part) => part.key);
  const from = keys.indexOf(previousRef.current);
  const to = keys.indexOf(selectedKey);

  useEffect(() => {
    if (previousRef.current === selectedKey) return;
    previousRef.current = selectedKey;
    if (reduceMotion || from < 0 || to < 0) return;
    offset.value = to > from ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
    opacity.value = 0;
    offset.value = withTiming(0, motion.enter);
    opacity.value = withTiming(1, motion.enter);
  }, [selectedKey, reduceMotion, from, to, offset, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: offset.value }] }));
}
