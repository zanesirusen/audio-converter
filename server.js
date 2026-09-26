const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const youtubedl = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const crypto = require('crypto');
const multer = require('multer');
const archiver = require('archiver');
const { Pool } = require('pg');
require('dotenv').config();

// ==== POSTGRESQL SETUP ====
let db = null;

async function initDB() {
    if (!process.env.DATABASE_URL) {
        console.log('[DB] No DATABASE_URL — using file-based fallback.');
        return;
    }
    try {
        db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_history (
                user_id TEXT PRIMARY KEY,
                history JSONB NOT NULL DEFAULT '[]',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS user_roblox_settings (
                user_id TEXT PRIMARY KEY,
                settings JSONB NOT NULL DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('[DB] ✅ PostgreSQL connected and tables ready.');
    } catch (err) {
        console.error('[DB] ❌ Failed to connect:', err.message);
        db = null;
    }
}

initDB();

// ==== DECODE COOKIES DARI ENV (buat Railway) ====
if (process.env.YT_COOKIES_B64) {    try {
        const cookieContent = Buffer.from(process.env.YT_COOKIES_B64, 'base64').toString('utf-8');
        fs.writeFileSync('./cookies.txt', cookieContent);
        console.log(`[BOOT] ✅ Cookies decoded from env (${cookieContent.length} bytes)`);
    } catch (err) {
        console.error(`[BOOT] ❌ Failed to decode cookies:`, err.message);
    }
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 3000;
const DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

const upload = multer({
    dest: DIR,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') return callback(null, true);
        callback(new Error('File harus berupa audio.'));
    }
});

const sessions = new Map();
const requestBuckets = new Map();

function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = requestBuckets.get(key) || { startedAt: now, count: 0 };
    if (now - bucket.startedAt > 60000) {
        bucket.startedAt = now;
        bucket.count = 0;
    }
    bucket.count++;
    requestBuckets.set(key, bucket);
    if (bucket.count > 30) return res.status(429).json({ error: 'Terlalu banyak request. Coba lagi dalam satu menit.' });
    next();
}

function setCookie(res, name, value, maxAge = 86400) {
    res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`);
}

function readCookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => {
        const [key, ...value] = part.trim().split('=');
        return [key, decodeURIComponent(value.join('='))];
    }));
}

function getSession(req) {
    const sessionId = readCookies(req).audio_session;
    return sessionId ? sessions.get(sessionId) : null;
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', rateLimit);

// ==== STATIC DOWNLOADS — dengan Content-Type + Content-Disposition ====
app.use('/downloads', express.static(path.resolve(DIR), {
    setHeaders: (res, filepath) => {
        const filename = path.basename(filepath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const ext = path.extname(filepath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.ogg': 'audio/ogg',
            '.opus': 'audio/opus',
            '.flac': 'audio/flac',
            '.wav': 'audio/wav',
            '.wma': 'audio/x-ms-wma'
        };
        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }
    }
}));

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

app.get('/.well-known/discord', (req, res) => {
    res.type('text/plain; charset=utf-8').send('dh=81d6edbcc668c3802e22948da48c820fd34166aa');
});

app.get('/api/download/:filename', (req, res) => {
    const filename = path.basename(decodeURIComponent(req.params.filename));
    const filePath = path.join(DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File sudah tidak tersedia.' });
    res.download(filePath, filename, { dotfiles: 'deny' });
});

app.get('/api/auth/me', (req, res) => {
    const session = getSession(req);
    res.json({ authenticated: Boolean(session), user: session?.user || null });
});

app.get('/api/auth/discord', (req, res) => {
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim();
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET?.trim().replace(/^['"]|['"]$/g, '');
    const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI?.trim();
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
        return res.redirect('/?auth=failed&reason=unconfigured');
    }
    const statePayload = `${Date.now()}.${crypto.randomBytes(24).toString('hex')}`;
    const stateSignature = crypto.createHmac('sha256', DISCORD_CLIENT_SECRET).update(statePayload).digest('hex');
    const state = `${statePayload}.${stateSignature}`;
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify',
        state
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/api/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim().replace(/^['"]|['"]$/g, '');
    const stateParts = typeof state === 'string' ? state.split('.') : [];
    const stateTimestamp = Number(stateParts[0]);
    const stateSignature = stateParts.pop() || '';
    const statePayload = stateParts.join('.');
    const expectedSignature = clientSecret && statePayload
        ? crypto.createHmac('sha256', clientSecret).update(statePayload).digest('hex')
        : '';
    const signaturesMatch = expectedSignature && stateSignature.length === expectedSignature.length
        ? crypto.timingSafeEqual(Buffer.from(stateSignature), Buffer.from(expectedSignature))
        : false;
    const stateAge = Date.now() - stateTimestamp;
    if (!code || !clientSecret || !signaturesMatch || !Number.isFinite(stateAge) || stateAge < 0 || stateAge > 300000) {
        return res.redirect('/?auth=failed&reason=state_expired');
    }

    try {
        const clientId = process.env.DISCORD_CLIENT_ID?.trim();
        const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim().replace(/^['"]|['"]$/g, '');
        const redirectUri = process.env.DISCORD_REDIRECT_URI?.trim();
        if (!clientId || !clientSecret || !redirectUri) throw new Error('Discord OAuth variables are incomplete.');
        const token = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const profile = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `${token.data.token_type} ${token.data.access_token}` }
        });
        const sessionId = crypto.randomBytes(32).toString('hex');
        sessions.set(sessionId, { user: profile.data, createdAt: Date.now() });
        setCookie(res, 'audio_session', sessionId);
        res.redirect('/?auth=success');
    } catch (error) {
        const reason = error.response?.data?.error || (error.message.includes('variables') ? 'unconfigured' : 'oauth_exchange_failed');
        console.error('[AUTH] Discord OAuth failed:', error.response?.data || error.message);
        res.redirect(`/?auth=failed&reason=${encodeURIComponent(reason)}`);
    }
});

app.post('/api/auth/logout', (req, res) => {
    const sessionId = readCookies(req).audio_session;
    if (sessionId) sessions.delete(sessionId);
    setCookie(res, 'audio_session', '', 0);
    res.json({ success: true });
});

// ==== FORMAT AUDIO ====
const FORMATS = {
    mp3:  { codec: 'libmp3lame', bitrate: '320k', ext: 'mp3' },
    m4a:  { codec: 'aac',        bitrate: '256k', ext: 'm4a', container: 'ipod' },
    aac:  { codec: 'aac',        bitrate: '256k', ext: 'aac', container: 'adts' },
    ogg:  { codec: 'libvorbis',  bitrate: '256k', ext: 'ogg' },
    opus: { codec: 'libopus',    bitrate: '192k', ext: 'opus' },
    flac: { codec: 'flac',       bitrate: null,   ext: 'flac' },
    wav:  { codec: 'pcm_s16le',  bitrate: null,   ext: 'wav' },
    wma:  { codec: 'wmav2',      bitrate: '192k', ext: 'wma', container: 'asf' }
};

// ==== DETECT PLATFORM ====
function detect(url) {
    if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.test(url)) return 'youtube';
    if (/soundcloud\.com\/[\w-]+\/[\w-]+/.test(url)) return 'soundcloud';
    if (/tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) return 'tiktok';
    if (/open\.spotify\.com\/(track|album|playlist|episode)\//.test(url)) return 'spotify';
    if (/spotify\.link\/[\w]+/.test(url)) return 'spotify';
    if (/music\.apple\.com\//.test(url)) return 'applemusic';
    return null;
}

// ============================================================
// YT-DLP CONFIG — NO COOKIES MODE
// ============================================================
const CLIENTS = ['android', 'mweb', 'web', 'ios', 'tv', 'web_safari'];
const FFMPEG_LOC = path.join(__dirname, 'node_modules', 'ffmpeg-static');
const DENO_PATH = path.join(process.env.USERPROFILE || process.env.HOME || '', '.deno', 'bin', 'deno.exe');

function ytdlpOpts(client, extra = {}) {
    const opts = {
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        geoBypass: true,
        noPlaylist: true,
        retries: 5,
        jsRuntimes: fs.existsSync(DENO_PATH) ? DENO_PATH : 'deno',
        remoteComponents: 'ejs:npm',
        ffmpegLocation: FFMPEG_LOC,
        extractorArgs: `youtube:player_client=${client};fetch_pot=always`,
        sleepInterval: 1,
        maxSleepInterval: 3,
        ...extra
    };

    // ==== PROXY (kalau ada di env) ====
    if (process.env.YT_PROXY) {
        opts.proxy = process.env.YT_PROXY;
        console.log(`[YTDLP] Using proxy: ${process.env.YT_PROXY.slice(0, 30)}...`);
    }

    // ==== COOKIES (kalau file ada di Railway) ====
    const cookiePath = process.env.YT_COOKIES_PATH || './cookies.txt';
    if (fs.existsSync(cookiePath)) {
        opts.cookies = cookiePath;
        console.log(`[YTDLP] Using cookies: ${cookiePath}`);
    }

    return opts;
}

function isBotErr(e) {
    const m = (e.message || '').toLowerCase();
    return m.includes('sign in') || m.includes('bot') || m.includes('403')
        || m.includes('forbidden') || m.includes('unable to extract')
        || m.includes('no video formats') || m.includes('player response')
        || m.includes('requested format') || m.includes('page needs to be reloaded')
        || m.includes('format is not available');
}

// ==== SANITIZE — strip emoji, non-ASCII, Windows-illegal, URL-illegal ====
function sanitize(name) {
    let cleaned = String(name)
        // Emoji utama
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        // Symbol & pictograph
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        // Emoji modifier & variation selectors
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        // Zero-width joiner & misc
        .replace(/[\u{200B}-\u{200F}\u{2028}-\u{202F}\u{2060}-\u{206F}]/gu, '')
        // Karakter ilegal di Windows
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        // ⚡ Karakter URL-illegal (#, %, &, +, ;, ,)
        .replace(/[#%&+;,]/g, '')
        // Sisanya yang non-ASCII
        .replace(/[^\x20-\x7E]/g, '')
        // Rapihin spasi
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

    return cleaned || 'audio';
}

function sanitizeAssetName(name) {
    let cleaned = String(name)
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{200B}-\u{200F}\u{2028}-\u{202F}\u{2060}-\u{206F}]/gu, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/[#%&+;,]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);

    return cleaned || 'audio';
}

// ==== UNIQUE FILENAME ====
function getUniquePrefix(baseName) {
    let prefix = baseName;
    let counter = 1;
    const files = fs.readdirSync(DIR);
    while (files.some(f => f.startsWith(`${prefix}.`))) {
        prefix = `${baseName} (${counter})`;
        counter++;
    }
    return prefix;
}

// ==== FORMAT DURATION ====
function fmtDur(s) {
    if (!s) return '0:00';
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

// ============================================================
// METADATA FETCHERS
// ============================================================

// ==== SPOTIFY — scrape embed page ====
async function getSpotifyMeta(url) {
    console.log(`[SPOTIFY] Fetching: ${url}`);

    const trackMatch = url.match(/track\/([a-zA-Z0-9]{22})/);
    if (!trackMatch) throw new Error('Spotify URL nggak valid — track ID nggak ketemu.');
    const trackId = trackMatch[1];

    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    console.log(`[SPOTIFY] Embed URL: ${embedUrl}`);

    const { data } = await axios.get(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
    });

    const $ = cheerio.load(data);

    let title = 'Unknown';
    let artist = 'Unknown';
    let duration = '0:00';
    let thumbnail = null;

    try {
        const nextDataScript = $('script#__NEXT_DATA__').html();
        if (nextDataScript) {
            const json = JSON.parse(nextDataScript);
            const entity = json?.props?.pageProps?.state?.data?.entity;

            if (entity) {
                console.log(`[SPOTIFY] Entity found:`, Object.keys(entity));

                title = entity.name || entity.title || 'Unknown';

                if (entity.artists && entity.artists.length > 0) {
                    artist = entity.artists.map(a => a.name).join(', ');
                } else if (entity.subtitle) {
                    artist = entity.subtitle;
                }

                if (entity.duration) {
                    duration = fmtDur(entity.duration / 1000);
                }

                if (entity.coverArt?.sources?.[0]?.url) {
                    thumbnail = entity.coverArt.sources[0].url;
                } else if (entity.visualIdentity?.image?.[0]?.url) {
                    thumbnail = entity.visualIdentity.image[0].url;
                } else if (entity.images?.[0]?.url) {
                    thumbnail = entity.images[0].url;
                }

                console.log(`[SPOTIFY] ✅ Parsed: "${title}" by "${artist}" (${duration})`);
            }
        }
    } catch (parseErr) {
        console.warn(`[SPOTIFY] Parse __NEXT_DATA__ gagal: ${parseErr.message}`);
    }

    if (title === 'Unknown') {
        console.log(`[SPOTIFY] Fallback ke oEmbed...`);
        try {
            const oembedRes = await axios.get('https://open.spotify.com/oembed', {
                params: { url },
                timeout: 10000
            });
            const oData = oembedRes.data;
            title = oData.title || 'Unknown';
            thumbnail = oData.thumbnail_url || thumbnail;

            const m = title.match(/^(.+?)\s*[-–]\s*(?:song by|Song by)\s*(.+)$/i);
            if (m) {
                title = m[1].trim();
                artist = m[2].trim();
            }
        } catch (oembedErr) {
            console.warn(`[SPOTIFY] oEmbed fallback gagal: ${oembedErr.message}`);
        }
    }

    if (title === 'Unknown') {
        const ogTitle = $('meta[property="og:title"]').attr('content');
        const ogDesc = $('meta[property="og:description"]').attr('content');
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogTitle) title = ogTitle;
        if (ogImage) thumbnail = ogImage;
        if (ogDesc && artist === 'Unknown') {
            const dm = ogDesc.match(/^(.+?)\s*·/);
            if (dm) artist = dm[1].trim();
        }
    }

    return {
        title: title.trim(),
        artist: artist.trim(),
        duration,
        thumbnail,
        search_query: `${title} ${artist === 'Unknown' ? '' : artist}`.trim()
    };
}

// ==== APPLE MUSIC ====
async function getAppleMusicMeta(url) {
    console.log(`[APPLEMUSIC] Fetching: ${url}`);

    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
    });

    const $ = cheerio.load(data);
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || null;

    let title = ogTitle.replace(/\s*-\s*Apple Music\s*$/i, '');
    let artist = 'Unknown';

    const m = title.match(/^(.+?)\s*[-–]\s*(?:Song|Album|Playlist) by\s*(.+)$/i);
    if (m) {
        title = m[1].trim();
        artist = m[2].trim();
    } else {
        const dm = ogDesc.match(/^(.+?)\s*·/);
        if (dm) artist = dm[1].trim();
    }

    let duration = '0:00';
    const ldMatch = data.match(/"duration"\s*:\s*"PT(\d+)M(\d+)S"/);
    if (ldMatch) {
        const min = parseInt(ldMatch[1]);
        const sec = parseInt(ldMatch[2]);
        duration = fmtDur(min * 60 + sec);
    }

    return {
        title: title.trim() || 'Unknown',
        artist: artist.trim(),
        duration,
        thumbnail: ogImage,
        search_query: `${title} ${artist === 'Unknown' ? '' : artist}`.trim()
    };
}

// ==== YOUTUBE/SC/TIKTOK ====
async function getYtdlpMeta(url, platform) {
    let lastErr;
    for (const client of CLIENTS) {
        try {
            console.log(`[META] ${client} → ${url}`);
            const info = await youtubedl(url, ytdlpOpts(client, {
                dumpSingleJson: true,
                skipDownload: true,
                format: 'best'
            }));
            console.log(`[META] ✅ ${client}: title="${info.title}"`);
            return {
                title: info.title || 'Unknown',
                artist: info.uploader || info.artist || info.channel || info.creator || info.uploader_id || 'Unknown',
                duration: fmtDur(info.duration),
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null,
                search_query: `${info.title || ''} ${info.uploader || ''}`.trim()
            };
        } catch (e) {
            lastErr = e;
            console.error(`[META] ❌ ${client}: ${e.message}`);
            if (!isBotErr(e)) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw lastErr;
}

// ==== MASTER getMeta ====
async function getMeta(url, platform) {
    switch (platform) {
        case 'spotify':
            return await getSpotifyMeta(url);
        case 'applemusic':
            return await getAppleMusicMeta(url);
        case 'youtube':
        case 'soundcloud':
        case 'tiktok':
            return await getYtdlpMeta(url, platform);
        default:
            throw new Error(`Platform ${platform} nggak didukung.`);
    }
}

// ==== SEARCH YOUTUBE ====
async function ytSearch(query) {
    if (!query || query.trim() === '') {
        throw new Error('Query search kosong.');
    }

    console.log(`[SEARCH] "${query}"`);
    let lastErr;
    for (const client of CLIENTS) {
        try {
            const info = await youtubedl(`ytsearch1:${query}`, ytdlpOpts(client, {
                dumpSingleJson: true,
                skipDownload: true,
                format: 'best'
            }));
            console.log(`[SEARCH] ✅ ${client}: ${info.webpage_url}`);
            return {
                url: info.webpage_url,
                duration: info.duration || 0,
                title: info.title
            };
        } catch (e) {
            lastErr = e;
            console.error(`[SEARCH] ❌ ${client}: ${e.message}`);
            if (!isBotErr(e)) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw lastErr;
}

// ==== DOWNLOAD ====
async function download(url, platform, title = null) {
    let baseName = title ? sanitize(title) : uuidv4();
    if (!baseName) baseName = uuidv4();

    const prefix = getUniquePrefix(baseName);
    const out = path.join(path.resolve(DIR), `${prefix}.%(ext)s`);

    console.log(`[DL] Output template: ${out}`);

    let lastErr;
    for (const client of CLIENTS) {
        try {
            console.log(`[DL] ${client} → ${url}`);
            await youtubedl(url, ytdlpOpts(client, {
                output: out,
                format: 'bestaudio/bestaudio*/best*[acodec!=none]/best',
                extractAudio: true,
                audioFormat: 'wav',
                audioQuality: 0
            }));

            const files = fs.readdirSync(DIR);
            const f = files.find(x => x.startsWith(`${prefix}.`));
            if (!f) {
                console.error(`[DL] File nggak ketemu. Files di DIR:`, files);
                throw new Error('File nggak ketemu.');
            }
            console.log(`[DL] ✅ ${client}: ${f}`);
            return { filePath: path.join(DIR, f), client };
        } catch (e) {
            lastErr = e;
            console.error(`[DL] ❌ ${client}: ${e.message}`);
            for (const x of fs.readdirSync(DIR).filter(y => y.startsWith(`${prefix}.`))) {
                try { fs.unlinkSync(path.join(DIR, x)); } catch {}
            }
            if (!isBotErr(e)) throw e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastErr;
}

// ==== CONVERT ====
function convert(input, format, speed = 1.0, amplifyDb = 0, options = {}) {
    return new Promise((resolve, reject) => {
        const fmt = FORMATS[format];
        const base = options.outputBase || path.basename(input, path.extname(input));
        const speedTag = speed !== 1.0 ? `_${speed}x` : '';
        const ampTag = amplifyDb !== 0 ? `_${amplifyDb}dB` : '';
        const out = path.join(DIR, `${base}${speedTag}${ampTag}.${fmt.ext}`);

        const stderrLines = [];
        let commandLine = '';
        const cmd = ffmpeg(input).noVideo();
        const filters = [];

        if (options.normalize) filters.push('dynaudnorm=f=150:g=15');
        if (options.removeSilence) filters.push('silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-45dB');

        if (speed !== 1.0) {
            // rubberband: phase vocoder dengan transient detection
            // jauh lebih jernih dari atempo di speed tinggi (2x, 2.3x, 3x)
            // pitch=1.0 → pitch tidak ikut naik (pure time-stretch)
            // transients=crisp → drum/perkusi tetap tajam
            // detector=compound → deteksi transient lebih akurat
            // phase=laminar → phase konsisten, kurangi artifak "phasiness"
            // formant=shifted → suara vokal lebih natural di speed tinggi
            // channels=apart → tiap channel diproses independen, lebih stereo
            filters.push(`rubberband=tempo=${speed.toFixed(3)}:pitch=1.0:transients=crisp:detector=compound:phase=laminar:formant=shifted:channels=apart`);
        }

        if (amplifyDb !== 0) {
            const vol = Math.pow(10, amplifyDb / 20).toFixed(4);
            filters.push(`volume=${vol}`);
        }

        if (filters.length > 0) cmd.audioFilters(filters);

        cmd.format(fmt.container || fmt.ext);
        if (fmt.codec) cmd.audioCodec(fmt.codec);
        if (fmt.bitrate) cmd.audioBitrate(fmt.bitrate);

          cmd.on('start', command => { commandLine = command; })
              .on('end', () => resolve(out))
              .on('stderr', line => {
                if (line.trim()) stderrLines.push(line.trim());
              })
              .on('error', error => {
                  const relevant = stderrLines.filter(line => /error|failed|invalid|not available|unable|unknown/i.test(line)).slice(-4);
                  error.message = `${error.message}${relevant.length ? `\nFFmpeg: ${relevant.join(' | ')}` : ''}${commandLine ? `\nCommand: ${commandLine}` : ''}`;
                    reject(error);
              })
           .save(out);
    });
}

// ============================================================
// API ROUTES
// ============================================================

app.post('/api/detect', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL wajib.' });

    const platform = detect(url);
    if (!platform) return res.status(400).json({
        error: 'Platform nggak dikenali. Support: YouTube, SoundCloud, TikTok, Spotify, Apple Music'
    });

    try {
        const meta = await getMeta(url, platform);
        console.log(`[DETECT] ✅ ${platform}:`, meta);
        res.json({
            success: true,
            platform,
            title: meta.title,
            artist: meta.artist,
            duration: meta.duration,
            thumbnail: meta.thumbnail,
            formats: Object.keys(FORMATS)
        });
    } catch (e) {
        console.error(`[DETECT] ❌ ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/convert', upload.single('file'), async (req, res) => {
    const { url, format, speed, amplify, normalize, removeSilence } = req.body;
    const uploadedFile = req.file;
    if ((!url && !uploadedFile) || !format) return res.status(400).json({ error: 'URL atau file audio dan format wajib.' });
    if (!FORMATS[format]) return res.status(400).json({ error: `Format "${format}" nggak didukung.` });

    const speedNum = parseFloat(speed) || 1.0;
    if (speedNum < 0.5 || speedNum > 3.0) {
        return res.status(400).json({ error: 'Speed harus antara 0.5 dan 3.0' });
    }

    const amplifyNum = parseFloat(amplify) || 0;
    if (amplifyNum < -20 || amplifyNum > 10) {
        return res.status(400).json({ error: 'Amplify harus antara -20 dB dan +10 dB' });
    }

    const platform = uploadedFile ? 'upload' : detect(url);
    if (!platform) return res.status(400).json({ error: 'Platform nggak dikenali.' });

    try {
        let meta;
        let sourcePath;
        let sourceClient = 'upload';
        let outputBase;

        if (uploadedFile) {
            const probe = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(uploadedFile.path, (error, data) => error ? reject(error) : resolve(data));
            });
            const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio');
            meta = {
                title: path.parse(uploadedFile.originalname).name || 'Uploaded audio',
                artist: 'Local upload',
                duration: fmtDur(Number(probe.format?.duration || audioStream?.duration || 0)),
                thumbnail: null
            };
            sourcePath = uploadedFile.path;
            outputBase = getUniquePrefix(sanitize(path.parse(uploadedFile.originalname).name));
            console.log(`[CONVERT] Uploaded file:`, meta);
        } else {
            meta = await getMeta(url, platform);
            console.log(`[CONVERT] Meta:`, meta);

            let target = url;
            let duration = meta.duration;

            if (platform === 'spotify' || platform === 'applemusic') {
                const query = meta.search_query || `${meta.title} ${meta.artist}`.trim();
                if (!query || query === ' ') throw new Error('Metadata kosong, nggak bisa search YouTube.');
                const searchResult = await ytSearch(query);
                target = searchResult.url;
                console.log(`[RESOLVE] ${platform} → ${target}`);
                if ((!duration || duration === '0:00') && searchResult.duration) duration = fmtDur(searchResult.duration);
            }

            const fileTitle = (platform === 'spotify' || platform === 'applemusic') && meta.artist && meta.artist !== 'Unknown'
                ? `${meta.artist} - ${meta.title}`
                : meta.title;
            const dl = await download(target, platform, fileTitle);
            sourcePath = dl.filePath;
            sourceClient = dl.client;
            meta = { ...meta, duration };
        }

        const converted = await convert(sourcePath, format, speedNum, amplifyNum, {
            normalize: Boolean(normalize),
            removeSilence: Boolean(removeSilence),
            outputBase
        });

        try { fs.unlinkSync(sourcePath); } catch {}

        const name = path.basename(converted);
        const size = fs.statSync(converted).size;

        const playbackNormal = speedNum !== 1.0 ? (1 / speedNum) : 1.0;

        res.json({
            success: true,
            platform,
            format,
            speed: speedNum,
            amplify: amplifyNum,
            playback_speed_normal: parseFloat(playbackNormal.toFixed(4)),
            title: meta.title,
            artist: meta.artist,
            duration: meta.duration,
            thumbnail: meta.thumbnail,
            client_used: sourceClient,
            file: {
                name,
                size_mb: (size / 1024 / 1024).toFixed(2),
                // ⚡ Encode URL biar karakter aneh nggak bikin masalah di browser
                url: `/downloads/${encodeURIComponent(name)}`
            }
        });
    } catch (e) {
        console.error(`[ERR] ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/formats', (req, res) => {
    res.json({ formats: Object.keys(FORMATS) });
});

app.get('/api/health', async (req, res) => {
    res.json({
        status: 'ok',
        mode: 'NO_COOKIES (POT via EJS)',
        yt_clients: CLIENTS,
        deno_exists: fs.existsSync(DENO_PATH),
        deno_path: DENO_PATH
    });
});

// ============================================================
// ROBLOX VALIDATION
// ============================================================

app.post('/api/roblox/validate-user', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ valid: false, error: 'user_id wajib.' });

    if (!/^\d+$/.test(String(user_id))) {
        return res.json({ valid: false, error: 'User ID harus angka.' });
    }

    try {
        const r = await axios.get(`https://users.roblox.com/v1/users/${user_id}`, { timeout: 10000 });
        res.json({
            valid: true,
            type: 'user',
            id: r.data.id,
            name: r.data.name,
            displayName: r.data.displayName,
            created: r.data.created
        });
    } catch (err) {
        if (err.response?.status === 404) {
            return res.json({ valid: false, error: `User ID ${user_id} nggak ada di Roblox.` });
        }
        res.json({ valid: false, error: err.message });
    }
});

app.post('/api/roblox/validate-group', async (req, res) => {
    const { group_id } = req.body;
    if (!group_id) return res.status(400).json({ valid: false, error: 'group_id wajib.' });

    if (!/^\d+$/.test(String(group_id))) {
        return res.json({ valid: false, error: 'Group ID harus angka.' });
    }

    try {
        const r = await axios.get(`https://groups.roblox.com/v1/groups/${group_id}`, { timeout: 10000 });
        res.json({
            valid: true,
            type: 'group',
            id: r.data.id,
            name: r.data.name,
            description: r.data.description,
            memberCount: r.data.memberCount
        });
    } catch (err) {
        if (err.response?.status === 404) {
            return res.json({ valid: false, error: `Group ID ${group_id} nggak ada di Roblox.` });
        }
        res.json({ valid: false, error: err.message });
    }
});

app.post('/api/roblox/validate-key', async (req, res) => {
    const { api_key } = req.body;
    if (!api_key) return res.status(400).json({ valid: false, error: 'API key wajib.' });

    if (api_key.length < 50) {
        return res.json({ valid: false, error: 'Format API key kependekan.' });
    }

    try {
        await axios.get('https://apis.roblox.com/assets/v1/assets?limit=1', {
            headers: { 'x-api-key': api_key },
            timeout: 10000
        });
        res.json({ valid: true, message: 'API key valid.' });
    } catch (err) {
        const status = err.response?.status;
        if (status === 401) {
            return res.json({ valid: false, error: 'API key invalid (401 Unauthorized).' });
        }
        if (status === 403) {
            return res.json({ valid: true, message: 'API key valid (tapi cek permission asset:write).' });
        }
        res.json({ valid: true, message: 'API key format OK.' });
    }
});

// ============================================================
// ROBLOX PUBLISH
// ============================================================
app.post('/api/publish-roblox', async (req, res) => {
    const { file_url, name, description, api_key, creator_type, creator_id } = req.body;

    if (!file_url) return res.status(400).json({ success: false, error: 'file_url wajib.' });
    if (!api_key) return res.status(400).json({ success: false, error: 'API key wajib.' });
    if (!creator_id) return res.status(400).json({ success: false, error: 'Creator ID wajib.' });
    if (!['user', 'group'].includes(creator_type)) {
        return res.status(400).json({ success: false, error: 'creator_type harus "user" atau "group".' });
    }

    // file_url bisa jadi encoded — decode dulu
    let decodedName;
    try {
        decodedName = decodeURIComponent(path.basename(file_url));
    } catch {
        decodedName = path.basename(file_url);
    }
    const filePath = path.join(DIR, decodedName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File nggak ketemu di server.' });
    }

    try {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(decodedName).toLowerCase().replace('.', '');

        const ROBLOX_AUDIO_FORMATS = ['mp3', 'ogg', 'wav', 'flac'];
        if (!ROBLOX_AUDIO_FORMATS.includes(ext)) {
            return res.status(400).json({
                success: false,
                error: `Format .${ext} nggak didukung Roblox. Pake: ${ROBLOX_AUDIO_FORMATS.join(', ')}`
            });
        }

        const form = new FormData();

        const rawName = name || path.basename(decodedName, path.extname(decodedName));
        const displayName = sanitizeAssetName(rawName);

        if (!displayName || displayName.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Display name minimal 3 karakter.'
            });
        }

        const rawDesc = description || 'Uploaded via Audio Converter API';
        const finalDesc = String(rawDesc).slice(0, 1000);

        const payload = {
            assetType: 'Audio',
            displayName: displayName,
            description: finalDesc,
            creationContext: creator_type === 'group'
                ? { creator: { groupId: String(creator_id) } }
                : { creator: { userId: String(creator_id) } }
        };

        form.append('request', JSON.stringify(payload), { contentType: 'application/json' });
        form.append('fileContent', fileBuffer, {
            filename: decodedName,
            contentType: ext === 'mp3' ? 'audio/mpeg' :
                        ext === 'ogg' ? 'audio/ogg' :
                        ext === 'wav' ? 'audio/wav' :
                        'audio/flac'
        });

        console.log(`[ROBLOX] Uploading "${displayName}" (${displayName.length} chars, desc ${finalDesc.length} chars)...`);

        const robloxRes = await axios.post(
            'https://apis.roblox.com/assets/v1/assets',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'x-api-key': api_key
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 60000
            }
        );

        console.log(`[ROBLOX] ✅ Success:`, robloxRes.data);

        res.json({
            success: true,
            message: 'Upload ke Roblox berhasil!',
            roblox_response: robloxRes.data,
            operation_id: robloxRes.data?.operationId || null,
            display_name_used: displayName,
            description_used: finalDesc,
            note: 'Cek status di: https://create.roblox.com/dashboard/creations'
        });

    } catch (err) {
        console.error(`[ROBLOX] ❌`, err.response?.data || err.message);

        const errData = err.response?.data;
        const status = err.response?.status || 500;

        let customError = errData?.message || err.message;
        if (customError?.includes('name length is invalid')) {
            customError = 'Nama asset kepanjangan. Roblox max 50 karakter.';
        }

        res.status(status).json({
            success: false,
            error: customError,
            roblox_error: errData || null,
            hint: status === 401
                ? 'API key salah atau nggak ada permission asset:write.'
                : status === 403
                ? 'API key nggak punya akses ke creator ID ini, atau IP lu nggak di-whitelist.'
                : status === 429
                ? 'Rate limit. Coba lagi nanti.'
                : 'Cek dokumentasi: https://create.roblox.com/docs/cloud/open-cloud/asset-api',
            manual_url: 'https://create.roblox.com/dashboard/creations'
        });
    }
});

// ============================================================
// ROBLOX CHECK STATUS
// ============================================================
app.post('/api/roblox/check-status', async (req, res) => {
    const { operation_id, api_key } = req.body;

    if (!operation_id) return res.status(400).json({ success: false, error: 'operation_id wajib.' });
    if (!api_key) return res.status(400).json({ success: false, error: 'api_key wajib.' });

    try {
        const r = await axios.get(
            `https://apis.roblox.com/assets/v1/operations/${operation_id}`,
            {
                headers: { 'x-api-key': api_key },
                timeout: 10000
            }
        );

        const data = r.data;

        let result = {
            success: true,
            done: data.done === true,
            operation_id
        };

        if (data.done && data.response) {
            result.asset_id = data.response.assetId || null;
            result.asset_type = data.response.assetType || null;
            result.message = '✅ Upload selesai diproses!';

            if (result.asset_id) {
                result.store_url = `https://create.roblox.com/store/asset/${result.asset_id}`;
                result.dashboard_url = `https://create.roblox.com/dashboard/creations`;
            }
        } else {
            result.message = '⏳ Masih diproses Roblox...';
            result.metadata = data.metadata || null;
        }

        res.json(result);

    } catch (err) {
        const status = err.response?.status || 500;
        const errMsg = err.response?.data?.message || err.message;

        res.status(status).json({
            success: false,
            error: errMsg,
            hint: status === 404
                ? 'Operation ID nggak ketemu, atau udah kadaluarsa.'
                : status === 401
                ? 'API key invalid.'
                : 'Cek log server.'
        });
    }
});

// ============================================================
// BULK ZIP DOWNLOAD
// ============================================================
app.post('/api/bulk-zip', (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array wajib.' });
    }

    const resolvedFiles = files.map(f => {
        const decodedName = decodeURIComponent(path.basename(f));
        return { name: decodedName, filePath: path.join(DIR, decodedName) };
    }).filter(f => fs.existsSync(f.filePath));

    if (resolvedFiles.length === 0) {
        return res.status(404).json({ error: 'Tidak ada file yang ditemukan.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="audio-batch.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => {
        console.error('[ZIP] Error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(res);
    for (const f of resolvedFiles) {
        archive.file(f.filePath, { name: f.name });
    }
    archive.finalize();
});

// ============================================================
// SHARE LINKS — generate a short-lived share token
// ============================================================
const shareTokens = new Map(); // token → { fileName, expiresAt }

// Clean up expired share tokens every 15 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of shareTokens.entries()) {
        if (now > data.expiresAt) shareTokens.delete(token);
    }
}, 900000);

app.post('/api/share', (req, res) => {
    const { file_url } = req.body;
    if (!file_url) return res.status(400).json({ error: 'file_url wajib.' });

    const decodedName = decodeURIComponent(path.basename(file_url));
    const filePath = path.join(DIR, decodedName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File tidak ditemukan di server.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour
    shareTokens.set(token, { fileName: decodedName, expiresAt });

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    res.json({
        success: true,
        share_url: `${protocol}://${host}/share/${token}`,
        expires_in: '1 hour'
    });
});

app.get('/share/:token', (req, res) => {
    const data = shareTokens.get(req.params.token);
    if (!data) return res.status(404).send('Link ini sudah kadaluarsa atau tidak valid.');
    if (Date.now() > data.expiresAt) {
        shareTokens.delete(req.params.token);
        return res.status(410).send('Link ini sudah kadaluarsa.');
    }
    const filePath = path.join(DIR, data.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).send('File sudah tidak tersedia.');
    res.download(filePath, data.fileName);
});

// ============================================================
// SERVER-SIDE HISTORY SYNC — PostgreSQL + file fallback
// ============================================================
const HISTORY_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);

function historyFile(userId) {
    return path.join(HISTORY_DIR, `history_${userId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}
function readHistoryFile(userId) {
    try {
        const f = historyFile(userId);
        if (!fs.existsSync(f)) return [];
        return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch { return []; }
}
function writeHistoryFile(userId, history) {
    try { fs.writeFileSync(historyFile(userId), JSON.stringify(history), 'utf8'); } catch {}
}

app.get('/api/history', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated.' });
    const userId = session.user.id;
    try {
        if (db) {
            const result = await db.query('SELECT history FROM user_history WHERE user_id = $1', [userId]);
            return res.json({ history: result.rows[0]?.history || [] });
        }
        res.json({ history: readHistoryFile(userId) });
    } catch (err) {
        console.error('[HISTORY GET]', err.message);
        res.json({ history: readHistoryFile(userId) });
    }
});

app.post('/api/history', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated.' });
    const userId = session.user.id;
    const { history } = req.body;
    if (!Array.isArray(history)) return res.status(400).json({ error: 'history must be an array.' });
    const trimmed = history.slice(0, 100);
    try {
        if (db) {
            await db.query(`
                INSERT INTO user_history (user_id, history, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET history = $2, updated_at = NOW()
            `, [userId, JSON.stringify(trimmed)]);
            return res.json({ success: true });
        }
        writeHistoryFile(userId, trimmed);
        res.json({ success: true });
    } catch (err) {
        console.error('[HISTORY POST]', err.message);
        writeHistoryFile(userId, trimmed);
        res.json({ success: true });
    }
});

app.delete('/api/history', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated.' });
    const userId = session.user.id;
    try {
        if (db) await db.query('DELETE FROM user_history WHERE user_id = $1', [userId]);
        try { fs.unlinkSync(historyFile(userId)); } catch {}
        res.json({ success: true });
    } catch (err) {
        console.error('[HISTORY DELETE]', err.message);
        res.json({ success: true });
    }
});

// ==== ROBLOX SETTINGS SYNC ====
app.get('/api/roblox-settings', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated.' });
    try {
        if (db) {
            const result = await db.query('SELECT settings FROM user_roblox_settings WHERE user_id = $1', [session.user.id]);
            return res.json({ settings: result.rows[0]?.settings || null });
        }
        res.json({ settings: null });
    } catch { res.json({ settings: null }); }
});

app.post('/api/roblox-settings', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated.' });
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings wajib.' });
    try {
        if (db) {
            await db.query(`
                INSERT INTO user_roblox_settings (user_id, settings, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET settings = $2, updated_at = NOW()
            `, [session.user.id, JSON.stringify(settings)]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[ROBLOX SETTINGS POST]', err.message);
        res.json({ success: true });
    }
});

// SPA fallback: allow direct refreshes on React routes such as /converter.
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/downloads/')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setInterval(() => {
    for (const f of fs.readdirSync(DIR)) {
        const fp = path.join(DIR, f);
        try {
            if (Date.now() - fs.statSync(fp).mtimeMs > 3600000) fs.unlinkSync(fp);
        } catch {}
    }
}, 600000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎵 Audio Converter Web`);
    console.log(`   Mode: NO COOKIES (POT via EJS)`);
    console.log(`   Buka: http://0.0.0.0:${PORT}\n`);
});