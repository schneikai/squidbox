// The Posted sheet's picker in a browser: the library has no web picker, so this is the browser's
// own date and time field (`datetime-local`), which opens the browser's native picker. Each change
// applies at once; clearing the field changes nothing (Remove takes the time away).
import moment from 'moment';

import { colors, radii, space, textStyles } from '@/styles/designTokens';
import { LOCAL_INPUT_FORMAT } from '@/utils/date-time/constants';

export default function PostedAtCalendar({ timestamp, onChange }) {
  function handleChange(event) {
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
function toLocalInputValue(timestamp) {
  return moment(timestamp).format(LOCAL_INPUT_FORMAT);
}

const INPUT_STYLE = {
  boxSizing: 'border-box',
  width: '100%',
  padding: space.md,
  border: 'none',
  borderRadius: radii.card,
  backgroundColor: colors.background.muted,
  color: colors.text.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // the system font react-native-web's Text uses
  fontSize: textStyles.body.fontSize, // one line: no line height in an input (TextInput)
};
