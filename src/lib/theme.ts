import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'daily-check:theme';

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
};

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const shouldUseDark = preference === 'dark' || (preference === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', shouldUseDark);
  document.documentElement.dataset.theme = preference;
};

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    getStoredThemePreference()
  );

  useEffect(() => {
    applyThemePreference(preference);
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }, [preference]);

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
  };
}
