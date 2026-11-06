import type { VerifyTurn } from '@squidbox/shared';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import TagChips from './TagChips';
import VerifyStatusIcon from './VerifyStatusIcon';
import missReason from './missReason';
import turnStatus from './turnStatus';

import CoverImage from '@/components/CoverImage';
import IntroText from '@/components/IntroText';
import Text from '@/components/Text';
import { Row } from '@/components/settings-list/SettingsList';
import { scale, space } from '@/styles/designTokens';

const THUMBNAIL = scale(56);

// Memoized: a poll that brings a new photo's tags renders only its row.
export default memo(VerifyPhotoRow);

export type VerifyPhotoRowProps = { uri: string | null; turn: VerifyTurn | null; isRunning: boolean };

/**
 * One photo of a vision Verify: whether it passed (a spinner while it's being tagged, a clock before),
 * the photo (`uri`, a data URL, over a placeholder until it's in), and its tags or why it got none.
 */
function VerifyPhotoRow({ uri, turn, isRunning }: VerifyPhotoRowProps) {
  const status = turnStatus(turn, isRunning);

  return (
    <Row
      leading={
        <>
          <VerifyStatusIcon status={status} />
          <CoverImage uri={uri ?? undefined} style={styles.thumbnail} />
        </>
      }
      label={
        <View style={styles.tags}>
          {!turn && <IntroText>{isRunning ? 'Tagging…' : 'Waiting'}</IntroText>}
          {!!turn && turn.items.length > 0 && <TagChips tags={turn.items} />}
          {!!turn && status === 'missed' && <Text variant="error">Missed: {missReason(turn)}</Text>}
        </View>
      }
      size="small"
    />
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: THUMBNAIL,
    height: THUMBNAIL,
  },
  tags: {
    gap: space.sm,
  },
});
