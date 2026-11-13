import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetFileAsset } from '../src/utils/assets/files/getAssetFileStatusAsync';
import type { ShareFile } from '../src/utils/files/shareFilesAsync';

const alert = vi.fn();
vi.mock('react-native', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

type Use = (uri: string, asset: AssetFileAsset) => unknown;
const run = vi.fn<(assets: readonly AssetFileAsset[], use: Use) => Promise<boolean>>();
vi.mock('../src/utils/assets/files/useRunWithAssetFiles', () => ({ default: () => run }));

const shareFiles = vi.fn<(files: readonly ShareFile[]) => Promise<void>>();
vi.mock('../src/utils/files/shareFilesAsync', () => ({ default: shareFiles }));

const { default: useShareAssets } = await import('../src/utils/assets/useShareAssets');

function asset(filename: string) {
  return { filename } as AssetFileAsset;
}

// Runs `use` over every asset, as useRunWithAssetFiles does, and resolves `result`.
function runResolving(result: boolean) {
  run.mockImplementation(async (assets, use) => {
    for (const a of assets) await use(`file:///cache/${a.filename}`, a);
    return result;
  });
}

describe('useShareAssets', () => {
  beforeEach(() => {
    alert.mockReset();
    run.mockReset();
    shareFiles.mockReset();
    shareFiles.mockResolvedValue();
  });

  it('opens one share sheet with every collected file once the run finished', async () => {
    runResolving(true);
    await useShareAssets()([asset('a.jpg'), asset('b.mov')]);
    expect(shareFiles).toHaveBeenCalledTimes(1);
    expect(shareFiles).toHaveBeenCalledWith([
      { uri: 'file:///cache/a.jpg', filename: 'a.jpg' },
      { uri: 'file:///cache/b.mov', filename: 'b.mov' },
    ]);
  });

  it('opens nothing when the run was cancelled or failed', async () => {
    runResolving(false);
    await useShareAssets()([asset('a.jpg'), asset('b.mov')]);
    expect(shareFiles).not.toHaveBeenCalled();
  });

  it('an asset given twice is shared once', async () => {
    runResolving(true);
    await useShareAssets()([asset('a.jpg'), asset('b.mov'), asset('a.jpg')]);
    expect(run.mock.calls[0][0]).toEqual([asset('a.jpg'), asset('b.mov')]);
    expect(shareFiles.mock.calls[0][0].map((file) => file.filename)).toEqual(['a.jpg', 'b.mov']);
  });

  it('an empty list says there is nothing to share, and starts no run', async () => {
    await useShareAssets()([]);
    expect(alert).toHaveBeenCalledWith('Nothing to share', 'There are no photos or videos to share.');
    expect(run).not.toHaveBeenCalled();
    expect(shareFiles).not.toHaveBeenCalled();
  });

  it('a share that rejects alerts "Couldn\'t share"', async () => {
    runResolving(true);
    shareFiles.mockRejectedValue(new Error('No view controller to present the share sheet from'));
    await useShareAssets()([asset('a.jpg')]);
    expect(alert).toHaveBeenCalledWith("Couldn't share", 'No view controller to present the share sheet from');
  });
});
