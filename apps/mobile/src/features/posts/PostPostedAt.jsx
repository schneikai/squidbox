import { useState } from 'react';
import { Text, Pressable } from 'react-native';

import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatDateTime from '@/utils/date-time/formatDateTime';

// Tap toggles between "3 days ago" and the exact date and time. Nothing for a post never posted.
export default function PostPostedAt({ postedAt, style }) {
  const [format, setFormat] = useState('inWords');

  const formatted = postedAt ? formatPostedAt(postedAt, format) : null;

  function toggleFormat() {
    setFormat((prev) => (prev === 'inWords' ? 'dateTime' : 'inWords'));
  }

  if (!postedAt) return null;

  return (
    <Pressable onPress={toggleFormat}>
      <Text style={style}>Posted {formatted}</Text>
    </Pressable>
  );
}

function formatPostedAt(postedAt, format) {
  return format === 'inWords' ? dateToTimeAgo(postedAt) : formatDateTime(postedAt);
}
