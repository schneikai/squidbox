import moment from 'moment';

import { DATETIME_FORMAT } from './constants';

// Format recent dates to a simple format like Today, Yesterday, [Day of week]
// with the time. Format older dates as absolute date time.
export default function dateToSimpleFormat(dateTime) {
  return moment(dateTime).calendar(null, {
    // For dates within the last week, return the day of the week and the time
    lastWeek: 'dddd LT',
    // For dates that are yesterday, return "Yesterday" and the time
    lastDay: '[Yesterday] LT',
    // For dates that are today, return "Today" and the time
    sameDay: '[Today] LT',
    // For dates older than a week, return the absolute date time
    sameElse() {
      return DATETIME_FORMAT; // Returns absolute date time
    },
  });
}
