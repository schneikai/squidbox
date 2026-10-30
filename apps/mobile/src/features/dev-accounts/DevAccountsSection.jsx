import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import copyLiveLibraryAsync from './copyLiveLibraryAsync';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useCloud from '@/features/cloud/useCloud';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The local backend's accounts, which `npm run dev:local` passes in: the mock library and the copy of
// the owner's live library (`isLiveLibraryCopy`), made the first time it opens. Unset in every other
// bundle.
const DEV_ACCOUNTS = process.env.EXPO_PUBLIC_DEV_ACCOUNTS ? JSON.parse(process.env.EXPO_PUBLIC_DEV_ACCOUNTS) : [];

// One tap signs in as a local account, also while another one is signed in: its library opens and the
// other one is parked, like any sign-in as someone else.
export default function DevAccountsSection() {
  const { isAuthenticated, user, loginAsync } = useCloud();
  const [pendingEmail, setPendingEmail] = useState(null);

  async function handleSignIn(account) {
    setPendingEmail(account.email);
    try {
      if (account.isLiveLibraryCopy) await copyLiveLibraryAsync(account);
      await loginAsync(account.email, account.password);
    } catch (error) {
      Alert.alert("Couldn't sign in", apiErrorMessage(error));
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
              description={isPending && account.isLiveLibraryCopy ? 'Copying your library…' : account.email}
              onPress={isCurrent || pendingEmail ? undefined : () => handleSignIn(account)}
              isSelected={isCurrent}
            >
              {isPending && <ActivityIndicator size="small" />}
            </Row>
          );
        })}
      </Section>
      <SectionFooter>
        Local backend only. The copy of your library is made from your live library the first time you open it, and
        shows your live photos, read-only: what you add there doesn't back up, and nothing you do there reaches your
        live library.
      </SectionFooter>
    </>
  );
}
