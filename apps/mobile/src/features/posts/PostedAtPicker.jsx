// The post editor's quiet Posted time: a grey clock, with the time beside it ("Today, 12:39") once
// `isShown` (picked, or a saved post's). A tap on either opens a sheet with the native picker, the
// date's calendar and the time, where each change applies at once, and Remove, which takes the time
// away (`onChange(null)`: the post is not posted). On web the picker is the browser's own field.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import Button from '@/components/Button';
import PostedAtCalendar from '@/features/posts/PostedAtCalendar';
import { scale } from '@/styles/designTokens';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

export default function PostedAtPicker({ timestamp, isShown, onChange, style }) {
  const [isOpen, setIsOpen] = useState(false);

  const label = timestamp == null ? 'Not posted' : formatLabel(timestamp);
  const accessibilityLabel = timestamp == null ? label : `Posted at ${label}`;

  function open() {
    setIsOpen(true);
  }

  function handleRemove() {
    onChange(null);
    setIsOpen(false);
  }

  return (
    <View style={[styles.row, style]}>
      <Button icon="clock" accessibilityLabel={accessibilityLabel} onPress={open} />
      {isShown && (
        <Button
          label={label}
          colorPalette="muted"
          accessibilityLabel={accessibilityLabel}
          onPress={open}
          style={styles.time}
        />
      )}
      <BottomSheet isVisible={isOpen} onClose={() => setIsOpen(false)} title="Posted">
        <PostedAtCalendar timestamp={timestamp} onChange={onChange} />
        {timestamp != null && (
          <Button label="Remove" colorPalette="danger" onPress={handleRemove} style={styles.remove} />
        )}
      </BottomSheet>
    </View>
  );
}

function formatLabel(timestamp) {
  const { title, subtitle } = formatDetailHeaderDate(timestamp);
  return `${title}, ${subtitle}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The time follows the clock closely: a link pads 24 pt to its sides, and the clock sits 12 pt in
  // from its button's edge.
  time: {
    marginLeft: -24 - scale(6),
  },
  remove: {
    alignSelf: 'center',
  },
});
