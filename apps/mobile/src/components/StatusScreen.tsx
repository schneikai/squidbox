import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import Page from '@/components/Page';
import StatusTitle from '@/components/StatusTitle';
import Octopus from '@/components/octopus/Octopus';
import { scale, space } from '@/styles/designTokens';

const OCTOPUS_SIZE = scale(150);

export type StatusScreenProps = { busy?: boolean; title: string; children?: ReactNode };

// A full-screen status while the app can't show its content: a title (StatusTitle), centred on the
// app background, the octopus above it while `busy`, and whatever details the caller adds below it.
export default function StatusScreen({ busy = false, title, children = null }: StatusScreenProps) {
  return (
    <Page>
      <View style={styles.center}>
        {busy && <Octopus size={OCTOPUS_SIZE} />}
        <View style={styles.title}>
          <StatusTitle title={title} busy={busy} />
        </View>
        {children}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxxl, gap: space.md },
  title: { marginTop: space.lg },
});
