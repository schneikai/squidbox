import { useState, useEffect } from 'react';
import { Text, Pressable } from 'react-native';

import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatDateTime from '@/utils/date-time/formatDateTime';

export default function PostPostedAt({ postedAt, style }) {
  const [postedAtFormat, setPostedAtFormat] = useState('inWords');
  const [postedAtFormated, setPostedAtFormated] = useState(formatPostedAt(postedAt, postedAtFormat));

  useEffect(() => {
    setPostedAtFormated(formatPostedAt(postedAt, postedAtFormat));
  }, [postedAtFormat]);

  function togglePostedAtFormat() {
    setPostedAtFormat((prevPostedAtFormat) => (prevPostedAtFormat === 'inWords' ? 'dateTime' : 'inWords'));
  }

  function formatPostedAt(postedAt, format) {
    if (format === 'inWords') {
      return dateToTimeAgo(postedAt);
    } else if (format === 'dateTime') {
      return formatDateTime(postedAt);
    }
  }

  return (
    <Pressable onPress={togglePostedAtFormat}>
      <Text style={style}>Posted {postedAtFormated}</Text>
    </Pressable>
  );
}
