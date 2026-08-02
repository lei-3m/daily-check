import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentPreference =
  | 'indigo'
  | 'sky'
  | 'teal'
  | 'emerald'
  | 'rose'
  | 'violet'
  | 'amber';

export const THEME_STORAGE_KEY = 'daily-check:theme';
export const ACCENT_STORAGE_KEY = 'daily-check:accent';

export const ACCENT_OPTIONS: Array<{
  value: AccentPreference;
  label: string;
  swatch: string;
}> = [
  { value: 'indigo', label: '인디고', swatch: '#4f46e5' },
  { value: 'sky', label: '스카이', swatch: '#0284c7' },
  { value: 'teal', label: '틸', swatch: '#0f766e' },
  { value: 'emerald', label: '에메랄드', swatch: '#047857' },
  { value: 'rose', label: '로즈', swatch: '#be123c' },
  { value: 'violet', label: '바이올렛', swatch: '#7c3aed' },
  { value: 'amber', label: '앰버', swatch: '#b45309' },
];

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const isAccentPreference = (value: string | null): value is AccentPreference =>
  value === 'indigo' ||
  value === 'sky' ||
  value === 'teal' ||
  value === 'emerald' ||
  value === 'rose' ||
  value === 'violet' ||
  value === 'amber';

export const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
};

export const getStoredAccentPreference = (): AccentPreference => {
  if (typeof window === 'undefined') return 'indigo';
  const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return isAccentPreference(stored) ? stored : 'indigo';
};

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
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    applyAccentPreference(accentPreference);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentPreference);
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
