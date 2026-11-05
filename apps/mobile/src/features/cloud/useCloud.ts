import CloudContext, { type CloudContextValue } from './CloudContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useCloud(): CloudContextValue {
  return useRequiredContext(CloudContext, 'useCloud needs a CloudProvider above it');
}
