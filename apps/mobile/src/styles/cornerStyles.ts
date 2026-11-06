import { StyleSheet } from 'react-native';

import { layout } from '@/styles/designTokens';

// A badge or a small control in a corner of a tile or a grid cell, `layout.badgeInset` from its
// edges (ThumbnailBadge's `corner`, a cell's marks and buttons); `bottomRightSmall` on a small
// thumbnail, `layout.badgeInsetSmall` from them.
export default StyleSheet.create({
  topLeft: { position: 'absolute', top: layout.badgeInset, left: layout.badgeInset },
  topRight: { position: 'absolute', top: layout.badgeInset, right: layout.badgeInset },
  bottomRight: { position: 'absolute', bottom: layout.badgeInset, right: layout.badgeInset },
  bottomRightSmall: { position: 'absolute', bottom: layout.badgeInsetSmall, right: layout.badgeInsetSmall },
});
