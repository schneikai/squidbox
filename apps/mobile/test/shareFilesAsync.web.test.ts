import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import shareFilesAsync from '../src/utils/files/shareFilesAsync.web';

const FILES = [
  { uri: 'https://files.example/a', filename: 'IMG_0001.JPG' },
  { uri: 'https://files.example/b', filename: 'trail.mp4' },
];

let clicked: string[];
let share: ReturnType<typeof vi.fn>;

function stubBrowser({ canShare, status = 200 }: { canShare?: boolean; status?: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('bytes', { status })),
  );
  vi.stubGlobal('navigator', {
    canShare: canShare === undefined ? undefined : () => canShare,
    share,
  });
  vi.stubGlobal('document', {
    createElement: () => ({
      click(this: { download: string }) {
        clicked.push(this.download);
      },
    }),
  });
}

describe('shareFilesAsync (web)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clicked = [];
    share = vi.fn(async () => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares every file in one navigator.share call, named after the asset and typed by extension', async () => {
    stubBrowser({ canShare: true });
    await shareFilesAsync(FILES);
    expect(share).toHaveBeenCalledTimes(1);
    const { files } = share.mock.calls[0][0] as { files: File[] };
    expect(files.map((file) => [file.name, file.type])).toEqual([
      ['IMG_0001.JPG', 'image/jpeg'],
      ['trail.mp4', 'video/mp4'],
    ]);
    expect(clicked).toEqual([]);
  });

  it.each([
    ['false', false],
    ['absent', undefined],
  ])("downloads each file when the browser can't share them (canShare %s)", async (_label, canShare) => {
    stubBrowser({ canShare });
    await shareFilesAsync(FILES);
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toEqual(['IMG_0001.JPG', 'trail.mp4']);
  });

  it("downloads each file when the tap's activation ran out (NotAllowedError)", async () => {
    share.mockRejectedValue(new DOMException('No activation', 'NotAllowedError'));
    stubBrowser({ canShare: true });
    await shareFilesAsync(FILES);
    expect(clicked).toEqual(['IMG_0001.JPG', 'trail.mp4']);
  });

  it('closing the share sheet (AbortError) is not an error', async () => {
    share.mockRejectedValue(new DOMException('Share canceled', 'AbortError'));
    stubBrowser({ canShare: true });
    await expect(shareFilesAsync(FILES)).resolves.toBeUndefined();
    expect(clicked).toEqual([]);
  });

  it("a file that can't be fetched (HTTP error) rejects and shares nothing", async () => {
    stubBrowser({ canShare: true, status: 403 });
    await expect(shareFilesAsync(FILES)).rejects.toThrow('Fetching IMG_0001.JPG failed (HTTP 403)');
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toEqual([]);
  });
});
