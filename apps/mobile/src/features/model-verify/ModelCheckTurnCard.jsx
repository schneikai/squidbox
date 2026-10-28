import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import Card from '@/components/Card';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * One turn of a check: the change to the post before it, what was asked (the creator's message, or the
 * photo), how long the model took, its reply with the post options numbered (writing) or the tags
 * (vision), then each check passed or failed, the judge's reason under its badge.
 */
export default function ModelCheckTurnCard({ kind, turn }) {
  return (
    <Card style={styles.card}>
      {turn.note && <Text style={styles.note}>The editor changed the post: {turn.note}</Text>}
      <View style={styles.quote}>
        <Text style={styles.prompt} selectable>
          {turn.prompt}
        </Text>
      </View>
      {turn.error ? (
        <Text style={styles.error}>{turn.error}</Text>
      ) : (
        <>
          <Text style={styles.note}>
            {turn.seconds?.toFixed(1)} s{turn.unreadable ? ', not the JSON: kept as text' : ''}
          </Text>
          {turn.reply !== null && (
            <Text style={styles.reply} selectable>
              {turn.reply || '(no reply text)'}
            </Text>
          )}
          {kind === 'vision' ? (
            <ChipRow>
              {turn.items.map((item) => (
                <Chip key={item} label={item} />
              ))}
            </ChipRow>
          ) : (
            turn.items.map((item, index) => (
              <Text key={index} style={styles.reply} selectable>
                {index + 1}. {item}
              </Text>
            ))
          )}
        </>
      )}
      <View style={styles.checks}>
        {turn.checks.map((check, index) => (
          <View key={index} style={styles.check}>
            <Badge label={`${check.ok ? 'Pass' : 'Fail'} ${check.name}`} tone={check.ok ? 'success' : 'danger'} />
            {check.reason && <Text style={styles.note}>{check.reason}</Text>}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
  },
  note: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.text.secondary,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.border,
    paddingLeft: 10,
  },
  prompt: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.secondary,
  },
  reply: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  error: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.status.danger,
  },
  checks: {
    gap: 6,
  },
  check: {
    gap: 2,
  },
});
