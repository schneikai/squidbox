import { describe, it, expect, vi, beforeEach } from 'vitest';

type Button = { text: string; onPress?: () => void };
const alert = vi.fn<(title: string, message: string, buttons: Button[]) => void>();
vi.mock('react-native', () => ({ Alert: { alert: (...args: [string, string, Button[]]) => alert(...args) } }));

const { default: confirmSignOutAsync } = await import('../src/features/cloud/confirmBackupSignOutAsync');

describe('confirmBackupSignOutAsync (Settings)', () => {
  beforeEach(() => alert.mockReset());

  it('signs out without asking when everything is synced', async () => {
    await expect(confirmSignOutAsync({ pendingCount: 0, unsyncedCount: 0, syncErrorCount: 0 })).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks once when something has not synced, and answers what the user chose', async () => {
    const pressed = (text: string) => alert.mock.calls.at(-1)![2].find((button) => button.text === text)!.onPress!();

    const cancelled = confirmSignOutAsync({ pendingCount: 2, unsyncedCount: 0, syncErrorCount: 0 });
    expect(alert).toHaveBeenCalledWith(
      "You have media that isn't backed up yet",
      'It will upload the next time you sign in.',
      expect.any(Array),
      expect.any(Object),
    );
    pressed('Cancel');
    await expect(cancelled).resolves.toBe(false);

    const confirmed = confirmSignOutAsync({ pendingCount: 0, unsyncedCount: 3, syncErrorCount: 0 });
    pressed('Sign Out');
    await expect(confirmed).resolves.toBe(true);

    const failed = confirmSignOutAsync({ pendingCount: 0, unsyncedCount: 0, syncErrorCount: 1 });
    pressed('Sign Out');
    await expect(failed).resolves.toBe(true);
    expect(alert).toHaveBeenCalledTimes(3);
  });
});
