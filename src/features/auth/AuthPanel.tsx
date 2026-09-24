import { useEffect, useState } from 'react';
import { getCurrentUser, logoutDiscord, startDiscordLogin } from '../../services/discord';

export interface AuthUser { username: string; global_name?: string; avatar?: string; id: string; }

interface AuthPanelProps { user: AuthUser | null; loading?: boolean; }

export function AuthPanel({ user, loading = false }: AuthPanelProps) {
	const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
	const [sessionReady, setSessionReady] = useState(false);
	useEffect(() => { void getCurrentUser().then((data) => data.authenticated && setSessionUser(data.user)).finally(() => setSessionReady(true)); }, []);
	if (loading || !sessionReady) return <span className="auth-loading" aria-hidden="true" />;
	const currentUser = user || sessionUser;
	if (!currentUser) return <button className="discord-button" onClick={startDiscordLogin}>Login Discord</button>;
	const avatar = currentUser.avatar ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64` : '';
	return <button className="profile-button" onClick={() => { void logoutDiscord().then(() => window.location.reload()); }}>{avatar && <img src={avatar} alt="" />}{currentUser.global_name || currentUser.username} · Logout</button>;
}
