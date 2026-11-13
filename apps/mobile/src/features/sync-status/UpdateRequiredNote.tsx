import type { StyleProp, ViewStyle } from 'react-native';

import Button from '@/components/Button';
import WarningNote from '@/components/WarningNote';
import useUpdateApp from '@/features/sync-status/useUpdateApp';
import useUpdateRequired from '@/hooks/useUpdateRequired';
import { UPDATE_REQUIRED_TEXT } from '@/utils/cloud-api/updateRequiredText';

type UpdateRequiredNoteProps = { style?: StyleProp<ViewStyle> };

/**
 * The update gate on a screen (docs/sync-design.md §15): the server refused this build as too old; the
 * note says so with an Update button. Nothing unless useUpdateRequired.
 */
export default function UpdateRequiredNote({ style }: UpdateRequiredNoteProps) {
  const updateRequired = useUpdateRequired();
  const { update, updating } = useUpdateApp();
  if (!updateRequired) return null;
  return (
    <WarningNote style={style} trailing={<Button label="Update" size="small" loading={updating} onPress={update} />}>
      {UPDATE_REQUIRED_TEXT}
    </WarningNote>
  );
}
