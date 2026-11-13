import type { ContactRecord } from '@squidbox/shared';
import { useEffect, useId, useState } from 'react';
import { Image, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Mask, Path, Rect, Text as SvgText } from 'react-native-svg';

import Icon from '@/components/Icon';
import { isFileName } from '@/library/fileFields';
import type { LibraryPaths } from '@/library/libraryPaths';
import useOpenLibrary from '@/library/useOpenLibrary';
import useAssetThumbnailLoader from '@/providers/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/providers/cloud/useCloud';
import { colors, sizes, space } from '@/styles/designTokens';
import { getAvatarUri, hasAvatar } from '@/utils/assets/assetStorage';

/**
 * A contact's round avatar: the picture at `uri` when given, else the contact's photo (from the device,
 * or fetched from the user's storage), else its initials (a person without a
 * name yet) on the accent's soft surface, like the account button.
 * `size` is a key of sizes.avatar (`chip` … `hero`). With `isFavorite` it wears a large red heart over
 * its top right edge, outlined in `outlineColor`, the color of the surface behind it (a card's white
 * unless told), so it stands apart from the picture. `isStacked` rings it in white, for avatars
 * overlapping in a stack. `cutout`, for a face in a row of overlapping ones, is how far the next face
 * reaches over its right edge: a crescent that much plus a thin gap is cut out of this one, so a real
 * gap shows whatever is behind the row, on any background.
 * VoiceOver reads the contact's name. style is for layout only.
 */
export type ContactAvatarProps = {
  // A new contact has no photo name yet.
  contact: Pick<ContactRecord, 'name'> & Partial<Pick<ContactRecord, 'avatarFilename'>>;
  uri?: string | null;
  size?: keyof typeof sizes.avatar;
  isFavorite?: boolean;
  isStacked?: boolean;
  outlineColor?: string;
  cutout?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ContactAvatar({
  contact,
  uri,
  size = 'row',
  isFavorite = false,
  isStacked = false,
  outlineColor = colors.background.surface,
  cutout,
  style,
}: ContactAvatarProps) {
  const avatarUri = useAvatarUri(contact);
  const diameter = sizes.avatar[size];
  const initials = initialsOf(contact.name);
  const heart = Math.round(diameter * HEART_RATIO);
  const ring = Math.max(2, Math.round(heart * OUTLINE_RATIO));
  const outline = heart + 2 * ring;
  const pictureUri = uri ?? avatarUri;

  return (
    <View
      style={[
        styles.avatar,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        isStacked && styles.stacked,
        !!cutout && styles.cut,
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={contact.name || 'New contact'}
    >
      {cutout ? (
        <CutFace diameter={diameter} cutout={cutout} uri={pictureUri} initials={initials} />
      ) : pictureUri ? (
        <Image source={{ uri: pictureUri }} style={[StyleSheet.absoluteFill, { borderRadius: diameter / 2 }]} />
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: Math.round(diameter * 0.36) }]} numberOfLines={1}>
          {initials}
        </Text>
      ) : (
        <Icon name="user" size={Math.round(diameter * 0.45)} color={colors.accent.base} />
      )}
      {isFavorite && (
        <FavoriteHeart
          heart={heart}
          ring={ring}
          color={outlineColor}
          style={{ top: -outline * HEART_OVERHANG, right: -outline * HEART_OVERHANG }}
        />
      )}
    </View>
  );
}

// The gap between overlapping faces.
const CUT_GAP = space.hair;

// A face drawn in one drawing with the next face's circle (moved `cutout` in from its right edge,
// CUT_GAP wider) masked out of it. Without a picture or initials it is the plain soft circle.
type CutFaceProps = { diameter: number; cutout: number; uri: string | null; initials: string };

function CutFace({ diameter, cutout, uri, initials }: CutFaceProps) {
  const id = useId();
  const r = diameter / 2;
  const fontSize = Math.round(diameter * 0.36);
  return (
    <Svg width={diameter} height={diameter} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={diameter} height={diameter}>
          <Rect width={diameter} height={diameter} fill="white" />
          <Circle cx={diameter - cutout + r} cy={r} r={r + CUT_GAP} fill="black" />
        </Mask>
        <ClipPath id={`${id}c`}>
          <Circle cx={r} cy={r} r={r} />
        </ClipPath>
      </Defs>
      <G mask={`url(#${id}m)`}>
        <Circle cx={r} cy={r} r={r} fill={colors.accent.surface} />
        {uri ? (
          <SvgImage
            href={{ uri }}
            width={diameter}
            height={diameter}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${id}c)`}
          />
        ) : (
          !!initials && (
            <SvgText
              x={r}
              y={r + fontSize * 0.36}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight="600"
              fill={colors.accent.base}
            >
              {initials}
            </SvgText>
          )
        )}
      </G>
    </Svg>
  );
}

// The favorite's heart: about 45% of the avatar's width, its outline a twelfth of it on each side,
// reaching a quarter of its box past the avatar's top and right edges.
const HEART_RATIO = 0.45;
const OUTLINE_RATIO = 0.08;
const HEART_OVERHANG = 0.25;
const HEART_PATH =
  'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5';

// The red heart with a ring of the surface's color around it: one path drawn twice in one drawing
// (the ring as a wide stroke under the fill), so the two can't drift apart at any size.
type FavoriteHeartProps = { heart: number; ring: number; color: string; style: ViewStyle };

function FavoriteHeart({ heart, ring, color, style }: FavoriteHeartProps) {
  const pad = (ring * 24) / heart; // the ring's width in the 24-unit drawing
  const box = heart + 2 * ring;
  return (
    <Svg
      width={box}
      height={box}
      viewBox={`${-pad} ${-pad} ${24 + 2 * pad} ${24 + 2 * pad}`}
      style={[styles.heart, style]}
      pointerEvents="none"
    >
      <Path d={HEART_PATH} fill={color} stroke={color} strokeWidth={2 * pad} strokeLinejoin="round" />
      <Path d={HEART_PATH} fill={colors.status.danger} />
    </Svg>
  );
}

// The photos found on this device since launch, by uri: an avatar shown again (a row scrolled back,
// the same contact in a row and a stack) skips the file check.
const foundUris = new Set<string>();
const MAX_FOUND_URIS = 2000;

function rememberFound(uri: string) {
  const oldest = foundUris.values().next();
  if (foundUris.size >= MAX_FOUND_URIS && !oldest.done) foundUris.delete(oldest.value);
  foundUris.add(uri);
}

// Whether the photo at `uri` is on the device, remembered once it is.
function isFoundOnDevice(filename: string, uri: string, library: Pick<LibraryPaths, 'avatarsDir'>): boolean {
  if (!hasAvatar(filename, library)) return false;
  rememberFound(uri);
  return true;
}

// The uri of the contact's photo once it is on the device: one not on it yet is fetched
// through the loader while signed in; null until then, and for a contact without a photo (or with a
// name that isn't a file name, isFileName).
function useAvatarUri(contact: Partial<Pick<ContactRecord, 'avatarFilename'>>): string | null {
  const filename = contact.avatarFilename && isFileName(contact.avatarFilename) ? contact.avatarFilename : null;
  const [shown, setShown] = useState<string | null>(null); // the filename found on the device
  const { paths: library } = useOpenLibrary();
  const { isAuthenticated } = useCloud();
  const { loadAvatar } = useAssetThumbnailLoader();
  const uri = filename ? getAvatarUri(filename, library) : null;
  // A photo already on the device shows in the first frame, not a moment after its initials: the file
  // check is synchronous, and a photo found once skips it.
  const isShown =
    !!filename && !!uri && (shown === filename || foundUris.has(uri) || isFoundOnDevice(filename, uri, library));

  useEffect(() => {
    if (!filename || isShown || !isAuthenticated) return undefined;
    return loadAvatar({ avatarFilename: filename }, (result) => {
      if (result !== 'done') return;
      rememberFound(getAvatarUri(filename, library));
      setShown(filename);
    });
  }, [filename, isAuthenticated, isShown, library, loadAvatar]);

  return isShown ? uri : null;
}

// The first letters of the name's first two words ("Maya Lindqvist" → "ML").
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => ([...word][0] ?? '').toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The soft circle is drawn cut, in CutFace.
  cut: {
    backgroundColor: 'transparent',
  },
  stacked: {
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  initials: {
    color: colors.accent.base,
    fontWeight: '600',
  },
  heart: {
    position: 'absolute',
  },
});
