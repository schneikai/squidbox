import { createContext } from 'react';

import { textStyles } from '@/styles/designTokens';

/** The size and line height of the text something inline stands in (a mention chip sizes itself by them). */
export type TextMetrics = { fontSize: number; lineHeight: number };

// Set by a Text with inline views (components/Text) for its role and size, and by a chat bubble's
// text; reading text outside them.
const TextMetricsContext = createContext<TextMetrics>(textStyles.reading);

export default TextMetricsContext;
