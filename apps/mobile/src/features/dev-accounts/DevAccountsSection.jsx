import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import Icon from '@/components/Icon';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useCloud from '@/features/cloud/useCloud';
import { colors, sizes } from '@/styles/designTokens';

// The local backend's accounts, which `npm run dev:local` passes in: the mock library and the copy of
// the owner's own library (`npm run copy:my-library`). Unset in every other bundle.
const DEV_ACCOUNTS = process.env.EXPO_PUBLIC_DEV_ACCOUNTS ? JSON.parse(process.env.EXPO_PUBLIC_DEV_ACCOUNTS) : [];

// One tap signs in as a local account, also while another one is signed in: its library opens and the
// other one is parked, like any sign-in as someone else.
export default function DevAccountsSection() {
  const { isAuthenticated, user, loginAsync } = useCloud();
  const [pendingEmail, setPendingEmail] = useState(null);

  async function handleSignIn(account) {
    setPendingEmail(account.email);
    try {
      await loginAsync(account.email, account.password);
    } catch (error) {
      Alert.alert("Couldn't sign in", error.message);
    } finally {
      setPendingEmail(null);
    }
  }

  if (DEV_ACCOUNTS.length === 0) return null;

  return (
    <>
      <ScreenSectionHeader title="Dev accounts" />
      <Section>
        {DEV_ACCOUNTS.map((account) => {
          const isCurrent = isAuthenticated && user?.email === account.email;
          const isPending = pendingEmail === account.email;
          return (
            <Row
              key={account.email}
              label={account.label}
              description={account.email}
              onPress={isCurrent || pendingEmail ? undefined : () => handleSignIn(account)}
            >
              {isPending && <ActivityIndicator size="small" />}
              {isCurrent && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
            </Row>
          );
        })}
      </Section>
      <SectionFooter>
        Local backend only. The copy of your library shows your live photos, read-only: what you add there doesn't back
        up, and deleting there never touches your live library.
      </SectionFooter>
    </>
  );
}
