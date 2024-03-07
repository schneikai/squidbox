import { StyleSheet, View, Text } from 'react-native';

import AssetImage from '@/components/AssetImage';

const IMAGE_ELEMENT_HEIGHT = 240;

export default function PostImage({ assets }) {
  switch (assets.length) {
    case 0:
      return null;
    case 1:
      return <PostImageOneImage asset={assets[0]} />;
    case 2:
      return <PostImageTwoImages assets={assets} />;
    case 3:
      return <PostImageThreeImages assets={assets} />;
    default:
      return <PostImageFourImages assets={assets} />;
  }
}

function PostImageOneImage({ asset }) {
  const styles = StyleSheet.create({
    container: {
      height: IMAGE_ELEMENT_HEIGHT,
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={asset} />
    </View>
  );
}

function PostImageTwoImages({ assets }) {
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      height: IMAGE_ELEMENT_HEIGHT,
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={assets[0]} />
      <AssetImage asset={assets[1]} />
    </View>
  );
}

function PostImageThreeImages({ assets }) {
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      height: IMAGE_ELEMENT_HEIGHT,
    },
    imageContainer: {
      flex: 1,
      flexDirection: 'column',
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={assets[0]} />
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[1]} />
        <AssetImage asset={assets[2]} />
      </View>
    </View>
  );
}

function PostImageFourImages({ assets }) {
  const moreImages = assets.length - 4;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      height: IMAGE_ELEMENT_HEIGHT,
    },
    imageContainer: {
      height: IMAGE_ELEMENT_HEIGHT / 2,
      width: '50%',
    },
    moreImages: {
      position: 'absolute',
      color: 'white',
      bottom: 10,
      right: 10,
      fontSize: 18,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[0]} />
      </View>
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[1]} />
      </View>
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[2]} />
      </View>
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[3]} />
      </View>
      {moreImages > 0 && <Text style={styles.moreImages}>+{moreImages}</Text>}
    </View>
  );
}
