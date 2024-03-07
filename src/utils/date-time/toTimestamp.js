/**
 * Calculates the total number of milliseconds for the given time units.
 *
 * @param {Object} units - An object specifying the time units.
 * @param {number} [units.years=0] - Number of years.
 * @param {number} [units.months=0] - Number of months.
 * @param {number} [units.days=0] - Number of days.
 * @param {number} [units.hours=0] - Number of hours.
 * @param {number} [units.minutes=0] - Number of minutes.
 * @param {number} [units.seconds=0] - Number of seconds.
 * @returns {number} Total number of milliseconds for the given units.
 */
export default function toTimestamp(units) {
  const knownProperties = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];

  Object.keys(units).forEach((key) => {
    if (!knownProperties.includes(key)) {
      throw new Error(`Unknown property: ${key}`);
    }
  });

  const { years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = units;

  const millisecondsPerSecond = 1000;
  const secondsPerMinute = 60;
  const minutesPerHour = 60;
  const hoursPerDay = 24;
  const daysPerMonth = 30.44; // Average days in a month
  const daysPerYear = 365; // Average days in a year

  return Math.round(
    years * daysPerYear * hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond +
      months * daysPerMonth * hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond +
      days * hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond +
      hours * minutesPerHour * secondsPerMinute * millisecondsPerSecond +
      minutes * secondsPerMinute * millisecondsPerSecond +
      seconds * millisecondsPerSecond,
  );
}
