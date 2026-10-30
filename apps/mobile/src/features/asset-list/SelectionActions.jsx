import Button from '@/components/Button';

// The buttons of select mode, for a floating pill: select all, download, add to album, post, delete
// (when `onDelete` is given) and close. `actions` comes from useAssetSelectionActions.
export default function SelectionActions({ actions, onDelete, onClose }) {
  const disabled = !actions.hasSelection;
  return (
    <>
      <Button
        icon="checkbox"
        onPress={actions.toggleSelectAll}
        isSelected={actions.allSelected}
        accessibilityLabel="Select all"
      />
      <Button icon="download" onPress={actions.downloadSelected} disabled={disabled} accessibilityLabel="Download" />
      <Button
        icon="library"
        onPress={actions.addSelectedToAlbum}
        disabled={disabled}
        accessibilityLabel="Add to album"
      />
      <Button icon="share" onPress={actions.postSelected} disabled={disabled} accessibilityLabel="Post" />
      {onDelete && (
        <Button icon="trash" onPress={onDelete} disabled={disabled} colorPalette="danger" accessibilityLabel="Delete" />
      )}
      <Button variant="primary" icon="close" onPress={onClose} accessibilityLabel="Done" />
    </>
  );
}
