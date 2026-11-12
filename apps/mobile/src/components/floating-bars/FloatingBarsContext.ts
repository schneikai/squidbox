import { type Dispatch, type SetStateAction, createContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import useRequiredContext from '@/hooks/useRequiredContext';

export type FloatingBarsValue = {
  isSearchActive: boolean;
  setIsSearchActive: Dispatch<SetStateAction<boolean>>;
  isSelectMode: boolean;
  setIsSelectMode: Dispatch<SetStateAction<boolean>>;
  scrollY: SharedValue<number>;
  isNavBarHidden: SharedValue<number>;
};

const FloatingBarsContext = createContext<FloatingBarsValue | null>(null);

export default FloatingBarsContext;

export function useFloatingBars() {
  return useRequiredContext(FloatingBarsContext, 'useFloatingBars must be used inside FloatingBarsProvider');
}
