import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = '3zane_theme';
let theme: Theme = (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
const listeners = new Set<() => void>();

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
}

// Apply immediately on module load
apply(theme);

function publish() {
  listeners.forEach((l) => l());
}

export function useTheme() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => theme
  );
}

export function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  apply(theme);
  publish();
}
