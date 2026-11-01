// The Posted sheet's picker in a browser: the library has no web picker, so this is the browser's
// own date and time field (`datetime-local`), which opens the browser's native picker. Each change
// applies at once; clearing the field changes nothing (Remove takes the time away).
import { colors, radii, scale, typography } from '@/styles/designTokens';

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
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const INPUT_STYLE = {
  boxSizing: 'border-box',
  width: '100%',
  padding: scale(12),
  border: 'none',
  borderRadius: radii.card,
  backgroundColor: colors.background.muted,
  color: colors.text.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // the system font react-native-web's Text uses
  fontSize: typography.body,
};
