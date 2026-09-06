import { createContext, use } from 'react';

const FloatingBarsContext = createContext(null);

export default FloatingBarsContext;

export function useFloatingBars() {
  const ctx = use(FloatingBarsContext);
  if (!ctx) throw new Error('useFloatingBars must be used inside FloatingBarsProvider');
  return ctx;
}
