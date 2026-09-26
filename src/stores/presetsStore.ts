import { useSyncExternalStore } from 'react';

export interface ConversionPreset {
  id: string;
  name: string;
  format: string;
  speed: number;
  amplify: number;
  normalize: boolean;
  removeSilence: boolean;
}

const PRESETS_KEY = '3zane_presets_v1';

const DEFAULT_PRESETS: ConversionPreset[] = [
  { id: 'roblox', name: 'Roblox Optimized', format: 'mp3', speed: 1.0, amplify: 0, normalize: true, removeSilence: false },
  { id: 'podcast', name: 'Podcast Quality', format: 'mp3', speed: 1.0, amplify: 2, normalize: true, removeSilence: true },
  { id: 'lossless', name: 'Lossless Archive', format: 'flac', speed: 1.0, amplify: 0, normalize: false, removeSilence: false },
];

function read(): ConversionPreset[] {
  try {
    const stored = JSON.parse(localStorage.getItem(PRESETS_KEY) || 'null');
    if (Array.isArray(stored) && stored.length > 0) {
      // Validate each preset has required fields with sensible values
      const valid = stored.filter((p) =>
        p && typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.format === 'string' &&
        typeof p.speed === 'number' && p.speed >= 0.5 && p.speed <= 3.0 &&
        typeof p.amplify === 'number' && p.amplify >= -20 && p.amplify <= 10
      );
      if (valid.length > 0) return valid;
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS;
}

let presets: ConversionPreset[] = read();
const listeners = new Set<() => void>();

function publish() {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  listeners.forEach((l) => l());
}

export function usePresets() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => presets
  );
}

export function addPreset(preset: Omit<ConversionPreset, 'id'>) {
  presets = [{ ...preset, id: crypto.randomUUID() }, ...presets].slice(0, 20);
  publish();
}

export function removePreset(id: string) {
  presets = presets.filter((p) => p.id !== id);
  publish();
}
