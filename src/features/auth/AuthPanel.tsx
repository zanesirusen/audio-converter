import { logoutDiscord, startDiscordLogin } from '../../services/discord';

export interface AuthUser { username: string; global_name?: string; avatar?: string; id: string; }

interface AuthPanelProps { user: AuthUser | null; }

export function AuthPanel({ user }: AuthPanelProps) {
	if (!user) return <button className="discord-button" onClick={startDiscordLogin}>Login Discord</button>;
	const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : '';
	return <button className="profile-button" onClick={() => { void logoutDiscord().then(() => window.location.reload()); }}>{avatar && <img src={avatar} alt="" />}{user.global_name || user.username} · Logout</button>;
}
