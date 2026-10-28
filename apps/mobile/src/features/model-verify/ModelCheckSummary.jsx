import secondsText from './secondsText';

import { Row, Section } from '@/components/settings-list/SettingsList';
import relativeTime from '@/utils/relativeTime';

/** A check's totals, as the CLI's table has them: passes, misses, unreadable replies, speed, when. */
export default function ModelCheckSummary({ kind, check }) {
  const { passes, fails, unreadable, medianSeconds, slowestSeconds } = check.result;
  return (
    <Section>
      <Row label="Passed" value={String(passes)} />
      <Row label="Failed" value={String(fails)} />
      {kind === 'writing' && <Row label="Not JSON" value={String(unreadable)} />}
      <Row label="Median per turn" value={secondsText(medianSeconds)} />
      <Row label="Slowest turn" value={secondsText(slowestSeconds)} />
      <Row label="Checked" value={relativeTime(Date.parse(check.startedAt))} />
    </Section>
  );
}
