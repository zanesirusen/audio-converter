import { useSyncExternalStore } from 'react';

export interface HistoryItem {
  id: string;
  title: string;
  artist: string;
  platform: string;
  format: string;
  fileName: string;
  downloadUrl: string;
  createdAt: string;
}

const key = 'waveforge_history_v2';
let history: HistoryItem[] = read();
const listeners = new Set<() => void>();

function read(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function publish() { localStorage.setItem(key, JSON.stringify(history)); listeners.forEach((listener) => listener()); }
export function useHistory() { return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => history); }
export function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>) { history = [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...history].slice(0, 50); publish(); }
export function clearHistory() { history = []; publish(); }
