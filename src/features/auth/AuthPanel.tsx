import { useEffect, useState } from 'react';
import { getCurrentUser, logoutDiscord, startDiscordLogin } from '../../services/discord';

export interface AuthUser { username: string; global_name?: string; avatar?: string; id: string; }

interface AuthPanelProps { user: AuthUser | null; loading?: boolean; }

function showSplashAndReload() {
  // Re-inject splash instantly before reload so there's no blank flash
  const existing = document.getElementById('splash');
  if (!existing) {
    const splash = document.createElement('div');
    splash.id = 'splash';
    splash.innerHTML = `
      <div class="splash-logo"></div>
      <div class="splash-brand">3ZANE</div>
      <div class="splash-sub">audio workspace</div>
      <div class="splash-bar-wrap"><div class="splash-bar"></div></div>
    `;
    document.body.appendChild(splash);
  } else {
    existing.classList.remove('hidden');
  }
}

export function AuthPanel({ user, loading = false }: AuthPanelProps) {
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void getCurrentUser()
      .then((data) => data.authenticated && setSessionUser(data.user))
      .finally(() => setSessionReady(true));
  }, []);

  if (loading || !sessionReady) return <span className="auth-loading" aria-hidden="true" />;

  const currentUser = user || sessionUser;

  if (!currentUser) {
    return (
      <button className="discord-button" onClick={startDiscordLogin}>
        Login Discord
      </button>
    );
  }

  const avatar = currentUser.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`
    : '';

  async function handleLogout() {
    showSplashAndReload();
    await logoutDiscord();
    window.location.reload();
  }

  return (
    <button className="profile-button" onClick={() => void handleLogout()}>
      {avatar && <img src={avatar} alt="" />}
      {currentUser.global_name || currentUser.username} · Logout
    </button>
  );
}
