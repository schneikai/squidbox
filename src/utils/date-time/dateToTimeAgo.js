import moment from 'moment';

// Format dates as relative time like "x days ago" or "x months ago".
export default function dateToTimeAgo(dateTime) {
  const aDayAgo = moment().subtract(1, 'day');
  const aMonthAgo = moment().subtract(1, 'month');
  const aYearAgo = moment().subtract(1, 'year');

  const momentDate = moment(dateTime);

  if (momentDate.isAfter(aDayAgo)) {
    // For dates less than a day old, use fromNow to show relative time
    return momentDate.fromNow();
  } else if (momentDate.isAfter(aMonthAgo)) {
    // For dates less than a month old but more than a day, show 'x days ago'
    return moment().diff(momentDate, 'days') + ' days ago';
  } else if (momentDate.isAfter(aYearAgo)) {
    // For dates less than a year old but more than a month, show 'x months ago'
    return moment().diff(momentDate, 'months') + ' months ago';
  } else {
    // For dates more than a year old, show 'x years ago'
    return moment().diff(momentDate, 'years') + ' years ago';
  }
}
