import { use } from 'react';

import CloudContext from './CloudContext';

export default function useCloud() {
  return use(CloudContext);
}
