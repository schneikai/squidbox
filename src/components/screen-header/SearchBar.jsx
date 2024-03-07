import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';

import useDebounce from '@/hooks/useDebounce';

export default function SearchBar({ searchText, setSearchText, toggleSearchBar }) {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState(searchText);

  const debouncedSetSearchText = useDebounce(setSearchText, 500);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function onChangeText(text) {
    setInputValue(text);
    debouncedSetSearchText(text);
  }

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search"
        value={inputValue}
        onChangeText={onChangeText}
      />
      <Ionicons name="close" style={styles.icon} onPress={toggleSearchBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'lightgrey',
    borderRadius: 20,
    padding: 12,
  },
  icon: {
    fontSize: 16,
    color: 'grey',
    position: 'absolute',
    right: 0,
    padding: 10,
  },
  input: {
    marginLeft: 8,
    fontSize: 16,
  },
});
