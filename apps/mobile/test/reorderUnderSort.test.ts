import { describe, it, expect, vi } from 'vitest';

import reorderUnderSort from '../src/components/sortable-grid/reorderUnderSort';

const change = { id: 'a', afterId: 'b', order: ['b', 'a'] };

describe('a drop on a screen with a sort', () => {
  it('moves under Custom without touching the sort', async () => {
    const setSortOrder = vi.fn();
    const move = vi.fn().mockResolvedValue(7);
    expect(await reorderUnderSort(change, { sortOrder: 'custom', setSortOrder, move })).toBe(7);
    expect(move).toHaveBeenCalledWith(change, 'custom');
    expect(setSortOrder).not.toHaveBeenCalled();
  });

  it('switches to Custom before writing the drop under the sort it was made on', async () => {
    const calls: string[] = [];
    const setSortOrder = vi.fn((order: string) => calls.push(`sort ${order}`));
    const move = vi.fn(async (_change: unknown, sort: string) => {
      calls.push(`move ${sort}`);
      return 7;
    });
    expect(await reorderUnderSort(change, { sortOrder: 'name:asc', setSortOrder, move })).toBe(7);
    expect(calls).toEqual(['sort custom', 'move name:asc']);
  });

  it('goes back to the sort when the write fails', async () => {
    const setSortOrder = vi.fn();
    const move = vi.fn().mockRejectedValue(new Error('gone'));
    await expect(reorderUnderSort(change, { sortOrder: 'name:asc', setSortOrder, move })).rejects.toThrow('gone');
    expect(setSortOrder.mock.calls).toEqual([['custom'], ['name:asc']]);
  });
});
