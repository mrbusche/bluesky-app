import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ImageGrid from './ImageGrid.svelte';

describe('ImageGrid Component', () => {
  it('should render nothing when images array is empty', () => {
    const { container } = render(ImageGrid, { props: { images: [] } });
    expect(container.querySelector('.grid')).toBeNull();
  });

  it('should render images when provided', () => {
    const images = [
      { thumb: 'thumb1.jpg', fullsize: 'full1.jpg', alt: 'Image 1' },
      { thumb: 'thumb2.jpg', fullsize: 'full2.jpg', alt: 'Image 2' },
    ];
    const { container } = render(ImageGrid, { props: { images } });
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    const imgs = container.querySelectorAll('img, a');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('should render plain images when link is false', () => {
    const images = [{ thumb: 'thumb1.jpg', fullsize: 'full1.jpg', alt: 'Image 1' }];
    const { container } = render(ImageGrid, { props: { images, link: false } });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('thumb1.jpg');
    expect(img.getAttribute('alt')).toBe('Image 1');
  });

  it('should use thumb as fallback if fullsize is not provided', () => {
    const images = [{ thumb: 'thumb1.jpg', alt: 'Image 1' }];
    const { container } = render(ImageGrid, { props: { images, link: false } });
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe('thumb1.jpg');
  });

  it('should use fullsize as fallback if thumb is not provided', () => {
    const images = [{ fullsize: 'full1.jpg', alt: 'Image 1' }];
    const { container } = render(ImageGrid, { props: { images, link: false } });
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe('full1.jpg');
  });

  it('should apply custom className', () => {
    const images = [{ thumb: 'thumb1.jpg', alt: 'Image 1' }];
    const { container } = render(ImageGrid, { props: { images, className: 'custom-class' } });
    const grid = container.querySelector('.grid');
    expect(grid.getAttribute('class')).toContain('custom-class');
  });

  it('should use default alt text if not provided', () => {
    const images = [{ thumb: 'thumb1.jpg' }];
    const { container } = render(ImageGrid, { props: { images, link: false } });
    const img = container.querySelector('img');
    expect(img.getAttribute('alt')).toBe('Embedded image');
  });
});
