import moment from 'moment';

import { DATETIME_FORMAT } from './constants';

export default function formatDateTime(dt) {
  return moment(dt).format(DATETIME_FORMAT);
}
