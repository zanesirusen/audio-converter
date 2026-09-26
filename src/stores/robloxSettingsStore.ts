import { useSyncExternalStore } from 'react';

export interface RobloxSettings {
  apiKey: string;
  creatorType: 'user' | 'group';
  creatorId: string;
  creatorName: string;      // display name after validation
  apiKeyValid: boolean;
  creatorValid: boolean;
  defaultAssetName: string; // optional default prefix for asset names
}

const KEY = '3zane_roblox_settings_v1';

const EMPTY: RobloxSettings = {
  apiKey: '',
  creatorType: 'user',
  creatorId: '',
  creatorName: '',
  apiKeyValid: false,
  creatorValid: false,
  defaultAssetName: '',
};

function read(): RobloxSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

let settings: RobloxSettings = read();
const listeners = new Set<() => void>();

function publish() {
  localStorage.setItem(KEY, JSON.stringify(settings));
  listeners.forEach((l) => l());
}

export function useRobloxSettings() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => settings
  );
}

export function saveRobloxSettings(patch: Partial<RobloxSettings>) {
  settings = { ...settings, ...patch };
  publish();
}

export function clearRobloxSettings() {
  settings = { ...EMPTY };
  publish();
}

/** Returns true if both API key and creator are validated and saved. */
export function isRobloxReady(): boolean {
  return settings.apiKeyValid && settings.creatorValid && !!settings.apiKey && !!settings.creatorId;
}
