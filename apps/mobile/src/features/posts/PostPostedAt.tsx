import { useState } from 'react';
import { Text, Pressable } from 'react-native';

import listTextStyles from '@/styles/listTextStyles';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatDateTime from '@/utils/date-time/formatDateTime';

type PostedAtFormat = 'inWords' | 'dateTime';

type PostPostedAtProps = { postedAt: number | null };

/**
 * Tap toggles between "3 days ago" and the exact date and time. Nothing for a post never posted.
 * A caption.
 */
export default function PostPostedAt({ postedAt }: PostPostedAtProps) {
  const [format, setFormat] = useState<PostedAtFormat>('inWords');

  const formatted = postedAt ? formatPostedAt(postedAt, format) : null;

  function toggleFormat() {
    setFormat((prev) => (prev === 'inWords' ? 'dateTime' : 'inWords'));
  }

  if (!postedAt) return null;

  return (
    <Pressable onPress={toggleFormat}>
      <Text style={listTextStyles.caption}>Posted {formatted}</Text>
    </Pressable>
  );
}

function formatPostedAt(postedAt: number, format: PostedAtFormat) {
  return format === 'inWords' ? dateToTimeAgo(postedAt) : formatDateTime(postedAt);
}
