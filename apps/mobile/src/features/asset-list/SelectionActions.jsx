import { StyleSheet, View } from 'react-native';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

// The buttons of select mode, for a floating pill: select all, download, add to album, post, delete
// (when `onDelete` is given) and close. `actions` comes from useAssetSelectionActions.
export default function SelectionActions({ actions, onDelete, onClose }) {
  const disabled = !actions.hasSelection;
  return (
    <>
      <IconButton
        icon="checkbox"
        onPress={actions.toggleSelectAll}
        color={actions.allSelected ? colors.accent : colors.text}
      />
      <IconButton icon="download" onPress={actions.downloadSelected} disabled={disabled} />
      <IconButton icon="library" onPress={actions.addSelectedToAlbum} disabled={disabled} />
      <IconButton icon="share" onPress={actions.postSelected} disabled={disabled} />
      {onDelete && <IconButton icon="trash" onPress={onDelete} disabled={disabled} color={colors.danger} />}
      <View style={actionButtonStyles.pillSeparator} />
      <GradientButton onPress={onClose} style={styles.closeButton}>
        <Icon name="close" color={colors.textInverse} />
      </GradientButton>
    </>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    marginLeft: 2,
  },
});
