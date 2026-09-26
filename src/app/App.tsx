import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import '../styles/app.css';
import { LandingPage } from '../pages/LandingPage';
import { ConverterPanel } from '../features/converter/ConverterPanel.tsx';
import { BulkConverterPanel } from '../features/converter/BulkConverterPanel';
import { RobloxSettingsPage } from '../features/roblox/RobloxSettingsPage';
import { AssetLibrary } from '../features/assets/AssetLibrary';
import { HistoryList } from '../components/HistoryList';
import { ActivityFeed } from '../components/ActivityFeed';
import { ToastContainer } from '../components/Toast';
import { getCurrentUser } from '../services/discord';
import { AuthPanel, type AuthUser } from '../features/auth/AuthPanel';
import { useHistory, loadHistoryFromServer } from '../stores/appStore';
import { useTheme, toggleTheme } from '../stores/themeStore';
import { useRobloxSettings } from '../stores/robloxSettingsStore';
import { splashDone } from '../main';
import { routes } from './routes';

type Page = 'home' | 'converter' | 'bulk' | 'assets' | 'history' | 'roblox';

interface ServiceHealth { youtube: boolean; spotify: boolean; roblox: boolean; converter: boolean; loading: boolean; }

function pageFromPath(pathname: string): Page {
  if (pathname === routes.converter) return 'converter';
  if (pathname === routes.bulk) return 'bulk';
  if (pathname === routes.assets) return 'assets';
  if (pathname === routes.history) return 'history';
  if (pathname === routes.roblox) return 'roblox';
  return 'home';
}

export function App() {
  const history = useHistory();
  const theme = useTheme();
  const robloxSettings = useRobloxSettings();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth>({ youtube: true, spotify: true, roblox: true, converter: true, loading: true });
  const [pageKey, setPageKey] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void getCurrentUser()
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          void loadHistoryFromServer();
        }
      })
      .finally(() => {
        setAuthLoading(false);
        // Signal splash that app is ready — splash will hide only after
        // both this call AND the 1.8s minimum timer have fired
        splashDone();
        setTimeout(() => setShowLanding(true), 80);
      });
  }, []);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health');
        const ok = res.ok;
        setServiceHealth({ youtube: ok, spotify: ok, roblox: ok, converter: ok, loading: false });
      } catch {
        setServiceHealth({ youtube: false, spotify: false, roblox: false, converter: false, loading: false });
      }
    }
    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const avatarElement = document.querySelector<HTMLElement>('.profile-card .avatar');
    if (!avatarElement) return;
    if (user?.avatar) {
      avatarElement.classList.add('has-discord-avatar');
      avatarElement.style.backgroundImage = `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96)`;
    } else {
      avatarElement.classList.remove('has-discord-avatar');
      avatarElement.style.backgroundImage = '';
    }
  }, [page, user]);

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(path: string, event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    window.history.pushState({}, '', path);
    setPage(pageFromPath(path));
    setPageKey((k) => k + 1);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateTo(path: string) {
    window.history.pushState({}, '', path);
    setPage(pageFromPath(path));
    setPageKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const today = history.filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length;
  const formats = new Set(history.map((item) => item.format)).size;
  const robloxReady = robloxSettings.apiKeyValid && robloxSettings.creatorValid;

  const Link = ({ href, className = '', children }: { href: string; className?: string; children: ReactNode }) => (
    <a className={className} href={href} onClick={(e) => navigate(href, e)}>{children}</a>
  );

  const sideLink = (href: string, icon: string, label: string, badge?: string) => (
    <Link href={href} className={`side-link ${pageFromPath(href) === page ? 'active' : ''}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {badge && <span className="side-badge">{badge}</span>}
    </Link>
  );

  function pageHeader(eyebrow: string, title: string, description: string) {
    return (
      <div className="page-header">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    );
  }

  function systemStatus() {
    const { loading } = serviceHealth;
    const allOk = serviceHealth.youtube && serviceHealth.spotify && serviceHealth.roblox && serviceHealth.converter;
    const statusText = loading ? 'Checking…' : allOk ? '● All systems operational' : '⚠ Some services degraded';
    const statusClass = loading ? 'muted' : allOk ? '' : 'status-degraded';

    function ServiceRow({ name, ok }: { name: string; ok: boolean }) {
      return <p><span>◉ {name}</span><b className={ok ? '' : 'status-offline'}>{loading ? '…' : ok ? 'Online' : 'Offline'}</b></p>;
    }

    return (
      <section className="status-card">
        <div className="rail-heading">
          <h3>✦ System status</h3>
          <span className={statusClass}>{statusText}</span>
        </div>
        <ServiceRow name="YouTube API" ok={serviceHealth.youtube} />
        <ServiceRow name="Spotify API" ok={serviceHealth.spotify} />
        <ServiceRow name="Roblox API" ok={serviceHealth.roblox} />
        <ServiceRow name="Converter service" ok={serviceHealth.converter} />
      </section>
    );
  }

  function converterWorkspace() {
    return (
      <>
        <section className="hero">
          <div className="hero-copy-block">
            <span className="eyebrow">▣ Private audio workspace</span>
            <h1>Make every link<br /><em>sound intentional.</em></h1>
            <p className="hero-copy">Convert, shape, preview, and prepare audio for your Roblox creator workflow, all in one calm workspace.</p>
            <div className="hero-perks">
              <span>ϟ Fast conversion</span><span>◉ High quality</span>
              <span>⌘ Roblox ready</span><span>◈ Secure & private</span>
            </div>
          </div>
          <div className="hero-art"><span>♫</span><i /><i /><i /></div>
        </section>
        <div className="workspace-grid">
          <div className="main-column">
            <ConverterPanel onGoToSettings={() => navigateTo(routes.roblox)} />
            <section className="creator-tools">
              <div className="section-heading">
                <div><span className="eyebrow">Workspace</span><h2>Creator tools</h2><p>Everything you need to create and manage your audio assets.</p></div>
              </div>
              <div className="tool-cards">
                <Link href={routes.converter}><strong>♫</strong><b>Audio converter</b><span>Convert audio from any link or file.</span><small>Open converter →</small></Link>
                <Link href={routes.roblox}><strong>⚙</strong><b>Roblox settings</b><span>Save API key & creator ID.</span><small>Open settings →</small></Link>
                <Link href={routes.assets}><strong>▣</strong><b>Audio assets</b><span>Manage converted audio files.</span><small>Open assets →</small></Link>
                <Link href={routes.history}><strong>◷</strong><b>History</b><span>View recent conversions.</span><small>View history →</small></Link>
              </div>
            </section>
          </div>
          <aside className="right-rail">
            <section className="profile-card">
              <div className="profile-row">
                <div className="avatar">{user?.global_name?.slice(0, 1) || 'W'}</div>
                <div>
                  <strong>{user?.global_name || user?.username || 'Guest creator'}</strong>
                  <span>{user ? 'Free plan' : 'Local workspace'}</span>
                </div>
                <b>›</b>
              </div>
              <div className="profile-stats">
                <span><b>{history.length}</b>Total conversions</span>
                <span><b>{today}</b>Today</span>
                <span><b>{formats}</b>Formats used</span>
              </div>
            </section>
            {systemStatus()}
            <ActivityFeed />
          </aside>
        </div>
      </>
    );
  }

  function overviewPage() {
    return (
      <>
        <div className="overview-welcome">
          <div>
            <span className="eyebrow">Workspace overview</span>
            <h1>Good to see you, {user?.global_name || 'creator'}.</h1>
            <p>Keep your audio workflow moving from one focused dashboard.</p>
          </div>
          <Link href={routes.converter} className="primary-button">Start converting →</Link>
        </div>
        <div className="overview-stats">
          <div><span>Total conversions</span><strong>{history.length}</strong><small>All time activity</small></div>
          <div><span>Today</span><strong>{today}</strong><small>Conversions today</small></div>
          <div><span>Formats used</span><strong>{formats}</strong><small>Across your workspace</small></div>
          <div><span>Roblox ready</span><strong>{history.filter((i) => ['mp3','ogg','wav','flac'].includes(i.format)).length}</strong><small>Supported audio files</small></div>
        </div>
        <div className="overview-grid">
          <section className="creator-tools">
            <div className="section-heading">
              <div><span className="eyebrow">Quick start</span><h2>What do you want to do?</h2><p>Jump into the part of your workflow you need.</p></div>
            </div>
            <div className="tool-cards">
              <Link href={routes.converter}><strong>♫</strong><b>Convert audio</b><span>Turn a link into a ready-to-use file.</span><small>Open converter →</small></Link>
              <Link href={routes.assets}><strong>▣</strong><b>Manage assets</b><span>Browse and download your converted files.</span><small>Open assets →</small></Link>
              <Link href={routes.roblox}><strong>⚙</strong><b>Roblox settings</b><span>Save API key & creator ID for publishing.</span><small>Open settings →</small></Link>
              <Link href={routes.history}><strong>◷</strong><b>Review activity</b><span>See conversion history and status.</span><small>View history →</small></Link>
            </div>
          </section>
          <div className="overview-rail">{systemStatus()}<ActivityFeed /></div>
        </div>
      </>
    );
  }

  function renderPage() {
    if (page === 'home') return overviewPage();
    if (page === 'converter') return converterWorkspace();
    if (page === 'bulk') return <BulkConverterPanel />;
    if (page === 'assets') return <><div className="single-page">{pageHeader('Assets', 'Your audio assets', 'Organize converted files and keep Roblox-ready audio close at hand.')}</div><AssetLibrary /></>;
    if (page === 'history') return <><div className="single-page">{pageHeader('Activity', 'Conversion history', 'Review your latest audio work and download finished files.')}</div><HistoryList /></>;
    // Settings page (was roblox)
    return (
      <div className="single-page-wide">
        <RobloxSettingsPage />
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {/* ── Show landing page when not authenticated ── */}
      {!authLoading && !user && showLanding && (
        <LandingPage />
      )}

      {/* ── Auth loading spinner ── */}
      {authLoading && (
        <div className="app-auth-loading">
          <span className="brand-mark">♫</span>
          <span className="auth-loading-text">Loading…</span>
        </div>
      )}

      {/* ── Full dashboard — only when authenticated ── */}
      {!authLoading && user && (
        <>
          <header className="topbar">
        <button className="mobile-menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((o) => !o)}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        <Link className="brand" href={routes.home}>
          <span className="brand-mark">♫</span>
          <span>3ZANE<small>audio workspace</small></span>
        </Link>
        <div className="account">
          <button className="icon-button theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <AuthPanel user={user} loading={authLoading} />
        </div>
        {/* Mobile: auth shown next to hamburger */}
        <div className="mobile-topbar-auth">
          <AuthPanel user={user} loading={authLoading} />
        </div>
      </header>
      <div className="dashboard-shell">
        <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          {/* Mobile close button inside sidebar */}
          <div className="sidebar-mobile-header">
            <span className="side-label" style={{ margin: 0 }}>Navigation</span>
            <button className="mobile-close-btn" type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>✕</button>
          </div>
          <div className="side-section">
            <span className="side-label">Workspace</span>
            {sideLink(routes.home, '⌂', 'Home')}
            {sideLink(routes.converter, '♢', 'Converter')}
            {sideLink(routes.assets, '▣', 'Assets')}
            {sideLink(routes.history, '◷', 'History')}
            {sideLink(routes.roblox, '⚙', 'Roblox Settings', robloxReady ? '✓' : undefined)}
          </div>
          <div className="side-divider" />
          <div className="side-section">
            <span className="side-label">Quick actions</span>
            <Link href={routes.converter} className="side-link">↗ <span>Paste URL</span><kbd>Ctrl + V</kbd></Link>
            <Link href={routes.converter} className="side-link">↥ <span>Upload file</span></Link>
            <Link href={routes.bulk} className="side-link">▱ <span>Bulk convert</span></Link>
          </div>
        </aside>
        <main className="dashboard-main" ref={mainRef}>
          <div key={pageKey} className="page-transition">
            {renderPage()}
          </div>
        </main>
      </div>
        </>
      )}
      <ToastContainer />
    </div>
  );
}
