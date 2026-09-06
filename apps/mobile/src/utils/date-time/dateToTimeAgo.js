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
    const days = moment().diff(momentDate, 'days');
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (momentDate.isAfter(aYearAgo)) {
    // For dates less than a year old but more than a month, show 'x months ago'
    const months = moment().diff(momentDate, 'months');
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    // For dates more than a year old, show 'x years' or 'x years, y months' if months > 0
    const years = moment().diff(momentDate, 'years');
    const months = moment().diff(momentDate, 'months') % 12;
    return months > 0
      ? // ? `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''} ago`
        `${years}y ${months}m ago`
      : `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}
