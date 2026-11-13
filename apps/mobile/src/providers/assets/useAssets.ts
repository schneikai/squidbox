import AssetsContext, { type AssetsContextValue } from './AssetsContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useAssets(): AssetsContextValue {
  return useRequiredContext(AssetsContext, 'useAssets needs an AssetsProvider above it');
}
