import { AppState } from './types';

const STORAGE_KEY = 'daily-check:v1';

export async function loadState(): Promise<AppState | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed && typeof parsed === 'object' && parsed.days) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}
