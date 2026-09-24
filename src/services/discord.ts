export function startDiscordLogin() {
  window.location.assign('/api/auth/discord');
}

export async function getCurrentUser() {
  const response = await fetch('/api/auth/me');
  return response.json() as Promise<{ authenticated: boolean; user: { id: string; username: string; global_name?: string; avatar?: string } | null }>;
}

export async function logoutDiscord() {
  await fetch('/api/auth/logout', { method: 'POST' });
}
