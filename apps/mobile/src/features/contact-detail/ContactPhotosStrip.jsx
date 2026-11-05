import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import CoverImage from '@/components/CoverImage';
import assetHref from '@/features/asset-list/assetHref';
import { press, scale } from '@/styles/designTokens';

const SIZE = scale(84);

/** The first photos a contact is on, side by side; each opens in the contact's photos (`scope`). */
export default function ContactPhotosStrip({ assets, scope }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {assets.map((asset) => (
        <Pressable
          key={asset.id}
          style={({ pressed }) => pressed && press.flat}
          onPress={() => router.navigate(assetHref(asset.id, { scope }))}
          accessibilityRole="imagebutton"
          accessibilityLabel="Photo"
        >
          <CoverImage asset={asset} style={styles.thumbnail} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
  },
  thumbnail: {
    width: SIZE,
    height: SIZE,
  },
});
