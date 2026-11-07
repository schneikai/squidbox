// The Posted sheet's picker in a browser: the library has no web picker, so this is the browser's
// own date and time field (`datetime-local`), which opens the browser's native picker. Each change
// applies at once; clearing the field changes nothing (Remove takes the time away).
import moment from 'moment';
import type { ChangeEvent, CSSProperties } from 'react';

// Type-only, so Babel erases it and Metro never follows it into the native module on web.
import type { PostedAtCalendarProps } from './PostedAtCalendar';

import { colors, layout, radii, space, typography } from '@/styles/designTokens';
import { LOCAL_INPUT_FORMAT } from '@/utils/date-time/constants';

export default function PostedAtCalendar({ timestamp, onChange }: PostedAtCalendarProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const time = new Date(event.target.value).getTime();
    if (!Number.isNaN(time)) onChange(time);
  }

  return (
    <input
      type="datetime-local"
      aria-label="Posted"
      value={toLocalInputValue(timestamp ?? Date.now())}
      onChange={handleChange}
      style={INPUT_STYLE}
    />
  );
}

// `datetime-local` reads and writes the local time as "YYYY-MM-DDTHH:mm".
function toLocalInputValue(timestamp: number) {
  return moment(timestamp).format(LOCAL_INPUT_FORMAT);
}

const INPUT_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  // A field's insets (TextInput's).
  paddingTop: space.md,
  paddingBottom: space.md,
  paddingLeft: layout.rowInset,
  paddingRight: layout.rowInset,
  border: 'none',
  borderRadius: radii.card,
  backgroundColor: colors.background.muted,
  color: colors.text.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // the system font react-native-web's Text uses
  fontSize: typography.body, // one line: no line height in an input (TextInput)
};
