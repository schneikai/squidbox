import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import TagChips from './TagChips';
import VerifyStatusIcon from './VerifyStatusIcon';
import missReason from './missReason';
import turnStatus from './turnStatus';

import CoverImage from '@/components/CoverImage';
import ErrorText from '@/components/ErrorText';
import IntroText from '@/components/IntroText';
import { SCREEN_PADDING } from '@/constants';

const THUMBNAIL = 56;

// Memoized: a poll that brings a new photo's tags renders only its row.
export default memo(VerifyPhotoRow);

/**
 * One photo of a vision Verify: whether it passed (a spinner while it's being tagged, a clock before),
 * the photo (`uri`, a data URL, over a placeholder until it's in), and its tags or why it got none.
 */
function VerifyPhotoRow({ uri, turn, isRunning }) {
  const status = turnStatus(turn, isRunning);

  return (
    <View style={styles.row}>
      <VerifyStatusIcon status={status} />
      <CoverImage uri={uri ?? undefined} style={styles.thumbnail} />
      <View style={styles.tags}>
        {!turn && <IntroText>{isRunning ? 'Tagging…' : 'Waiting'}</IntroText>}
        {turn?.items.length > 0 && <TagChips tags={turn.items} />}
        {status === 'missed' && <ErrorText>Missed: {missReason(turn)}</ErrorText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  thumbnail: {
    width: THUMBNAIL,
    height: THUMBNAIL,
  },
  tags: {
    flex: 1,
    gap: 6,
  },
});
