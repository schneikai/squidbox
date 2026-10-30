import { useState, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import SuperPressable from '@/components/SuperPressable';
import { colors, press, radii } from '@/styles/designTokens';

// `postAssets` are a post's [{ id, asset }], as postQuery reads them; a tap on one calls `onPressAsset(asset)`.
export default function PostAssets({ postAssets, onPressAsset }) {
  const scrollViewRef = useRef();
  const [currentPage, setCurrentPage] = useState(0);
  const { width: screenWidth } = useWindowDimensions();

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.floor((contentOffsetX + 0.5 * screenWidth) / screenWidth);
    if (newIndex !== currentPage) {
      setCurrentPage(newIndex);
    }
  };

  const scrollToItem = (index) => {
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      y: 0,
      animated: true,
    });
  };

  return (
    <View>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        style={styles.scrollView}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {postAssets.length === 0 && (
          <View style={{ width: screenWidth, height: screenWidth }}>
            <EmptyListComponent />
          </View>
        )}
        {postAssets.map((postAsset) => (
          <SuperPressable
            key={postAsset.id}
            style={{ width: screenWidth, height: screenWidth }}
            onPress={() => onPressAsset(postAsset.asset)}
          >
            <AssetImage asset={postAsset.asset} contentFit="contain" placeholderColor="transparent" />
          </SuperPressable>
        ))}
      </ScrollView>
      {postAssets.length > 1 && (
        <PaginationIndicator entries={postAssets} currentPage={currentPage} scrollToItem={scrollToItem} />
      )}
    </View>
  );
}

function EmptyListComponent() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No images</Text>
    </View>
  );
}

function PaginationIndicator({ entries, currentPage, scrollToItem }) {
  return (
    <View style={styles.pagination}>
      {entries.map((_, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [styles.dot, currentPage === index && styles.activeDot, pressed && press.flat]}
          onPress={() => scrollToItem(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: colors.background.muted,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
    marginTop: -30,
    marginBottom: 10,
    gap: 10,
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: radii.pill,
    borderColor: colors.text.inverse,
    borderWidth: 1,
  },
  activeDot: {
    backgroundColor: colors.text.inverse,
  },
});
