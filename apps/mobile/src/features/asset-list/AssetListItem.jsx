import { memo, useSyncExternalStore } from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import { colors, radii, scale, sizes, typography } from '@/styles/designTokens';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';
import formatVideoDuration from '@/utils/formatVideoDuration';

import cornerGlowSource from './cornerGlowSource';

// Memoized: providers keep unchanged assets as the same objects, so a write re-renders only its cells.
export default memo(AssetListItem);

function AssetListItem({ asset, selection, showLastPostedAt }) {
  const { lastPostedAt, duration, isFavorite, isSynced, notes } = asset;
  // The glows darken the corners behind the indicators, so they only show over a loaded picture, as
  // does the cloud badge: the placeholder says itself when a picture isn't uploaded yet. They are
  // mounted from the start and only hidden: an image appears a few frames after it mounts, so
  // mounting them with the picture, or on the select-mode toggle, would pop them in late.
  const renderOverlay = (hasPicture) => (
    <>
      <CornerGlow corner="topRight" size={90} isHidden={!hasPicture} />
      {!!duration && <CornerGlow corner="bottomRight" size={90} isHidden={!hasPicture} />}
      {selection && <SelectGlow selection={selection} assetId={asset.id} hasPicture={hasPicture} />}
      <View style={styles.indicators}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        {hasPicture && <CloudIndicator isSynced={isSynced} />}
        <NoteIndicator hasNote={!!notes} />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <AssetImage asset={asset} renderOverlay={renderOverlay} />
      {showLastPostedAt && <LastPostedAt lastPostedAt={lastPostedAt} />}
      <VideoDuration duration={duration} />

      {/* Top-left: selection indicator (empty ring or filled checkmark) */}
      {selection && <SelectRing selection={selection} assetId={asset.id} />}
    </View>
  );
}

// Select mode reaches these two through the selection store, so a toggle re-renders only them.
function useSelectionState(selection, assetId) {
  return useSyncExternalStore(selection.subscribe, () => selection.stateOf(assetId));
}

function SelectGlow({ selection, assetId, hasPicture }) {
  const state = useSelectionState(selection, assetId);
  return <CornerGlow corner="topLeft" size={60} isHidden={!hasPicture || state === 'off'} />;
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

// One pre-rendered fade (cornerGlowSource), flipped for the other corners: an image per cell is far
// cheaper to mount than an SVG gradient, and every grid cell shows one or more.
const CORNER_STYLES = {
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0, transform: [{ scaleX: -1 }] },
  bottomRight: { bottom: 0, right: 0, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
};

function CornerGlow({ corner, size, isHidden = false }) {
  return (
    <Image
      source={cornerGlowSource}
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

  return <Icon name="heart" filled size={sizes.icon} color={colors.text.inverse} />;
}

function CloudIndicator({ isSynced }) {
  const iconName = isSynced ? 'cloud-check' : 'cloud-offline';

  return <Icon name={iconName} size={sizes.icon} color={colors.text.inverse} />;
}

function NoteIndicator({ hasNote }) {
  if (!hasNote) return null;

  return <Icon name="document" size={scale(16)} color={colors.text.inverse} />;
}

function SelectIndicator({ isSelected }) {
  return (
    <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
      {isSelected ? <Icon name="check" size={15} color={colors.text.inverse} /> : null}
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
    color: colors.text.inverse,
    fontSize: typography.caption2,
    fontWeight: '600',
  },

  lastPostedAt: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: colors.text.inverse,
    fontSize: typography.caption2,
    fontWeight: '700',
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
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.text.inverse,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeActive: {
    backgroundColor: colors.accent.base,
    borderColor: colors.accent.base,
  },
});
