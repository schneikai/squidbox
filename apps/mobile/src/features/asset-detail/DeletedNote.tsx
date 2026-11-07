import { StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { colors, layout, radii, shadows, sizes, space } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

type DeletedNoteProps = {
  mediaType: AssetRow['mediaType'];
};

// The red note on a trashed photo or video (opened from a post it's still in), of `mediaType`,
// under the header.
export default function DeletedNote({ mediaType }: DeletedNoteProps) {
  return (
    <View style={[styles.note, shadows.floating]} accessibilityRole="text">
      <Icon name="trash" size={sizes.menuIcon} color={colors.text.inverse} />
      <Text variant="label" tone="inverse">
        This {humanizeMediaType(mediaType).toLowerCase()} was deleted
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    // A chip's height (chipFrame), with room for its text at the sides.
    minHeight: sizes.smallButton + space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.status.danger,
  },
});
