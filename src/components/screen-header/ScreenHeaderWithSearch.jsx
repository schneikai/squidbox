import { View, Text, StyleSheet } from 'react-native';

import ScreenHeaderContainer from '@/components/screen-header/ScreenHeaderContainer';
import SearchBar from '@/components/screen-header/SearchBar';
import screenHeaderStyles from '@/styles/screenHeaderStyles';

export default function ScreenHeaderWithSearch({
  label,
  isSearchBarVisible,
  searchText,
  setSearchText,
  toggleSearchBar,
  insets = { top: 0 },
  children,
}) {
  return (
    <View>
      <ScreenHeaderContainer insets={insets}>
        <Text style={screenHeaderStyles.title}>{label}</Text>
        {children}
      </ScreenHeaderContainer>

      {isSearchBarVisible && (
        <View style={styles.searchBarContainer}>
          <SearchBar searchText={searchText} setSearchText={setSearchText} toggleSearchBar={toggleSearchBar} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBarContainer: {
    padding: 10,
  },
});
