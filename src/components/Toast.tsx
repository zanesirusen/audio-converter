import { useEffect, useState, useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// ── Store ─────────────────────────────────────────────────────
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function publish() { listeners.forEach((l) => l()); }

export function toast(message: string, type: ToastType = 'info', duration = 3500) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, message, type, duration }];
  publish();
  setTimeout(() => removeToast(id), duration + 400); // auto-remove after fade
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  publish();
}

function useToasts() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
  );
}

// ── Component ─────────────────────────────────────────────────
const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: '🔔',
  warning: '⚠️',
};

function ToastCard({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const t1 = setTimeout(() => setVisible(true), 10);
    // Trigger exit animation before removal
    const t2 = setTimeout(() => setVisible(false), item.duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [item.duration]);

  return (
    <div
      className={`toast-card toast-${item.type}${visible ? ' toast-visible' : ''}`}
      role="alert"
      onClick={() => removeToast(item.id)}
    >
      <span className="toast-icon">{ICONS[item.type]}</span>
      <span className="toast-msg">{item.message}</span>
      <button className="toast-close" aria-label="Dismiss">×</button>
    </div>
  );
}

export function ToastContainer() {
  const items = useToasts();
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {items.map((item) => <ToastCard key={item.id} item={item} />)}
    </div>
  );
}
