import { StyleSheet } from 'react-native';

import Card from './Card';
import TextInput from './TextInput';

import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';

/**
 * A search row for inline list filtering inside modals and sheets.
 * Composes Card (bordered container) + leading search icon + TextInput.
 *
 * style — applied to the outer Card container only
 * inputStyle — applied to the inner TextInput only
 * All other props are forwarded to the inner TextInput.
 */
export default function SearchInput({ style, inputStyle, accessibilityLabel, ...rest }) {
  return (
    <Card style={[styles.row, style]}>
      <Icon name="search" size={spacing.iconSizeSmall} color={colors.textSecondary} />
      <TextInput
        placeholder="Search"
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.input, inputStyle]}
        accessibilityLabel={accessibilityLabel}
        {...rest}
      />
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
