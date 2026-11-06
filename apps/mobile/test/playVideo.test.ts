import { describe, it, expect, vi } from 'vitest';

import playVideo from '../src/features/asset-detail/playVideo';

const fakePlayer = ({ duration, currentTime }: { duration: number; currentTime: number }) => ({
  duration,
  currentTime,
  replay: vi.fn(),
  play: vi.fn(),
});

describe('playVideo', () => {
  it('plays a paused video from where it is', () => {
    const player = fakePlayer({ duration: 10, currentTime: 3 });
    playVideo(player);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.replay).not.toHaveBeenCalled();
  });

  it('starts a video over that has reached its end', () => {
    const ended = fakePlayer({ duration: 10, currentTime: 9.95 });
    playVideo(ended);
    expect(ended.replay).toHaveBeenCalledTimes(1);
    expect(ended.play).not.toHaveBeenCalled();
    // A length not known yet is never an end.
    const unknown = fakePlayer({ duration: 0, currentTime: 0 });
    playVideo(unknown);
    expect(unknown.play).toHaveBeenCalledTimes(1);
  });
});
