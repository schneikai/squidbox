import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet, Text } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

import AssetImage from '@/components/AssetImage';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatVideoDuration from '@/utils/formatVideoDuration';
import { colors, scale, typography } from '@/styles/designTokens';

export default function AssetListItem({ asset, isSelected, isSelectMode, showLastPostedAt }) {
  const { lastPostedAt, duration, isFavorite, isSynced, notes } = asset;
  return (
    <View style={styles.container}>
      <AssetImage asset={asset} />
      {showLastPostedAt && <LastPostedAt lastPostedAt={lastPostedAt} />}
      <VideoDuration duration={duration} />

      {/* Top-right: favorite / cloud / note indicators */}
      <CornerGlow corner="topRight" size={80} />
      <View style={styles.indicators}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        <CloudIndicator isSynced={isSynced} />
        <NoteIndicator hasNote={!!notes} />
      </View>

      {/* Top-left: selection indicator (empty ring or filled checkmark) */}
      {isSelectMode && <CornerGlow corner="topLeft" size={60} />}
      {isSelectMode && <SelectIndicator isSelected={isSelected} />}
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

function SelectIndicator({ isSelected }) {
  return (
    <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
      {isSelected
        ? <Ionicons name="checkmark-sharp" size={15} color={colors.textInverse} />
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  videoDuration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    color: colors.textInverse,
    fontSize: typography.xs,
    fontWeight: '600',
  },

  lastPostedAt: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: colors.textInverse,
    fontSize: scale(10),
    fontWeight: 'bold',
  },

  indicators: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoriteAssetIndicator: {
    fontSize: typography.lg,
    color: colors.textInverse,
  },
  cloudIndicator: {
    fontSize: typography.lg,
    color: colors.textInverse,
  },
  noteIndicator: {
    fontSize: scale(16),
    color: colors.textInverse,
  },

  selectBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textInverse,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
