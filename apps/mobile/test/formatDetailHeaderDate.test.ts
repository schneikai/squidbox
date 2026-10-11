import { describe, it, expect, vi, afterEach } from 'vitest';

import formatDetailHeaderDate from '../src/utils/date-time/formatDetailHeaderDate';

const NOW = new Date(2026, 9, 11, 15, 0); // Sun 11 Oct 2026, 15:00 local time

describe('formatDetailHeaderDate', () => {
  afterEach(() => vi.useRealTimers());

  function at(date: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return formatDetailHeaderDate(date.getTime());
  }

  it('puts the day on the first line and the time on the second', () => {
    expect(at(new Date(2026, 9, 11, 9, 55))).toEqual({ title: 'Today', subtitle: '9:55 AM' });
  });

  it('names nearby days', () => {
    expect(at(new Date(2026, 9, 10, 21, 55)).title).toBe('Yesterday');
    expect(at(new Date(2026, 9, 12, 8, 0)).title).toBe('Tomorrow');
    expect(at(new Date(2026, 9, 8, 21, 55)).title).toBe('Thursday');
  });

  it('shows the full date further away', () => {
    expect(at(new Date(2026, 6, 1, 12, 0))).toEqual({ title: '01. Jul 2026', subtitle: '12:00 PM' });
  });
});
