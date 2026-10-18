import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import GifPlayer from './GifPlayer.svelte';
import VideoPlayer from './VideoPlayer.svelte';

const hlsMock = vi.hoisted(() => ({
  isSupported: vi.fn(),
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('hls.js', () => ({
  default: class {
    static isSupported() {
      return hlsMock.isSupported();
    }

    constructor() {
      return hlsMock;
    }
  },
}));

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['VideoPlayer', VideoPlayer],
    ['GifPlayer', GifPlayer],
  ])('%s uses HLS.js when supported even if canPlayType reports native support', (_name, Player) => {
    hlsMock.isSupported.mockReturnValue(true);
    const canPlayType = vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');

    const playlist = 'https://example.com/video.m3u8';
    const { container } = render(Player, { props: { playlist } });
    const video = container.querySelector('video');

    expect(hlsMock.loadSource).toHaveBeenCalledWith(playlist);
    expect(hlsMock.attachMedia).toHaveBeenCalledWith(video);
    expect(canPlayType).not.toHaveBeenCalled();
    expect(video.src).not.toBe(playlist);
  });

  it.each([
    ['VideoPlayer', VideoPlayer],
    ['GifPlayer', GifPlayer],
  ])('%s uses native HLS when HLS.js is unsupported', (_name, Player) => {
    hlsMock.isSupported.mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');

    const playlist = 'https://example.com/video.m3u8';
    const { container } = render(Player, { props: { playlist } });
    const video = container.querySelector('video');

    expect(video.src).toBe(playlist);
  });
});
