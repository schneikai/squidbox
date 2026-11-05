import { describe, expect, it } from 'vitest';

import featureSwitchRows from '../src/features/account-features/featureSwitchRows';

function states(rows: ReturnType<typeof featureSwitchRows>) {
  return Object.fromEntries(rows.map((row) => [row.feature, { isOn: row.isOn, isDisabled: row.isDisabled }]));
}

describe('featureSwitchRows', () => {
  it("shows each switch as the account's features have it", () => {
    const rows = states(featureSwitchRows(['ai', 'developer'], null));
    expect(rows.ai.isOn).toBe(true);
    expect(rows.ai_admin.isOn).toBe(false);
  });

  it('shows the switch on its way to the server as it will be', () => {
    expect(states(featureSwitchRows([], { feature: 'ai', isOn: true })).ai.isOn).toBe(true);
    expect(states(featureSwitchRows(['ai'], { feature: 'ai', isOn: false })).ai.isOn).toBe(false);
  });

  it('waits for a change in flight before another', () => {
    const rows = featureSwitchRows(['ai', 'ai_admin'], { feature: 'ai_admin', isOn: false });
    expect(rows.every((row) => row.isDisabled)).toBe(true);
  });

  it('greys AI admin out while Assistant is off', () => {
    expect(states(featureSwitchRows([], null)).ai_admin.isDisabled).toBe(true);
    expect(states(featureSwitchRows(['ai_admin'], null)).ai_admin).toEqual({ isOn: true, isDisabled: true });
    expect(states(featureSwitchRows(['ai'], null)).ai_admin.isDisabled).toBe(false);
  });
});
