import moment from 'moment';

import { DATETIME_FORMAT } from './constants';

export default function formatDateTime(dt: moment.MomentInput): string {
  return moment(dt).format(DATETIME_FORMAT);
}
