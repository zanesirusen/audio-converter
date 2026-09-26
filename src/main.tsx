import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import './styles/global.css';

// ── Splash coordination ───────────────────────────────────────
// Splash hides only when BOTH conditions are true:
//   1. Minimum 1.8s has elapsed (so animation is visible)
//   2. React has mounted (App calls splashDone())

const SPLASH_MIN_MS = 1800;
const splashStart = Date.now();
let splashTimerDone = false;
let splashAppDone = false;
let splashHidden = false;

function tryHideSplash() {
  if (splashHidden) return;
  if (!splashTimerDone || !splashAppDone) return;
  splashHidden = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('hidden');
  setTimeout(() => { splash.remove(); }, 420);
}

// Timer gate — fires after minimum display time
const elapsed = Date.now() - splashStart;
const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
setTimeout(() => {
  splashTimerDone = true;
  tryHideSplash();
}, remaining);

// Called by App when it has mounted and auth check is done
export function splashDone() {
  splashAppDone = true;
  tryHideSplash();
}

// Hard fallback — hide after 5s no matter what
setTimeout(() => {
  splashTimerDone = true;
  splashAppDone = true;
  tryHideSplash();
}, 5000);

// ── Global error boundary ─────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050a13', color: '#edf3ff', fontFamily: 'DM Sans, sans-serif', gap: 16, padding: 32 }}>
          <div style={{ fontSize: 40 }}>♫</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: '#8291ad', fontSize: 13, textAlign: 'center', maxWidth: 420 }}>{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 8, padding: '10px 24px', background: '#765bff', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
