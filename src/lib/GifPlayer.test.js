import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import GifPlayer from './GifPlayer.svelte';

describe('GifPlayer Component', () => {
  it('should render video element with correct attributes for GIF playback', () => {
    const { container } = render(GifPlayer, {
      props: {
        playlist: 'https://example.com/video.m3u8',
        poster: 'https://example.com/poster.jpg',
        alt: 'Test GIF',
      },
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video.hasAttribute('autoplay')).toBe(true);
    // muted might be set as a property, not attribute in some browsers
    expect(video.muted || video.hasAttribute('muted')).toBe(true);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
  });

  it('should apply poster attribute when provided', () => {
    const { container } = render(GifPlayer, {
      props: {
        playlist: 'https://example.com/video.m3u8',
        poster: 'https://example.com/poster.jpg',
      },
    });

    const video = container.querySelector('video');
    expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg');
  });

  it('should have proper styling classes', () => {
    const { container } = render(GifPlayer, {
      props: {
        playlist: 'https://example.com/video.m3u8',
      },
    });

    const video = container.querySelector('video');
    expect(video.getAttribute('class')).toContain('rounded-lg');
    expect(video.getAttribute('class')).toContain('border');
  });
});
