import type { FillSource } from './contactFields';

import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

type FillMarkProps = { source: FillSource };

/**
 * The mark of a value filled in for the user, on the field and on the note that names the fill: the
 * assistant's sparkle in the accent (From screenshot), the link icon in grey (From link).
 */
export default function FillMark({ source }: FillMarkProps) {
  return source === 'assistant' ? (
    <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} filled />
  ) : (
    <Icon name="link" size={sizes.menuIcon} color={colors.text.secondary} />
  );
}
