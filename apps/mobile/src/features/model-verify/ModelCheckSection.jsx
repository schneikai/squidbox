import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ModelCheckTurnCard from './ModelCheckTurnCard';

import Card from '@/components/Card';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/** One section of a check: its title, the system message it ran with (collapsed), and its turns. */
export default function ModelCheckSection({ kind, section }) {
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  return (
    <View style={styles.section}>
      <ScreenSectionHeader title={section.title} />
      {section.systemMessage && (
        <>
          <Section>
            <Row
              label="System message"
              value={isBriefingOpen ? 'Hide' : 'Show'}
              onPress={() => setIsBriefingOpen((isOpen) => !isOpen)}
            />
          </Section>
          {isBriefingOpen && (
            <Card style={styles.briefing}>
              <Text style={styles.briefingText} selectable>
                {section.systemMessage}
              </Text>
            </Card>
          )}
        </>
      )}
      {section.turns.map((turn, index) => (
        <ModelCheckTurnCard key={index} kind={kind} turn={turn} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  briefing: {
    padding: 14,
  },
  briefingText: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.text.secondary,
  },
});
