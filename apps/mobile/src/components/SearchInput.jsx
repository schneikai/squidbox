import { StyleSheet } from 'react-native';

import Card from './Card';
import SearchTextInput from './SearchTextInput';

import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

/**
 * A search row for inline list filtering inside modals and sheets.
 * Composes Card (bordered container) + leading search icon + SearchTextInput.
 *
 * style — applied to the outer Card container only
 * inputStyle — applied to the inner SearchTextInput only
 * All other props are forwarded to the inner SearchTextInput.
 */
export default function SearchInput({ style, inputStyle, ...rest }) {
  return (
    <Card style={[styles.row, style]}>
      <Icon name="search" size={sizes.iconSmall} color={colors.text.secondary} />
      <SearchTextInput style={[styles.input, inputStyle]} {...rest} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
  },
});
