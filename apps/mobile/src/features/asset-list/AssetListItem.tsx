import { memo, useSyncExternalStore } from 'react';
import { Image, View, StyleSheet, type ImageStyle } from 'react-native';

import type { SelectionStore } from './createSelectionStore';
import cornerGlow from '../../../assets/corner-glow.png';

import AssetImage from '@/components/AssetImage';
import Icon from '@/components/Icon';
import SelectIndicator from '@/components/SelectIndicator';
import Text from '@/components/Text';
import cornerStyles from '@/styles/cornerStyles';
import { colors, layout, scale, sizes } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';
import formatVideoDuration from '@/utils/formatVideoDuration';

// Memoized: providers keep unchanged assets as the same objects, so a write re-renders only its cells.
export default memo(AssetListItem);

export type AssetListItemProps = { asset: AssetRow; selection?: SelectionStore };

function AssetListItem({ asset, selection }: AssetListItemProps) {
  const { duration, isFavorite, isSynced, notes } = asset;
  // The glows darken the corners behind the indicators, so they only show over a loaded picture, as
  // does the cloud badge: the placeholder says itself when a picture isn't uploaded yet. They are
  // mounted from the start and only hidden: an image appears a few frames after it mounts, so
  // mounting them with the picture, or on the select-mode toggle, would pop them in late.
  const renderOverlay = (hasPicture: boolean) => (
    <>
      <CornerGlow corner="topRight" size={90} isHidden={!hasPicture} />
      {!!duration && <CornerGlow corner="bottomRight" size={90} isHidden={!hasPicture} />}
      {selection && <SelectGlow selection={selection} assetId={asset.id} hasPicture={hasPicture} />}
      <View style={[cornerStyles.topRight, styles.indicators]}>
        <FavoriteAssetIndicator isFavorite={isFavorite} />
        {hasPicture && <CloudIndicator isSynced={isSynced} />}
        <NoteIndicator hasNote={!!notes} />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <AssetImage asset={asset} renderOverlay={renderOverlay} />
      <VideoDuration duration={duration} />

      {/* Top-left: selection indicator (empty ring or filled checkmark) */}
      {selection && <SelectRing selection={selection} assetId={asset.id} />}
    </View>
  );
}

// Select mode reaches these two through the selection store, so a toggle re-renders only them.
function useSelectionState(selection: SelectionStore, assetId: string) {
  return useSyncExternalStore(selection.subscribe, () => selection.stateOf(assetId));
}

type SelectGlowProps = { selection: SelectionStore; assetId: string; hasPicture: boolean };

function SelectGlow({ selection, assetId, hasPicture }: SelectGlowProps) {
  const state = useSelectionState(selection, assetId);
  return <CornerGlow corner="topLeft" size={60} isHidden={!hasPicture || state === 'off'} />;
}

type SelectRingProps = { selection: SelectionStore; assetId: string };

function SelectRing({ selection, assetId }: SelectRingProps) {
  const state = useSelectionState(selection, assetId);
  if (state === 'off') return null;
  return <SelectIndicator isSelected={state === 'selected'} isOnMedia style={cornerStyles.topLeft} />;
}

// One pre-rendered radial fade (black at 42% in the top-left corner, easing out to transparent with no
// visible edge), flipped for the other corners: an image per cell is far cheaper to mount than an SVG
// gradient, and every grid cell shows one or more.
type Corner = 'topLeft' | 'topRight' | 'bottomRight';
const CORNER_STYLES: Record<Corner, ImageStyle> = {
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0, transform: [{ scaleX: -1 }] },
  bottomRight: { bottom: 0, right: 0, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
};

type CornerGlowProps = { corner: Corner; size: number; isHidden?: boolean };

function CornerGlow({ corner, size, isHidden = false }: CornerGlowProps) {
  return (
    <Image
      source={cornerGlow}
      style={[styles.cornerGlow, { width: size, height: size }, CORNER_STYLES[corner], isHidden && styles.hidden]}
    />
  );
}

function VideoDuration({ duration }: Pick<AssetRow, 'duration'>) {
  if (!duration) return null;

  return (
    // Bare text, not a ThumbnailBadge: the grid's cells are small and a capsule on each would crowd
    // them (the corner glow keeps it readable).
    <Text variant="label" size="small" tone="inverse" style={cornerStyles.bottomRight}>
      {formatVideoDuration(duration)}
    </Text>
  );
}

function FavoriteAssetIndicator({ isFavorite }: Pick<AssetRow, 'isFavorite'>) {
  if (!isFavorite) return;

  return <Icon name="heart" filled size={sizes.icon} color={colors.text.inverse} />;
}

function CloudIndicator({ isSynced }: Pick<AssetRow, 'isSynced'>) {
  const iconName = isSynced ? 'cloud-check' : 'cloud-offline';

  return <Icon name={iconName} size={sizes.icon} color={colors.text.inverse} />;
}

function NoteIndicator({ hasNote }: { hasNote: boolean }) {
  if (!hasNote) return null;

  return <Icon name="document" size={scale(16)} color={colors.text.inverse} />;
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

  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGapSmall,
  },
});
