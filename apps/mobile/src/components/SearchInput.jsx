import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import TextInput from '@/components/TextInput';
import { colors, radii, scale, sizes } from '@/styles/designTokens';

/**
 * A TextInput for search terms: no autocorrect or autocapitalization. `variant` is where it sits:
 *   inline — inside a layout of its own (the floating search bar), the default. style is the
 *            input's own box
 *   field  — a white search pill of its own, with the magnifier in front (Add models, Add contacts). style is
 *            for layout only
 * The other props, `ref` too, are React Native's TextInput's.
 */
export default function SearchInput({ variant = 'inline', style, ...rest }) {
  if (variant !== 'field') {
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
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
  },
});
