import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ExternalCard from './ExternalCard.svelte';

describe('ExternalCard Component', () => {
  it('should render card with title and uri', () => {
    render(ExternalCard, {
      props: { uri: 'https://example.com', title: 'Test Title' },
    });
    expect(screen.getByText('Test Title')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('should render description when provided', () => {
    render(ExternalCard, {
      props: {
        uri: 'https://example.com',
        title: 'Test Title',
        description: 'Test description',
      },
    });
    expect(screen.getByText('Test description')).toBeTruthy();
  });

  it('should not render description when not provided', () => {
    const { container } = render(ExternalCard, {
      props: { uri: 'https://example.com', title: 'Test Title' },
    });
    const descElements = container.querySelectorAll('.text-gray-400');
    expect(descElements.length).toBe(0);
  });

  it('should render thumbnail when provided', () => {
    const { container } = render(ExternalCard, {
      props: {
        uri: 'https://example.com',
        title: 'Test Title',
        thumb: 'https://example.com/thumb.jpg',
      },
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.jpg');
    expect(img.getAttribute('alt')).toBe('Test Title');
  });

  it('should not render thumbnail when not provided', () => {
    const { container } = render(ExternalCard, {
      props: { uri: 'https://example.com', title: 'Test Title' },
    });
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('should render as a link with correct href', () => {
    const { container } = render(ExternalCard, {
      props: { uri: 'https://example.com', title: 'Test Title' },
    });
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('should apply custom className', () => {
    const { container } = render(ExternalCard, {
      props: {
        uri: 'https://example.com',
        title: 'Test Title',
        className: 'custom-card-class',
      },
    });
    const link = container.querySelector('a');
    expect(link.getAttribute('class')).toContain('custom-card-class');
  });

  it('should have external link attributes', () => {
    const { container } = render(ExternalCard, {
      props: { uri: 'https://example.com', title: 'Test Title' },
    });
    const link = container.querySelector('a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
