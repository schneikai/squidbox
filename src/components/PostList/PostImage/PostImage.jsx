import { StyleSheet, View, Text } from "react-native";
import AssetImage from "components/AssetImage";

const IMAGE_ELEMENT_HEIGHT = 240;

export default function PostImage({ assets, totalAssets }) {
  switch (assets.length) {
    case 1:
      return <PostImageOneImage asset={assets[0]} />;
      break;
    case 2:
      return <PostImageTwoImages assets={assets} />;
      break;
    case 3:
      return <PostImageThreeImages assets={assets} />;
      break;
    default:
      return <PostImageFourImages assets={assets} totalAssets={totalAssets} />;
      break;
  }
}

function PostImageOneImage({ asset }) {
  const styles = StyleSheet.create({
    image: {
      width: "100%",
      height: IMAGE_ELEMENT_HEIGHT,
      resizeMode: "cover",
    },
  });

  return <AssetImage asset={asset} style={styles.image} />;
}

function PostImageTwoImages({ assets }) {
  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      height: IMAGE_ELEMENT_HEIGHT,
    },
    image: {
      flex: 1,
      resizeMode: "cover",
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={assets[0]} style={styles.image} />
      <AssetImage asset={assets[1]} style={styles.image} />
    </View>
  );
}

function PostImageThreeImages({ assets }) {
  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      height: IMAGE_ELEMENT_HEIGHT,
    },
    image: {
      flex: 1,
      resizeMode: "cover",
    },
    imageContainer: {
      flex: 1,
      backgroundColor: "green",
      flexDirection: "column",
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={assets[0]} style={styles.image} />
      <View style={styles.imageContainer}>
        <AssetImage asset={assets[1]} style={styles.image} />
        <AssetImage asset={assets[2]} style={styles.image} />
      </View>
    </View>
  );
}

function PostImageFourImages({ assets, totalAssets }) {
  const moreImages = totalAssets - 4;

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      height: IMAGE_ELEMENT_HEIGHT,
      flexWrap: "wrap",
    },
    image: {
      resizeMode: "cover",
      height: IMAGE_ELEMENT_HEIGHT / 2,
      width: "50%",
    },
    moreImages: {
      position: "absolute",
      color: "white",
      bottom: 10,
      right: 10,
      fontSize: 18,
      fontWeight: "600",
    },
  });

  return (
    <View style={styles.container}>
      <AssetImage asset={assets[0]} style={styles.image} />
      <AssetImage asset={assets[1]} style={styles.image} />
      <AssetImage asset={assets[2]} style={styles.image} />
      <AssetImage asset={assets[2]} style={styles.image} />
      {moreImages > 0 && <Text style={styles.moreImages}>+{moreImages}</Text>}
    </View>
  );
}
