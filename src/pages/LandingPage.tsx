import { useEffect, useRef, useState } from 'react';
import { startDiscordLogin } from '../services/discord';

// ── Typewriter hero card ─────────────────────────────────────
type Token = [string, string]; // [text, cssClass]
type CodeLine = Token[];

interface Slide {
  index: string;   // e.g. "1/10"
  label: string;   // e.g. "Audio Convert"
  file: string;    // e.g. "converter.ts"
  lines: CodeLine[];
}

const SLIDES: Slide[] = [
  {
    index: '1/10', label: 'Audio Convert', file: 'converter.ts',
    lines: [
      [['const ', 'lhc-k'], ['result ', 'lhc-v'], ['= await ', 'lhc-p'], ['convert', 'lhc-fn'], ['({', 'lhc-p']],
      [['  url', 'lhc-prop'], [': ', 'lhc-p'], ['"spotify.com/track/…"', 'lhc-str'], [',', 'lhc-p']],
      [['  format', 'lhc-prop'], [': ', 'lhc-p'], ['"ogg"', 'lhc-str'], [',', 'lhc-p']],
      [['  speed', 'lhc-prop'], [': ', 'lhc-p'], ['2.3', 'lhc-num'], [',', 'lhc-p']],
      [['  normalize', 'lhc-prop'], [': ', 'lhc-p'], ['true', 'lhc-k']],
      [['});', 'lhc-p']],
      [['// ✅ Ready to publish', 'lhc-comment']],
      [['await ', 'lhc-k'], ['publishToRoblox', 'lhc-fn'], ['(result);', 'lhc-p']],
    ],
  },
  {
    index: '2/10', label: 'Roblox Publish', file: 'publishAsset.ts',
    lines: [
      [['const ', 'lhc-k'], ['asset ', 'lhc-v'], ['= {', 'lhc-p']],
      [['  name', 'lhc-prop'], [': ', 'lhc-p'], ['"MyGame_BGM"', 'lhc-str'], [',', 'lhc-p']],
      [['  creatorType', 'lhc-prop'], [': ', 'lhc-p'], ['"user"', 'lhc-str'], [',', 'lhc-p']],
      [['  creatorId', 'lhc-prop'], [': ', 'lhc-p'], ['123456789', 'lhc-num']],
      [['};', 'lhc-p']],
      [['// 🚀 Uploading to Roblox...', 'lhc-comment']],
      [['const ', 'lhc-k'], ['op ', 'lhc-v'], ['= await ', 'lhc-p'], ['publish', 'lhc-fn'], ['(asset);', 'lhc-p']],
      [['console', 'lhc-v'], ['.', 'lhc-p'], ['log', 'lhc-fn'], ['(op.operationId);', 'lhc-p']],
    ],
  },
  {
    index: '3/10', label: 'Bulk Convert', file: 'bulkConvert.ts',
    lines: [
      [['const ', 'lhc-k'], ['files ', 'lhc-v'], ['= [', 'lhc-p'], ['"track1.mp3"', 'lhc-str'], [',', 'lhc-p']],
      [['           ', 'lhc-p'], ['"track2.wav"', 'lhc-str'], [',', 'lhc-p'], ['"track3.ogg"', 'lhc-str'], ['];', 'lhc-p']],
      [['for ', 'lhc-k'], ['(const ', 'lhc-k'], ['f ', 'lhc-v'], ['of ', 'lhc-k'], ['files) {', 'lhc-p']],
      [['  await ', 'lhc-p'], ['convert', 'lhc-fn'], ['(f, { format: ', 'lhc-p'], ['"ogg"', 'lhc-str'], [' });', 'lhc-p']],
      [['}', 'lhc-p']],
      [['// ✅ 3 files converted', 'lhc-comment']],
      [['await ', 'lhc-k'], ['downloadZip', 'lhc-fn'], ['(results);', 'lhc-p']],
    ],
  },
  {
    index: '4/10', label: 'Speed Adjust', file: 'speedUp.ts',
    lines: [
      [['// 🎵 Speed up with rubberband', 'lhc-comment']],
      [['const ', 'lhc-k'], ['opts ', 'lhc-v'], ['= {', 'lhc-p']],
      [['  speed', 'lhc-prop'], [': ', 'lhc-p'], ['2.3', 'lhc-num'], [',', 'lhc-p']],
      [['  amplify', 'lhc-prop'], [': ', 'lhc-p'], ['-2', 'lhc-num'], [',  ', 'lhc-p'], ['// dB', 'lhc-comment']],
      [['  normalize', 'lhc-prop'], [': ', 'lhc-p'], ['true', 'lhc-k'], [',', 'lhc-p']],
      [['  removeSilence', 'lhc-prop'], [': ', 'lhc-p'], ['false', 'lhc-k']],
      [['};', 'lhc-p']],
      [['// No crackle, no pitch shift ✓', 'lhc-comment']],
    ],
  },
  {
    index: '5/10', label: 'Share Link', file: 'shareLink.ts',
    lines: [
      [['// 🔗 Generate 1-hour share link', 'lhc-comment']],
      [['const ', 'lhc-k'], ['res ', 'lhc-v'], ['= await ', 'lhc-p'], ['fetch', 'lhc-fn'], ['(', 'lhc-p'], ['"/api/share"', 'lhc-str'], [', {', 'lhc-p']],
      [['  method', 'lhc-prop'], [': ', 'lhc-p'], ['"POST"', 'lhc-str'], [',', 'lhc-p']],
      [['  body', 'lhc-prop'], [': ', 'lhc-p'], ['JSON.stringify', 'lhc-fn'], ['({ file_url })', 'lhc-p']],
      [['});', 'lhc-p']],
      [['const ', 'lhc-k'], ['{ share_url } ', 'lhc-v'], ['= await ', 'lhc-p'], ['res.json', 'lhc-fn'], ['();', 'lhc-p']],
      [['// → https://3zane.up.railway.app/share/a3f9…', 'lhc-comment']],
    ],
  },
  {
    index: '6/10', label: 'Platform Detect', file: 'detectPlatform.ts',
    lines: [
      [['function ', 'lhc-k'], ['detect', 'lhc-fn'], ['(url: ', 'lhc-p'], ['string', 'lhc-k'], [') {', 'lhc-p']],
      [['  if ', 'lhc-k'], ['(url.includes(', 'lhc-p'], ['"youtube"', 'lhc-str'], ['))', 'lhc-p'], ['  return ', 'lhc-k'], ['"youtube"', 'lhc-str'], [';', 'lhc-p']],
      [['  if ', 'lhc-k'], ['(url.includes(', 'lhc-p'], ['"spotify"', 'lhc-str'], ['))', 'lhc-p'], ['  return ', 'lhc-k'], ['"spotify"', 'lhc-str'], [';', 'lhc-p']],
      [['  if ', 'lhc-k'], ['(url.includes(', 'lhc-p'], ['"tiktok"', 'lhc-str'], ['))', 'lhc-p'], ['   return ', 'lhc-k'], ['"tiktok"', 'lhc-str'], [';', 'lhc-p']],
      [['  return ', 'lhc-k'], ['null', 'lhc-num'], [';', 'lhc-p']],
      [['}', 'lhc-p']],
      [['// ✓ 5 platforms supported', 'lhc-comment']],
    ],
  },
  {
    index: '7/10', label: 'Audio Metadata', file: 'getMeta.ts',
    lines: [
      [['const ', 'lhc-k'], ['meta ', 'lhc-v'], ['= await ', 'lhc-p'], ['getMeta', 'lhc-fn'], ['(url);', 'lhc-p']],
      [['// → {', 'lhc-comment']],
      [['//   title  : ', 'lhc-comment'], ['"Tak Ingin Usai"', 'lhc-str']],
      [['//   artist : ', 'lhc-comment'], ['"Keisya Levronka"', 'lhc-str']],
      [['//   duration: ', 'lhc-comment'], ['"4:58"', 'lhc-str']],
      [['//   thumb  : ', 'lhc-comment'], ['"i.ytimg.com/…"', 'lhc-str']],
      [['// }', 'lhc-comment']],
      [['setMeta', 'lhc-fn'], ['(meta);', 'lhc-p']],
    ],
  },
  {
    index: '8/10', label: 'History Sync', file: 'historySync.ts',
    lines: [
      [['// 💾 Sync history to server', 'lhc-comment']],
      [['await ', 'lhc-p'], ['fetch', 'lhc-fn'], ['(', 'lhc-p'], ['"/api/history"', 'lhc-str'], [', {', 'lhc-p']],
      [['  method', 'lhc-prop'], [': ', 'lhc-p'], ['"POST"', 'lhc-str'], [',', 'lhc-p']],
      [['  body', 'lhc-prop'], [': ', 'lhc-p'], ['JSON.stringify', 'lhc-fn'], ['({ history }),', 'lhc-p']],
      [['});', 'lhc-p']],
      [['// Synced across all devices ✓', 'lhc-comment']],
      [['const ', 'lhc-k'], ['items ', 'lhc-v'], ['= history.slice(', 'lhc-p'], ['0', 'lhc-num'], [', ', 'lhc-p'], ['50', 'lhc-num'], [');', 'lhc-p']],
    ],
  },
  {
    index: '9/10', label: 'Format Options', file: 'formats.ts',
    lines: [
      [['const ', 'lhc-k'], ['FORMATS ', 'lhc-v'], ['= {', 'lhc-p']],
      [['  mp3', 'lhc-prop'],  [': { bitrate: ', 'lhc-p'], ['"320k"', 'lhc-str'], [' },', 'lhc-p']],
      [['  ogg', 'lhc-prop'],  [': { bitrate: ', 'lhc-p'], ['"256k"', 'lhc-str'], [' },', 'lhc-p']],
      [['  flac', 'lhc-prop'], [': { lossless: ', 'lhc-p'], ['true', 'lhc-k'], [' },', 'lhc-p']],
      [['  wav', 'lhc-prop'],  [': { codec: ', 'lhc-p'], ['"pcm_s16le"', 'lhc-str'], [' }', 'lhc-p']],
      [['};', 'lhc-p']],
      [['// Roblox ✓: mp3, ogg, wav, flac', 'lhc-comment']],
    ],
  },
  {
    index: '10/10', label: 'Waveform Player', file: 'audioPlayer.ts',
    lines: [
      [['// 🎛 Web Audio API waveform', 'lhc-comment']],
      [['const ', 'lhc-k'], ['ctx ', 'lhc-v'], ['= new ', 'lhc-p'], ['AudioContext', 'lhc-fn'], ['();', 'lhc-p']],
      [['const ', 'lhc-k'], ['analyser ', 'lhc-v'], ['= ctx.createAnalyser', 'lhc-fn'], ['();', 'lhc-p']],
      [['analyser.fftSize ', 'lhc-v'], ['= ', 'lhc-p'], ['256', 'lhc-num'], [';', 'lhc-p']],
      [['source.connect', 'lhc-fn'], ['(analyser);', 'lhc-p']],
      [['analyser.connect', 'lhc-fn'], ['(ctx.destination);', 'lhc-p']],
      [['// ▶ Visualizer running ✓', 'lhc-comment']],
    ],
  },
];

interface Char { char: string; cls: string; }

function buildChars(lines: CodeLine[]): Char[] {
  const chars: Char[] = [];
  lines.forEach((line, li) => {
    line.forEach(([text, cls]) => {
      for (const char of text) chars.push({ char, cls });
    });
    if (li < lines.length - 1) chars.push({ char: '\n', cls: '' });
  });
  return chars;
}

const CHAR_DELAY = 36;
const LINE_PAUSE = 160;
const SLIDE_PAUSE = 2200;

// Pre-build all slide chars once at module level
const SLIDES_CHARS = SLIDES.map((s) => buildChars(s.lines));

function TypewriterCard() {
  const [slideIdx, setSlideIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = SLIDES[slideIdx];
  const slideChars = SLIDES_CHARS[slideIdx];

  useEffect(() => {
    let cancelled = false;
    let count = 0;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset dulu sebelum mulai slide baru
    setVisibleCount(0);

    function typeNext() {
      if (cancelled) return;
      const chars = SLIDES_CHARS[slideIdx];
      if (!chars || count >= chars.length) {
        // Selesai — tunggu lalu lanjut ke slide berikutnya
        timerRef.current = setTimeout(() => {
          if (!cancelled) setSlideIdx((i) => (i + 1) % SLIDES.length);
        }, SLIDE_PAUSE);
        return;
      }
      const ch = chars[count];
      count++;
      setVisibleCount(count);
      timerRef.current = setTimeout(typeNext, CHAR_DELAY + (ch.char === '\n' ? LINE_PAUSE : 0));
    }

    timerRef.current = setTimeout(typeNext, 80);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIdx]);

  useEffect(() => {
    const t = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(t);
  }, []);

  // Build rendered lines — clamp visibleCount to current slide length
  const safeCount = Math.min(visibleCount, slideChars.length);
  const rendered: { tokens: { text: string; cls: string }[] }[] = [{ tokens: [] }];
  let li = 0;
  for (let i = 0; i < safeCount; i++) {
    const ch = slideChars[i];
    if (!ch) break;
    const { char, cls } = ch;
    if (char === '\n') {
      li++;
      if (!rendered[li]) rendered[li] = { tokens: [] };
    } else {
      const line = rendered[li];
      const last = line.tokens[line.tokens.length - 1];
      if (last && last.cls === cls) last.text += char;
      else line.tokens.push({ text: char, cls });
    }
  }

  const totalLines = slide.lines.length;

  return (
    <div className="landing-hero-card" aria-hidden="true">
      <div className="lhc-titlebar">
        <span /><span /><span />
        <span className="lhc-slide-badge">{slide.index}</span>
        <span className="lhc-slide-label">{slide.label}</span>
        <span className="lhc-title">{slide.file}</span>
        <div className="lhc-nav">
          <button className="lhc-nav-btn" onClick={() => setSlideIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)}>‹</button>
          <button className="lhc-nav-btn" onClick={() => setSlideIdx((i) => (i + 1) % SLIDES.length)}>›</button>
        </div>
      </div>

      {/* ── Code body ── */}
      <div className="lhc-body">
        {rendered.map((line, idx) => (
          <div className="lhc-line" key={idx}>
            {line.tokens.map((tok, ti) => (
              <span key={ti} className={tok.cls}>{tok.text}</span>
            ))}
            {idx === rendered.length - 1 && (
              <span className="lhc-cursor" style={{ opacity: showCursor ? 1 : 0 }} />
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, totalLines - rendered.length) }).map((_, i) => (
          <div className="lhc-line lhc-placeholder" key={`ph-${i}`}>&nbsp;</div>
        ))}
      </div>

      {/* ── Dot indicators ── */}
      <div className="lhc-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`lhc-dot${i === slideIdx ? ' active' : ''}`}
            onClick={() => setSlideIdx(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Discord SVG icon ─────────────────────────────────────────
function DiscordIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" fill="currentColor" aria-hidden="true">
      <path d="M20.317 1.492a19.84 19.84 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 1.492a.07.07 0 0 0-.032.027C.533 6.093-.32 10.555.099 14.961a.08.08 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.442a.061.061 0 0 0-.031-.028z" />
    </svg>
  );
}

// ── Main landing page ────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="landing">

      {/* Topbar */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <span className="brand-mark">♫</span>
          <span className="landing-brand-name">3ZANE</span>
          <span className="landing-brand-sub">audio workspace</span>
        </div>
        <button className="landing-login-btn" onClick={startDiscordLogin}>
          <DiscordIcon />
          Login with Discord
        </button>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <span className="landing-eyebrow">⌘ Roblox Audio Workspace</span>
          <h1 className="landing-hero-title">
            Convert any audio.<br />
            <em>Publish to Roblox.</em>
          </h1>
          <p className="landing-hero-sub">
            Paste a YouTube, Spotify, SoundCloud, or TikTok link — get a Roblox-ready audio file in seconds.
            Speed up, amplify, normalize, and publish directly to your Roblox account without leaving the browser.
          </p>
          <div className="landing-cta-group">
            <button className="landing-cta-primary" onClick={startDiscordLogin}>
              <DiscordIcon />
              Get started — Login Discord
            </button>
            <span className="landing-cta-note">Free · No credit card needed</span>
          </div>
        </div>
        <TypewriterCard />
      </section>

      {/* Stats */}
      <div className="landing-stats">
        <div><strong>5</strong><span>Platforms supported</span></div>
        <div><strong>8</strong><span>Output formats</span></div>
        <div><strong>0.5–3×</strong><span>Speed range</span></div>
        <div><strong>100%</strong><span>Browser-based</span></div>
      </div>

      {/* Features */}
      <section className="landing-features">
        <div className="landing-section-label">
          <span className="landing-eyebrow">Platform capabilities</span>
          <h2>Everything You Need in One Workspace</h2>
          <p>3Zane combines audio conversion, quality processing, and direct Roblox publishing into one focused tool.</p>
        </div>
        <div className="landing-feature-grid">
          <div className="landing-feature-card">
            <div className="lfc-icon">♫</div>
            <h3>Multi-platform download</h3>
            <p>Paste a link from YouTube, Spotify, SoundCloud, TikTok, or Apple Music. 3Zane handles the rest.</p>
          </div>
          <div className="landing-feature-card">
            <div className="lfc-icon">⚙</div>
            <h3>High-quality speed change</h3>
            <p>Speed up to 2.3× using <strong>rubberband</strong> — a pro-grade phase vocoder. No crackle, no pitch shift.</p>
          </div>
          <div className="landing-feature-card">
            <div className="lfc-icon">⌘</div>
            <h3>Direct Roblox publishing</h3>
            <p>Save your API key once, then publish converted audio directly to your Roblox account with one click.</p>
          </div>
          <div className="landing-feature-card">
            <div className="lfc-icon">▱</div>
            <h3>Bulk conversion</h3>
            <p>Upload multiple files at once, apply global settings, and download everything as a single ZIP.</p>
          </div>
          <div className="landing-feature-card">
            <div className="lfc-icon">◉</div>
            <h3>Audio processing tools</h3>
            <p>Normalize volume, remove silence, amplify, and fine-tune — all processed server-side with FFmpeg.</p>
          </div>
          <div className="landing-feature-card">
            <div className="lfc-icon">🔗</div>
            <h3>Share links</h3>
            <p>Generate a temporary 1-hour share link for any converted file — share directly without downloading.</p>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="landing-platforms">
        <span className="landing-eyebrow">Supported sources</span>
        <div className="landing-platform-list">
          <span>▶ YouTube</span>
          <span>◎ SoundCloud</span>
          <span>✦ TikTok</span>
          <span>● Spotify</span>
          <span>⌘ Apple Music</span>
          <span>↑ Local upload</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-final-cta">
        <h2>Ready to convert?</h2>
        <p>Login with your Discord account to get started. Free, no setup required.</p>
        <button className="landing-cta-primary" onClick={startDiscordLogin}>
          <DiscordIcon />
          Login with Discord →
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span className="brand-mark" style={{ width: 24, height: 24, fontSize: 0 }}>♫</span>
        <span>3ZANE · audio workspace</span>
        <span className="landing-footer-sep">·</span>
        <span>Built for Roblox creators</span>
      </footer>

    </div>
  );
}
