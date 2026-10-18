import moment from 'moment';

// The weekday, date and time in full, in the device's locale: "Saturday, September 19, 2026 11:48 PM".
export default function formatFullDateTime(dt) {
  return moment(dt).format('LLLL');
}
