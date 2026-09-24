export type Platform = 'youtube' | 'soundcloud' | 'tiktok' | 'spotify' | 'applemusic' | 'upload';

export interface AudioMeta {
  platform: Platform;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string | null;
  formats: string[];
}

export interface ConvertResult {
  success: boolean;
  platform: Platform;
  format: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string | null;
  playback_speed_normal: number;
  file: { name: string; size_mb: string; url: string };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request gagal.');
  return data;
}

export function detectAudio(url: string) {
  return request<AudioMeta>('/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
}

export function convertAudio(payload: Record<string, unknown>) {
  return request<ConvertResult>('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function convertUploadedAudio(file: File, options: Record<string, unknown>) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(options).forEach(([key, value]) => form.append(key, String(value)));
  return request<ConvertResult>('/api/convert', { method: 'POST', body: form });
}

export function downloadUrl(filename: string) {
  return `/api/download/${encodeURIComponent(filename)}`;
}
