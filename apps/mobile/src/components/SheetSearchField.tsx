import { StyleSheet, View } from 'react-native';

import SearchInput from '@/components/SearchInput';
import { layout } from '@/styles/designTokens';

export type SheetSearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

/**
 * A picker sheet's search: a field pinned under its ModalHeader, clear of it, that stays put while the
 * list under it scrolls. Give it `useSearchText().field`, and lay the sheet out as this, then the list
 * (padded with useScreenPadding('sheet-search')). The keyboard comes up only on a tap.
 */
export default function SheetSearchField({ placeholder, accessibilityLabel, ...field }: SheetSearchFieldProps) {
  return (
    <View style={styles.container}>
      <SearchInput
        variant="field"
        {...field}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: layout.sideGutter,
  },
});
