import { memo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import countPassed from './countPassed';
import missReason from './missReason';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import Icon from '@/components/Icon';
import IntroText from '@/components/IntroText';
import { SCREEN_PADDING } from '@/constants';
import { colors, lineHeights, radii, sizes, typography } from '@/styles/designTokens';

const THUMBNAIL = 56;

// Memoized: a poll that brings a new photo's tags renders only its row.
export default memo(VerifyPhotoRow);

/**
 * One photo of a vision Verify: whether it passed (a spinner while it's being tagged, a clock before),
 * the photo (`uri`, a data URL, over a placeholder until it's in), and its tags or why it got none.
 */
function VerifyPhotoRow({ uri, turn, isRunning }) {
  const isPassed = turn && countPassed([turn]) === 1;
  const reason = turn && missReason(turn);

  function renderIcon() {
    if (!turn && isRunning) return <ActivityIndicator color={colors.text.secondary} />;
    if (!turn) return <Icon name="clock" size={sizes.icon} color={colors.text.tertiary} />;
    return (
      <Icon
        name={isPassed ? 'check-circle' : 'close-circle'}
        size={sizes.icon}
        color={isPassed ? colors.status.success : colors.status.danger}
      />
    );
  }

  return (
    <View style={styles.row}>
      {renderIcon()}
      <View style={styles.thumbnail}>{uri && <Image source={{ uri }} style={styles.image} />}</View>
      <View style={styles.tags}>
        {!turn && <IntroText>{isRunning ? 'Tagging…' : 'Waiting'}</IntroText>}
        {turn?.items.length > 0 && (
          <ChipRow>
            {turn.items.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </ChipRow>
        )}
        {turn && !isPassed && <Text style={styles.error}>Missed: {reason}</Text>}
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
    borderRadius: radii.cover,
    overflow: 'hidden',
    backgroundColor: colors.background.placeholder,
  },
  image: {
    width: THUMBNAIL,
    height: THUMBNAIL,
  },
  tags: {
    flex: 1,
    gap: 6,
  },
  error: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.status.danger,
  },
});
