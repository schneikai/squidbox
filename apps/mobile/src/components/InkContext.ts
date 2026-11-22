import { createContext } from 'react';

import { colors } from '@/styles/designTokens';

// The colors that are black or grey on a white or grey surface: text, grey icons and the see-through
// fill of a chip or a secondary button.
export type Ink = { primary: string; secondary: string; fill: string };

export const DEFAULT_INK: Ink = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  fill: colors.background.fill,
};

// Set by a tinted surface around what sits on it (the AssistantTray: dark violet), so what is black
// or grey anywhere else takes the surface's own shade there, with no variant of its own; a white
// Card sets it back for its content. Text, Chip, Button and their icons read it.
const InkContext = createContext<Ink>(DEFAULT_INK);

export default InkContext;
