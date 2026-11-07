import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

/**
 * The mark of a value filled in for the user, From link's or From screenshot's: the sparkle in the
 * accent, on the field and on the note that names the fill.
 */
export default function FillMark() {
  return <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} filled />;
}
