---
title: Audio Converter
emoji: 🎵
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# 🎵 Audio Converter

Convert audio dari YouTube, SoundCloud, TikTok, Spotify, dan Apple Music.

## Fitur
- Auto-detect platform dari URL
- Multi-format audio: MP3, M4A, AAC, OGG, OPUS, FLAC, WAV, WMA
- Speed adjustment (0.5x - 3.0x)
- Amplify (volume) adjustment (-20 dB - +10 dB)
- Publish ke Roblox Open Cloud
- No cookies needed (POT Provider via EJS)

## Login Discord

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) dan buat application baru.
2. Masuk ke **OAuth2 > General**, salin `Client ID` dan buat/copy `Client Secret`.
3. Tambahkan redirect URL berikut:
	- Local: `http://localhost:3000/api/auth/discord/callback`
	- Railway: `https://DOMAIN-RAILWAY-KAMU/api/auth/discord/callback`
4. Buat file `.env` dari `.env.example`, lalu isi:

```env
DISCORD_CLIENT_ID=client_id_kamu
DISCORD_CLIENT_SECRET=client_secret_kamu
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
```

`DISCORD_REDIRECT_URI` harus sama persis dengan URL yang terdaftar di Discord.

## Deploy Ke Railway

1. Push isi folder `audio-converter` ke repository GitHub.
2. Di Railway pilih **New Project > Deploy from GitHub Repo**.
3. Jika repository berisi folder lain, set **Root Directory** ke `audio-converter`.
4. Railway akan memakai `Dockerfile`, menjalankan build frontend, lalu menjalankan `node server.js`.
5. Tambahkan variable di Railway **Variables**:

```env
DISCORD_CLIENT_ID=client_id_kamu
DISCORD_CLIENT_SECRET=client_secret_kamu
DISCORD_REDIRECT_URI=https://DOMAIN-RAILWAY-KAMU/api/auth/discord/callback
```

6. Setelah deploy menghasilkan domain Railway, masukkan domain itu ke redirect URL Discord, lalu redeploy.

`PORT` tidak perlu diisi manual karena Railway menyediakannya otomatis. Jangan commit `.env`, client secret, cookies, atau isi folder `downloads`.