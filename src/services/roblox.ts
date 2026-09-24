export interface RobloxValidation { valid: boolean; name?: string; displayName?: string; error?: string; }

export async function validateRoblox(type: 'user' | 'group', id: string): Promise<RobloxValidation> {
  const endpoint = type === 'group' ? '/api/roblox/validate-group' : '/api/roblox/validate-user';
  const key = type === 'group' ? 'group_id' : 'user_id';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: id }) });
  return response.json();
}
