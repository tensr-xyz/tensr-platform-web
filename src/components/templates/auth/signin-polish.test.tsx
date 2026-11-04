import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { ProviderLogo } from './provider-logos';
import { SigningInFallback } from '@/components/molecules/signing-in';
import {
  SIGNING_IN_KEY,
  clearSigningIn,
  isAuthReturn,
  isSigningIn,
  markSigningIn,
} from '@/lib/signing-in';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('sign-in polish', () => {
  test('1: each provider button carries its brand mark, not a letter', () => {
    const { container } = render(
      <>
        <ProviderLogo provider="google" />
        <ProviderLogo provider="microsoft" />
        <ProviderLogo provider="github" />
      </>
    );
    const google = container.querySelector('[data-provider="google"]')!;
    expect([...google.querySelectorAll('path')].map(node => node.getAttribute('fill'))).toEqual([
      '#EA4335',
      '#4285F4',
      '#FBBC05',
      '#34A853',
    ]);
    const microsoft = container.querySelector('[data-provider="microsoft"]')!;
    expect([...microsoft.querySelectorAll('rect')].map(node => node.getAttribute('fill'))).toEqual([
      '#F25022',
      '#7FBA00',
      '#00A4EF',
      '#FFB900',
    ]);
    expect(container.querySelector('[data-provider="github"] path')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  test('2: the form sits on the page background, at the same width and spacing', () => {
    const css = fs.readFileSync(path.join(__dirname, 'signin.css'), 'utf8');
    const card = css.match(/\.signin-card \{([^}]*)\}/)![1];
    expect(card).toMatch(/width: 520px/);
    expect(card).toMatch(/padding: 46px 40px 40px/);
    expect(card).toMatch(/background: transparent/);
    expect(css).not.toMatch(/--signin-card/);
  });

  test('3: an OAuth return or a paid checkout already counts as signed in', () => {
    expect(isAuthReturn(new URLSearchParams('stytch_token_type=oauth&token=t'))).toBe(true);
    expect(isAuthReturn(new URLSearchParams('checkout=success'))).toBe(true);
    expect(isAuthReturn(new URLSearchParams('stytch_token_type=oauth'))).toBe(false);
    expect(isAuthReturn(new URLSearchParams('invite=abc'))).toBe(false);
  });

  test('3: the flag carries "Signing you in…" across the route change, then clears', () => {
    const store = memoryStore();
    expect(isSigningIn(store, '', 1_000)).toBe(false);
    markSigningIn(store, 1_000);
    expect(store.getItem(SIGNING_IN_KEY)).toBe('1000');
    expect(isSigningIn(store, '', 5_000)).toBe(true);
    // A stale flag does not hold a later load.
    expect(isSigningIn(store, '', 1_000 + 61_000)).toBe(false);
    clearSigningIn(store);
    expect(isSigningIn(store, '', 5_000)).toBe(false);
    expect(isSigningIn(store, '?checkout=success', 5_000)).toBe(true);
  });

  test('3: /flow shows "Signing you in…" while it loads after a sign-in, and nothing otherwise', () => {
    window.sessionStorage.clear();
    const { container, unmount } = render(<SigningInFallback />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    markSigningIn();
    render(<SigningInFallback />);
    expect(screen.getByText('Signing you in…')).toBeInTheDocument();
    window.sessionStorage.clear();
  });
});
