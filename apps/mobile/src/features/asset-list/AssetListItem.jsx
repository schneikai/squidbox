import { memo, useSyncExternalStore } from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import { colors, scale, typography } from '@/styles/designTokens';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatVideoDuration from '@/utils/formatVideoDuration';

// Memoized: providers keep unchanged assets as the same objects, so a write re-renders only its cells.
export default memo(AssetListItem);

function AssetListItem({ asset, selection, showLastPostedAt }) {
  const { lastPostedAt, duration, isFavorite, isSynced, notes } = asset;
  // The glows darken the corners behind the indicators, so they only show over a loaded picture.
  const glows = (
    <>
      <CornerGlow corner="topRight" size={80} />
      {!!duration && <CornerGlow corner="bottomRight" size={80} />}
      {selection && <SelectGlow selection={selection} assetId={asset.id} />}
    </>
  );

  return (
    <View style={styles.container}>
      <AssetImage asset={asset} overlay={glows} />
      {showLastPostedAt && <LastPostedAt lastPostedAt={lastPostedAt} />}
      <VideoDuration duration={duration} />

      {/* Top-right: favorite / cloud / note indicators */}
      <View style={styles.indicators}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        <CloudIndicator isSynced={isSynced} />
        <NoteIndicator hasNote={!!notes} />
      </View>

      {/* Top-left: selection indicator (empty ring or filled checkmark) */}
      {selection && <SelectRing selection={selection} assetId={asset.id} />}
    </View>
  );
}

// Select mode reaches these two through the selection store, so a toggle re-renders only them.
function useSelectionState(selection, assetId) {
  return useSyncExternalStore(selection.subscribe, () => selection.stateOf(assetId));
}

// Stays mounted while select mode is off, only hidden: an image appears a few frames after it mounts,
// so mounting it on the toggle would show the ring before its glow.
function SelectGlow({ selection, assetId }) {
  const state = useSelectionState(selection, assetId);
  return <CornerGlow corner="topLeft" size={60} isHidden={state === 'off'} />;
}

function SelectRing({ selection, assetId }) {
  const state = useSelectionState(selection, assetId);
  if (state === 'off') return null;
  return <SelectIndicator isSelected={state === 'selected'} />;
}

function LastPostedAt({ lastPostedAt }) {
  if (!lastPostedAt) {
    return <Text style={styles.lastPostedAt}>Never posted</Text>;
  }

  return <Text style={styles.lastPostedAt}>{dateToTimeAgo(lastPostedAt)}</Text>;
}

// One pre-rendered radial fade (black at 45% in the top-left corner to transparent), flipped for the
// other corners: an image per cell is far cheaper to mount than an SVG gradient, and every grid cell
// shows one or more.
const CORNER_GLOW = require('../../../assets/corner-glow.png');
const CORNER_STYLES = {
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0, transform: [{ scaleX: -1 }] },
  bottomRight: { bottom: 0, right: 0, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
};

function CornerGlow({ corner, size, isHidden = false }) {
  return (
    <Image
      source={CORNER_GLOW}
      style={[styles.cornerGlow, { width: size, height: size }, CORNER_STYLES[corner], isHidden && styles.hidden]}
    />
  );
}

function VideoDuration({ duration }) {
  if (!duration) return null;

  return <Text style={styles.videoDuration}>{formatVideoDuration(duration)}</Text>;
}

function FavoriteAssetIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Icon name="heart" filled size={typography.lg} color={colors.textInverse} />;
}

function CloudIndicator({ isSynced }) {
  const iconName = isSynced ? 'cloud-check' : 'cloud-offline';

  return <Icon name={iconName} size={typography.lg} color={colors.textInverse} />;
}

function NoteIndicator({ hasNote }) {
  if (!hasNote) return null;

  return <Icon name="document" size={scale(16)} color={colors.textInverse} />;
}

function SelectIndicator({ isSelected }) {
  return (
    <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
      {isSelected ? <Icon name="check" size={15} color={colors.textInverse} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  cornerGlow: {
    position: 'absolute',
  },
  hidden: {
    opacity: 0,
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
