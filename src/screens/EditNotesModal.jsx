import { useState, useLayoutEffect } from 'react';
import { Button, TextInput, StyleSheet, View } from 'react-native';

import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';

export default function EditNotesModal({ route, navigation }) {
  const { type, id, notes: initialNotes } = route.params;
  const [notes, setNotes] = useState(initialNotes ?? '');

  const { updateAlbum } = useAlbums();
  const { updateAsset } = useAssets();

  async function handleSave() {
    const value = notes.trim() === '' ? null : notes.trim();
    if (type === 'album') {
      await updateAlbum(id, { notes: value });
    } else {
      await updateAsset(id, { notes: value });
    }
    navigation.goBack();
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Notes',
      headerLeft: () => <Button onPress={() => navigation.goBack()} title="Cancel" />,
      headerRight: () => <Button onPress={handleSave} title="Save" />,
    });
  }, [navigation, notes]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Add a note…"
        multiline
        autoFocus
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
});
