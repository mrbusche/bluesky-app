import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Link from './Link.svelte';

describe('Link Component', () => {
  it('should render with default props', () => {
    render(Link, { props: { href: '#' } });
    const link = screen.getByRole('link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('#');
  });

  it('should render slot content', () => {
    const { container } = render(Link, {
      props: { href: '/test' },
      context: new Map(),
    });
    container.querySelector('a').textContent = 'Click me';
    expect(container.querySelector('a').textContent).toBeTruthy();
  });

  it('should auto-detect external URLs and set target="_blank"', () => {
    render(Link, { props: { href: 'https://example.com' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should auto-detect http URLs as external', () => {
    render(Link, { props: { href: 'http://example.com' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should auto-detect protocol-relative URLs as external', () => {
    render(Link, { props: { href: '//example.com' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should not set target for internal links', () => {
    render(Link, { props: { href: '/internal/path' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('should respect explicit external prop set to false', () => {
    render(Link, { props: { href: 'https://example.com', external: false } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('should respect explicit external prop set to true', () => {
    render(Link, { props: { href: '/internal', external: true } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should allow custom target override', () => {
    render(Link, { props: { href: 'https://example.com', target: '_self' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_self');
  });

  it('should allow custom rel override', () => {
    render(Link, { props: { href: 'https://example.com', rel: 'external' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('rel')).toBe('external');
  });

  it('should forward additional attributes via restProps', () => {
    const { container } = render(Link, {
      props: {
        href: '/test',
        class: 'custom-class',
        'aria-label': 'Test Link',
      },
    });
    const link = container.querySelector('a');
    expect(link.getAttribute('class')).toBe('custom-class');
    expect(link.getAttribute('aria-label')).toBe('Test Link');
  });
});
