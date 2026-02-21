import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet, Text } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

import AssetImage from '@/components/AssetImage';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatVideoDuration from '@/utils/formatVideoDuration';

export default function AssetListItem({ asset, isSelected, showLastPostedAt }) {
  const { lastPostedAt, duration, isFavorite, isSynced, notes } = asset;
  return (
    <View style={styles.container}>
      <AssetImage asset={asset} />
      {showLastPostedAt && <LastPostedAt lastPostedAt={lastPostedAt} />}
      <VideoDuration duration={duration} />
      <CornerGlow corner="topLeft" size={80} />
      <View style={styles.indicators}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        <CloudIndicator isSynced={isSynced} />
        <NoteIndicator hasNote={!!notes} />
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

const CORNER_POSITIONS = {
  topLeft:     { top: 0,    left: 0,  cx: '0%',   cy: '0%'   },
  topRight:    { top: 0,    right: 0, cx: '100%',  cy: '0%'   },
  bottomRight: { bottom: 0, right: 0, cx: '100%',  cy: '100%' },
  bottomLeft:  { bottom: 0, left: 0,  cx: '0%',   cy: '100%' },
};

function CornerGlow({ corner = 'bottomRight', size = 80, opacity = .6 }) {
  const { cx, cy, ...pos } = CORNER_POSITIONS[corner];
  const id = `cornerGlow_${corner}`;
  return (
    <Svg style={[{ position: 'absolute', width: size, height: size }, pos]} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r="100%" fx={cx} fy={cy}>
          <Stop offset="0%" stopColor="#000" stopOpacity={opacity} />
          <Stop offset="100%" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

function VideoDuration({ duration }) {
  if (!duration) return null;

  return (
    <>
      <CornerGlow corner="bottomRight" size={80} />
      <Text style={styles.videoDuration}>{formatVideoDuration(duration)}</Text>
    </>
  );
}

function FavoriteAssetIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Ionicons name="heart" style={styles.favoriteAssetIndicator} />;
}

function CloudIndicator({ isSynced }) {
  const iconName = isSynced ? 'cloud-done' : 'cloud-offline';

  return <Ionicons name={iconName} style={styles.cloudIndicator} />;
}

function NoteIndicator({ hasNote }) {
  if (!hasNote) return null;

  return <Ionicons name="document-text" style={styles.noteIndicator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  videoDuration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
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
  noteIndicator: {
    fontSize: 16,
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
