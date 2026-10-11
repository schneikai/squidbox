import moment from 'moment';

// Header text for detail screens: the day on the first line ("Today", "Yesterday", a weekday
// within a week, else the date) and the time on the second.
export default function formatDetailHeaderDate(timestamp) {
  const date = moment(timestamp);
  return {
    title: date.calendar(null, {
      sameDay: '[Today]',
      lastDay: '[Yesterday]',
      nextDay: '[Tomorrow]',
      lastWeek: 'dddd',
      nextWeek: 'dddd',
      sameElse: 'DD. MMM YYYY',
    }),
    subtitle: date.format('LT'),
  };
}
