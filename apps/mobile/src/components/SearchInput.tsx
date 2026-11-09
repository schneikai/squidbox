import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import TextInput, { type TextInputProps } from '@/components/TextInput';
import { colors, layout, radii, scale, sizes } from '@/styles/designTokens';

export type SearchInputProps = Omit<TextInputProps, 'variant'> & { variant?: 'inline' | 'field' };

/**
 * A TextInput for search terms: no autocorrect or autocapitalization. `variant` is where it sits:
 *   inline — inside a layout of its own (the floating search bar), the default. style is the
 *            input's own box
 *   field  — a white search pill of its own, with the magnifier in front (a picker sheet's
 *            SheetSearchField). style is for layout only
 * The other props, `ref` too, are React Native's TextInput's.
 */
export default function SearchInput({ variant = 'inline', style, ...rest }: SearchInputProps) {
  if (variant === 'inline') {
    return <TextInput placeholder="Search" autoCorrect={false} autoCapitalize="none" style={style} {...rest} />;
  }

  return (
    <Card style={[styles.row, style]}>
      <Icon name="search" size={sizes.icon} color={colors.text.secondary} />
      <TextInput placeholder="Search" autoCorrect={false} autoCapitalize="none" style={styles.input} {...rest} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scale(46),
    borderRadius: radii.pill,
    // A row's: the magnifier is its leading icon, the text starts where a row's with an icon does.
    paddingHorizontal: layout.rowInset,
    gap: layout.rowLeadingGap,
  },
  input: {
    flex: 1,
  },
});
