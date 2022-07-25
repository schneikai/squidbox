import moment from "moment";

export function getTimestamp() {
  return new Date().getTime();
}

export function toTimestamp(dt) {
  if (dt === null || dt === undefined || isTimestamp(dt)) return dt;
  return dt.getTime();
}

export function fromTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined || !isTimestamp(timestamp)) return timestamp;
  return new Date(timestamp);
}

export function formatDateTime(dt) {
  return moment(dt).format("DD MMM YYYY HH:mm");
}

export function dateToFromNow(dateOrTimestamp) {
  return moment(dateOrTimestampToDate(dateOrTimestamp)).fromNow();
}

// Format created at
// https://stackoverflow.com/questions/35441820/tomorrow-today-and-yesterday-with-momentjs

// Today 10:12 AM
// Yesterday 6:25 AM
// Monday 10:52 PM
// 03. Jun 2022 4:52 PM

// Moment.js Formats
// https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/

// console.log(dateToFromNowDaily(asset.createdAt));
// console.log(dateToFromNowDaily(asset.createdAt - 100000000));
// console.log(dateToFromNowDaily(asset.createdAt - 300000000));
// console.log(dateToFromNowDaily(asset.createdAt - 3000000000));

export function dateToFromNowDaily(myDate) {
  // ensure the date is displayed with today and yesterday
  return moment(myDate).calendar(null, {
    // when the date is closer, specify custom values
    lastWeek: "dddd LT",
    lastDay: "[Yesterday] LT",
    sameDay: "[Today] LT",
    // when the date is further away, use from-now functionality
    sameElse: function () {
      return "DD. MMM YYYY LT";
    },
  });
}

function dateOrTimestampToDate(value) {
  return isTimestamp(value) ? fromTimestamp(value) : value;
}

function isTimestamp(value) {
  return typeof value === "number";
}
