import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet, Text } from 'react-native';

import AssetImage from '@/components/AssetImage';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatVideoDuration from '@/utils/formatVideoDuration';

export default function AssetListItem({ asset, isSelected, showLastPostedAt }) {
  const { lastPostedAt, duration, isFavorite, isSynced } = asset;
  return (
    <View style={styles.container}>
      <AssetImage asset={asset} />
      {showLastPostedAt && <LastPostedAt lastPostedAt={lastPostedAt} />}
      <VideoDuration duration={duration} />
      <View style={styles.indicators}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        <CloudIndicator isSynced={isSynced} />
      </View>
      {isSelected && <Ionicons name="checkmark-circle" style={styles.selectIndicator} />}
    </View>
  );
}

function LastPostedAt({ lastPostedAt }) {
  if (!lastPostedAt) {
    return <Text style={styles.lastPostedAt}>Never posted</Text>;
  }

  return <Text style={styles.lastPostedAt}>{dateToTimeAgo(lastPostedAt)}</Text>;
}

function VideoDuration({ duration }) {
  if (!duration) return;

  return <Text style={styles.videoDuration}>{formatVideoDuration(duration)}</Text>;
}

function FavoriteAssetIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Ionicons name="heart" style={styles.favoriteAssetIndicator} />;
}

function CloudIndicator({ isSynced }) {
  const iconName = isSynced ? 'cloud-done' : 'cloud-offline';

  return <Ionicons name={iconName} style={styles.cloudIndicator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  videoDuration: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  lastPostedAt: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },

  indicators: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  favoriteAssetIndicator: {
    fontSize: 20,
    color: 'white',
  },
  cloudIndicator: {
    fontSize: 20,
    color: 'white',
  },

  selectIndicator: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    fontSize: 26,
    textAlign: 'center',
    color: 'turquoise',
  },
});
