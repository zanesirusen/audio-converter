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

const key = '3zane_history_v2';
let history: HistoryItem[] = read();
const listeners = new Set<() => void>();

function read(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function publish() {
  localStorage.setItem(key, JSON.stringify(history));
  listeners.forEach((listener) => listener());
}

export function useHistory() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => history
  );
}

export function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>) {
  history = [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...history].slice(0, 50);
  publish();
  // Fire-and-forget server sync for logged-in users
  void syncHistoryToServer();
}

export function clearHistory() {
  history = [];
  publish();
  // Also clear on server
  void fetch('/api/history', { method: 'DELETE' }).catch(() => {});
}

/** Pull server history if user is logged in; merge with local (server wins for new items). */
export async function loadHistoryFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return; // not authenticated or server error — keep local
    const data = await res.json() as { history: HistoryItem[] };
    if (!Array.isArray(data.history) || data.history.length === 0) {
      // Server has nothing — push local up
      await syncHistoryToServer();
      return;
    }
    // Merge: combine server + local, deduplicate by id, sort by date, cap at 50
    const merged = [...data.history, ...history];
    const seen = new Set<string>();
    history = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);
    publish();
  } catch {
    // Offline / not authenticated — silently ignore
  }
}

async function syncHistoryToServer(): Promise<void> {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
    });
  } catch {
    // Offline — silently ignore
  }
}
