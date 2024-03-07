import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, useWindowDimensions, Text } from 'react-native';

import AssetImage from '@/components/AssetImage';
import useAssets from '@/features/assets-context/useAssets';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';

export default function PostAssets({ assetRefs }) {
  const { assets } = useAssets();
  const [postAssets, setPostAssets] = useState([]);

  const scrollViewRef = useRef();
  const [currentPage, setCurrentPage] = useState(0);
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    setPostAssets(assetRefsToPostAssets(assetRefs, assets));
  }, [assetRefs]);

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
          <View key={postAsset.id} style={{ width: screenWidth, height: screenWidth }}>
            <AssetImage asset={postAsset.asset} contentFit="contain" placeholderColor="transparent" />
          </View>
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
        <TouchableOpacity
          key={index}
          style={[styles.dot, currentPage === index && styles.activeDot]}
          onPress={() => scrollToItem(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: 'lightgray',
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
    borderRadius: 5,
    borderColor: 'white',
    borderWidth: 1,
  },
  activeDot: {
    backgroundColor: 'white',
  },
});
