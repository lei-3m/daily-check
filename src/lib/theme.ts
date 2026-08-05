import { useEffect, useState } from 'react';
import type { AccentPreference, ThemePreference } from './types';
import {
  getStoredAccentPreference,
  getStoredThemePreference,
  setStoredAccentPreference,
  setStoredThemePreference,
} from './storage';

export type { AccentPreference, ThemePreference };
export { isAccentPreference } from './types';

export const ACCENT_OPTIONS: Array<{
  value: AccentPreference;
  label: string;
  swatch: string;
}> = [
  { value: 'default', label: '기본값', swatch: '#9B9B9B' },
  { value: 'blue', label: '블루', swatch: '#2C67C5' },
  { value: 'green', label: '그린', swatch: '#48A04C' },
  { value: 'yellow', label: '옐로', swatch: '#D9A337' },
  { value: 'pink', label: '핑크', swatch: '#F077AF' },
  { value: 'orange', label: '오렌지', swatch: '#D25E28' },
  { value: 'purple', label: '퍼플', swatch: '#7849D1' },
];

export { getStoredThemePreference, getStoredAccentPreference };

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const shouldUseDark = preference === 'dark' || (preference === 'system' && prefersDark());
  document.documentElement.classList.add('theme-switching');
  document.documentElement.classList.toggle('dark', shouldUseDark);
  document.documentElement.dataset.theme = preference;
  window.requestAnimationFrame(() => {
    document.documentElement.classList.remove('theme-switching');
  });
};

export const applyAccentPreference = (preference: AccentPreference) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.accent = preference;
};

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    getStoredThemePreference()
  );
  const [accentPreference, setAccentPreferenceState] = useState<AccentPreference>(() =>
    getStoredAccentPreference()
  );

  useEffect(() => {
    applyThemePreference(preference);
    setStoredThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    applyAccentPreference(accentPreference);
    setStoredAccentPreference(accentPreference);
  }, [accentPreference]);

  useEffect(() => {
    if (preference !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyThemePreference('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  return {
    themePreference: preference,
    setThemePreference: setPreferenceState,
    accentPreference,
    setAccentPreference: setAccentPreferenceState,
  };
}
