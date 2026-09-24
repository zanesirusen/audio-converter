import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import '../styles/app.css';
import { ConverterPanel } from '../features/converter/ConverterPanel.tsx';
import { BulkConverterPanel } from '../features/converter/BulkConverterPanel';
import { RobloxPanel } from '../features/roblox/RobloxPanel';
import { AssetLibrary } from '../features/assets/AssetLibrary';
import { HistoryList } from '../components/HistoryList';
import { getCurrentUser } from '../services/discord';
import { AuthPanel, type AuthUser } from '../features/auth/AuthPanel';
import { useHistory } from '../stores/appStore';
import { routes } from './routes';

type Page = 'home' | 'converter' | 'bulk' | 'assets' | 'history' | 'roblox';

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { void getCurrentUser().then((data) => data.authenticated && setUser(data.user)); }, []);
  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(path: string, event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    const targetPath = path === routes.converter && event?.currentTarget.textContent?.includes('Bulk convert') ? routes.bulk : path;
    window.history.pushState({}, '', targetPath);
    setPage(pageFromPath(targetPath));
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const today = history.filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length;
  const formats = new Set(history.map((item) => item.format)).size;
  const Link = ({ href, className = '', children }: { href: string; className?: string; children: ReactNode }) => <a className={className} href={href} onClick={(event) => navigate(href, event)}>{children}</a>;
  const sideLink = (href: string, icon: string, label: string) => <Link href={href} className={`side-link ${pageFromPath(href) === page ? 'active' : ''}`}><span>{icon}</span><span>{label}</span></Link>;

  function pageHeader(eyebrow: string, title: string, description: string) {
    return <div className="page-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
  }

  function systemStatus() {
    return <section className="status-card"><div className="rail-heading"><h3>✦ System status</h3><span>● All systems operational</span></div><p>◉ YouTube API <b>Online</b></p><p>◉ Spotify API <b>Online</b></p><p>◉ Roblox API <b>Online</b></p><p>◉ Converter service <b>Online</b></p></section>;
  }

  function converterWorkspace() {
    return <><section className="hero"><div className="hero-copy-block"><span className="eyebrow">▣ Private audio workspace</span><h1>Make every link<br /><em>sound intentional.</em></h1><p className="hero-copy">Convert, shape, preview, and prepare audio for your Roblox creator workflow, all in one calm workspace.</p><div className="hero-perks"><span>ϟ Fast conversion</span><span>◉ High quality</span><span>⌘ Roblox ready</span><span>◈ Secure & private</span></div></div><div className="hero-art"><span>♫</span><i /><i /><i /></div></section><div className="workspace-grid"><div className="main-column"><ConverterPanel /><section className="creator-tools"><div className="section-heading"><div><span className="eyebrow">Workspace</span><h2>Creator tools</h2><p>Everything you need to create and manage your audio assets.</p></div></div><div className="tool-cards"><Link href={routes.converter}><strong>♫</strong><b>Audio converter</b><span>Convert audio from any link or file.</span><small>Open converter →</small></Link><Link href={routes.roblox}><strong>⌘</strong><b>Roblox publishing</b><span>Publish your audio directly to Roblox.</span><small>Publish to Roblox →</small></Link><Link href={routes.assets}><strong>▣</strong><b>Audio assets</b><span>Manage converted audio files.</span><small>Open assets →</small></Link><Link href={routes.history}><strong>◷</strong><b>History</b><span>View recent conversions.</span><small>View history →</small></Link></div></section></div><aside className="right-rail"><section className="profile-card"><div className="profile-row"><div className="avatar">{user?.global_name?.slice(0, 1) || 'W'}</div><div><strong>{user?.global_name || user?.username || 'Guest creator'}</strong><span>{user ? 'Free plan' : 'Local workspace'}</span></div><b>›</b></div><div className="profile-stats"><span><b>{history.length}</b>Total conversions</span><span><b>{today}</b>Today</span><span><b>{formats}</b>Formats used</span></div></section>{systemStatus()}<HistoryList /></aside></div></>;
  }

  function overviewPage() {
    return <><div className="overview-welcome"><div><span className="eyebrow">Workspace overview</span><h1>Good to see you, {user?.global_name || 'creator'}.</h1><p>Keep your audio workflow moving from one focused dashboard.</p></div><Link href={routes.converter} className="primary-button">Start converting →</Link></div><div className="overview-stats"><div><span>Total conversions</span><strong>{history.length}</strong><small>All time activity</small></div><div><span>Today</span><strong>{today}</strong><small>Conversions today</small></div><div><span>Formats used</span><strong>{formats}</strong><small>Across your workspace</small></div><div><span>Roblox ready</span><strong>{history.filter((item) => ['mp3', 'ogg', 'wav', 'flac'].includes(item.format)).length}</strong><small>Supported audio files</small></div></div><div className="overview-grid"><section className="creator-tools"><div className="section-heading"><div><span className="eyebrow">Quick start</span><h2>What do you want to do?</h2><p>Jump into the part of your workflow you need.</p></div></div><div className="tool-cards"><Link href={routes.converter}><strong>♫</strong><b>Convert audio</b><span>Turn a link into a ready-to-use file.</span><small>Open converter →</small></Link><Link href={routes.assets}><strong>▣</strong><b>Manage assets</b><span>Browse and download your converted files.</span><small>Open assets →</small></Link><Link href={routes.roblox}><strong>⌘</strong><b>Publish to Roblox</b><span>Validate creator details and prepare upload.</span><small>Open Roblox →</small></Link><Link href={routes.history}><strong>◷</strong><b>Review activity</b><span>See conversion history and status.</span><small>View history →</small></Link></div></section><div className="overview-rail">{systemStatus()}<HistoryList /></div></div></>;
  }

  function renderPage() {
    if (page === 'home') return overviewPage();
    if (page === 'converter') return converterWorkspace();
    if (page === 'bulk') return <BulkConverterPanel />;
    if (page === 'assets') return <><div className="single-page">{pageHeader('Assets', 'Your audio assets', 'Organize converted files and keep Roblox-ready audio close at hand.')}</div><AssetLibrary /></>;
    if (page === 'history') return <><div className="single-page">{pageHeader('Activity', 'Conversion history', 'Review your latest audio work and download finished files.')}</div><HistoryList /></>;
    return <><section className="hero roblox-hero"><div className="hero-copy-block"><span className="eyebrow">⌘ Roblox creator workspace</span><h1>Publish your sound<br /><em>where players hear it.</em></h1><p className="hero-copy">Validate your creator, prepare asset details, and send converted audio to Roblox Open Cloud from one focused workflow.</p><div className="hero-perks"><span>◈ Open Cloud ready</span><span>◉ Creator validation</span><span>ϟ Fast publishing</span><span>▣ Asset metadata</span></div></div><div className="hero-art roblox-art"><span>⌘</span><i /><i /><i /></div></section><div className="roblox-page-grid"><div className="main-column"><RobloxPanel /></div><aside className="right-rail"><section className="roblox-guide"><span className="eyebrow">Publishing guide</span><h3>Three steps to Roblox</h3><p>Validate your destination, review the asset metadata, then publish with your Open Cloud key.</p><div><span>01</span> Creator destination</div><div><span>02</span> Asset details</div><div><span>03</span> Publish and track</div></section><div id="roblox-selected-asset-slot" /></aside></div></>;
  }

  return <div className="app-shell"><header className="topbar"><button className="mobile-menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? '✕' : '☰'}</button><Link className="brand" href={routes.home}><span className="brand-mark">♫</span><span>WAVEFORGE<small>audio workspace</small></span></Link><div className="account"><button className="icon-button" aria-label="Toggle theme">☼</button><button className="icon-button" aria-label="Notifications">♧</button><AuthPanel user={user} /></div></header><div className="dashboard-shell"><aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}><div className="side-section"><span className="side-label">Workspace</span>{sideLink(routes.home, '⌂', 'Home')}{sideLink(routes.converter, '♢', 'Converter')}{sideLink(routes.assets, '▣', 'Assets')}{sideLink(routes.history, '◷', 'History')}{sideLink(routes.roblox, '⌘', 'Roblox')}</div><div className="side-divider" /><div className="side-section"><span className="side-label">Quick actions</span><Link href={routes.converter} className="side-link">↗ <span>Paste URL</span><kbd>Ctrl + V</kbd></Link><Link href={routes.converter} className="side-link">↥ <span>Upload file</span></Link><Link href={routes.converter} className="side-link">▱ <span>Bulk convert</span></Link></div><div className="upgrade-card"><strong>✦ Upgrade to Premium</strong><p>Faster conversion, higher quality, more features.</p><button>Go Premium →</button></div></aside><main className="dashboard-main">{renderPage()}</main></div></div>;
}
