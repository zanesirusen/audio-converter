import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { SiApple, SiSoundcloud, SiSpotify, SiTiktok, SiYoutube } from 'react-icons/si';
import { AudioPlayer } from '../../components/AudioPlayer';
import { DownloadButton } from '../../components/DownloadButton';
import { convertAudio, convertUploadedAudio, detectAudio, downloadUrl, type AudioMeta, type ConvertResult } from '../../services/api';
import { addHistory } from '../../stores/appStore';
import { usePresets, addPreset, removePreset } from '../../stores/presetsStore';
import { useRobloxSettings, isRobloxReady } from '../../stores/robloxSettingsStore';

const uploadFormats = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav', 'wma'];
type InputMode = 'url' | 'upload';

// Format metadata: badges and descriptions
const FORMAT_META: Record<string, { badge?: string; badgeClass?: string; title: string }> = {
  mp3:  { badge: 'Roblox ✓', badgeClass: 'badge-roblox', title: 'MP3 – 320kbps, universal' },
  ogg:  { badge: 'Roblox ✓', badgeClass: 'badge-roblox', title: 'OGG – 256kbps, Roblox ready' },
  wav:  { badge: 'Roblox ✓', badgeClass: 'badge-roblox', title: 'WAV – PCM lossless' },
  flac: { badge: 'Lossless', badgeClass: 'badge-lossless', title: 'FLAC – true lossless' },
  m4a:  { title: 'M4A – 256kbps, Apple' },
  aac:  { title: 'AAC – 256kbps' },
  opus: { title: 'OPUS – 192kbps, efficient' },
  wma:  { title: 'WMA – 192kbps, Windows' },
};

// Step-based loading states
const STEP_LABELS: Record<string, string> = {
  idle: 'Paste a link or upload an audio file to begin.',
  detecting: '🔍 Detecting metadata...',
  ready: 'Ready to convert.',
  downloading: '⬇ Downloading source audio...',
  converting: '⚙ Converting audio...',
  done: '✅ Conversion complete.',
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Animated placeholder for no-thumbnail uploads
function AudioPlaceholder() {
  return (
    <div className="audio-placeholder" aria-hidden="true">
      <span className="ap-bar" style={{ animationDelay: '0ms' }} />
      <span className="ap-bar" style={{ animationDelay: '80ms' }} />
      <span className="ap-bar" style={{ animationDelay: '160ms' }} />
      <span className="ap-bar" style={{ animationDelay: '240ms' }} />
      <span className="ap-bar" style={{ animationDelay: '120ms' }} />
    </div>
  );
}

export function ConverterPanel({ onGoToSettings }: { onGoToSettings?: () => void }) {
  const presets = usePresets();
  const robloxSettings = useRobloxSettings();
  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [urlDragOver, setUrlDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [format, setFormat] = useState('ogg');
  const [speed, setSpeed] = useState(2.3);
  const [amplify, setAmplify] = useState(-2);
  const [normalize, setNormalize] = useState(false);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [step, setStep] = useState<keyof typeof STEP_LABELS>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [copiedShare, setCopiedShare] = useState('');
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  // Per-file publish state: fileName → { status, msg }
  const [publishStates, setPublishStates] = useState<Record<string, { busy: boolean; msg: string; ok: boolean }>>({});

  const urlInputRef = useRef<HTMLInputElement>(null);

  function selectMode(nextMode: InputMode) {
    setMode(nextMode);
    setMeta(null);
    setFiles([]);
    setResults([]);
    setStep('idle');
    setErrorMsg('');
    // Reset ke default settings
    setFormat('ogg');
    setSpeed(2.3);
    setAmplify(-2);
  }

  // ── Drag-and-drop URL from browser ──────────────────────────
  function handleUrlDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setUrlDragOver(true);
  }
  function handleUrlDragLeave() { setUrlDragOver(false); }
  function handleUrlDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setUrlDragOver(false);
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text?.trim().startsWith('http')) {
      setUrl(text.trim());
      setMeta(null);
      setResults([]);
      setStep('idle');
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const invalid = selected.find(
      (item) => !item.type.startsWith('audio/') && !item.name.match(/\.(mp3|m4a|aac|ogg|opus|flac|wav|wma)$/i)
    );
    if (invalid) {
      setFiles([]);
      setMeta(null);
      setErrorMsg(`File tidak didukung: ${invalid.name}`);
      return;
    }
    setFiles(selected);
    setResults([]);
    setFormat('mp3');
    setErrorMsg('');
    setMeta({
      platform: 'upload',
      title: selected.length === 1 ? selected[0].name.replace(/\.[^.]+$/, '') : `${selected.length} audio files`,
      artist: 'Local upload',
      duration: 'Ready to inspect',
      thumbnail: null,
      formats: uploadFormats,
    });
    setStep('ready');
  }

  async function handleDetect() {
    if (!url.trim()) { setErrorMsg('Masukkan URL audio terlebih dahulu.'); return; }
    setBusy(true);
    setStep('detecting');
    setErrorMsg('');
    setResults([]);
    try {
      const data = await detectAudio(url.trim());
      setMeta(data);
      // Reset ke default Roblox-optimized settings setiap detect
      setFormat(data.formats.includes('ogg') ? 'ogg' : data.formats[0] || 'mp3');
      setSpeed(2.3);
      setAmplify(-2);
      setStep('ready');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Gagal membaca URL.');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }

  async function handleConvert() {
    if (mode === 'url' && !meta) { setErrorMsg('Detect URL terlebih dahulu.'); return; }
    if (mode === 'upload' && !files.length) { setErrorMsg('Pilih file audio terlebih dahulu.'); return; }
    setBusy(true);
    setErrorMsg('');
    const options = { format, speed, amplify, normalize, removeSilence };
    const converted: ConvertResult[] = [];
    try {
      if (mode === 'upload') {
        for (const [index, currentFile] of files.entries()) {
          setStep('converting');
          if (index === 0) setStep('converting');
          const data = await convertUploadedAudio(currentFile, options);
          converted.push(data);
          addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: downloadUrl(data.file.name) });
        }
      } else {
        setStep('downloading');
        // Give the UI a tick to render "downloading" before the long fetch
        await new Promise((r) => setTimeout(r, 50));
        setStep('converting');
        const data = await convertAudio({ url, ...options });
        converted.push(data);
        addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: downloadUrl(data.file.name) });
      }
      const last = converted[converted.length - 1];
      localStorage.setItem('3zane_last_result', JSON.stringify({
        fileUrl: downloadUrl(last.file.name),
        fileName: last.file.name,
        title: last.title,
        artist: last.artist,
        format: last.format,
      }));
      setResults(converted);
      setStep('done');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Conversion gagal.');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }

  // ── Share link ───────────────────────────────────────────────
  async function handleShare(fileName: string) {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: `/downloads/${encodeURIComponent(fileName)}` }),
      });
      const data = await res.json() as { share_url?: string; error?: string };
      if (data.share_url) {
        setShareUrls((prev) => ({ ...prev, [fileName]: data.share_url! }));
        await navigator.clipboard.writeText(data.share_url!);
        setCopiedShare(fileName);
        setTimeout(() => setCopiedShare(''), 3000);
      }
    } catch { /* silently ignore */ }
  }

  // ── Publish to Roblox ────────────────────────────────────────
  async function handlePublish(result: ConvertResult, navigateToSettings: () => void) {
    if (!isRobloxReady()) {
      navigateToSettings();
      return;
    }
    const { apiKey, creatorType, creatorId, defaultAssetName } = robloxSettings;
    const fileName = result.file.name;
    setPublishStates((prev) => ({ ...prev, [fileName]: { busy: true, msg: 'Uploading to Roblox…', ok: false } }));
    try {
      const assetName = defaultAssetName
        ? `${defaultAssetName}${result.title}`.slice(0, 50)
        : result.title.slice(0, 50);
      const res = await fetch('/api/publish-roblox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: `/downloads/${encodeURIComponent(fileName)}`,
          name: assetName,
          description: `Uploaded via 3Zane · ${result.artist || ''}`.trim(),
          api_key: apiKey,
          creator_type: creatorType,
          creator_id: creatorId,
        }),
      });
      const data = await res.json() as { success: boolean; operation_id?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Publish failed.');
      setPublishStates((prev) => ({
        ...prev,
        [fileName]: { busy: false, msg: `✅ Uploaded! Op ID: ${data.operation_id || 'processing'}`, ok: true },
      }));
    } catch (err) {
      setPublishStates((prev) => ({
        ...prev,
        [fileName]: { busy: false, msg: `✗ ${err instanceof Error ? err.message : 'Publish failed.'}`, ok: false },
      }));
    }
  }

  // ── Presets ──────────────────────────────────────────────────
  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setFormat(preset.format);
    setSpeed(preset.speed);
    setAmplify(preset.amplify);
    setNormalize(preset.normalize);
    setRemoveSilence(preset.removeSilence);
  }

  function handleSavePreset() {
    if (!presetName.trim()) return;
    addPreset({ name: presetName.trim(), format, speed, amplify, normalize, removeSilence });
    setPresetName('');
    setShowPresetSave(false);
  }

  function copyPlaybackSpeed() {
    void navigator.clipboard?.writeText((1 / speed).toFixed(4));
  }

  const playbackNormal = speed === 1 ? 1 : 1 / speed;

  const stepLabel = STEP_LABELS[step] ?? '';

  return (
    <section className="panel converter-panel" id="converter">
      {/* ── Header ── */}
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Audio converter</span>
          <h2>{mode === 'upload' ? 'Turn a file into sound.' : 'Turn a link into sound.'}</h2>
          <p className="muted">Convert, shape, preview, and keep every result in your history.</p>
        </div>
        <span className="live-badge"><span className="status-dot" /> Online</span>
      </div>

      {/* ── Mode tabs ── */}
      <div className="converter-modes" role="tablist" aria-label="Conversion source">
        <button className={mode === 'url' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'url'} onClick={() => selectMode('url')}>↗ Paste URL</button>
        <button className={mode === 'upload' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'upload'} onClick={() => selectMode('upload')}>↑ Upload file</button>
      </div>

      {/* ── URL input with drag-and-drop ── */}
      {mode === 'url' ? (
        <>
          <div
            className={`url-drop-zone${urlDragOver ? ' drag-over' : ''}`}
            onDragOver={handleUrlDragOver}
            onDragLeave={handleUrlDragLeave}
            onDrop={handleUrlDrop}
          >
            <div className="url-row">
              <input
                ref={urlInputRef}
                className="url-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleDetect()}
                placeholder="Paste or drag a link here…"
              />
              <button className="primary-button" onClick={() => void handleDetect()} disabled={busy}>
                {step === 'detecting' ? '...' : 'Detect'}
              </button>
            </div>
            {urlDragOver && <p className="url-drop-hint">Drop the link here ↓</p>}
          </div>
          <div className="platforms">
            <span><SiYoutube className="platform-icon youtube-icon" aria-hidden="true" />YouTube</span>
            <span><SiSoundcloud className="platform-icon soundcloud-icon" aria-hidden="true" />SoundCloud</span>
            <span><SiTiktok className="platform-icon tiktok-icon" aria-hidden="true" />TikTok</span>
            <span><SiSpotify className="platform-icon spotify-icon" aria-hidden="true" />Spotify</span>
            <span><SiApple className="platform-icon apple-icon" aria-hidden="true" />Apple Music</span>
          </div>
        </>
      ) : (
        <div className="upload-zone">
          <input id="audio-upload" type="file" accept="audio/*,.flac,.wav,.ogg,.opus" onChange={handleFileChange} />
          <label htmlFor="audio-upload">
            <span className="upload-icon">↑</span>
            <strong>{files.length ? 'Choose another audio file' : 'Drop an audio file here'}</strong>
            <span>MP3, WAV, M4A, OGG, OPUS, or FLAC up to 200 MB</span>
          </label>
          {files.length > 0 && (
            <div className="upload-file-list">
              {files.map((f) => (
                <div className="upload-file" key={`${f.name}-${f.lastModified}`}>
                  <span>♫</span>
                  <div><strong>{f.name}</strong><small>{formatFileSize(f.size)}</small></div>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => { setFiles([]); setResults([]); setMeta(null); setStep('idle'); }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Status / step indicator ── */}
      {(step !== 'idle' || errorMsg) && (
        <div className={`status-message${errorMsg ? ' error' : ''}`}>
          {errorMsg || stepLabel}
          {busy && step !== 'done' && (
            <span className="step-dots">
              <span /><span /><span />
            </span>
          )}
        </div>
      )}
      {!errorMsg && step === 'idle' && (
        <div className="status-message">{STEP_LABELS.idle}</div>
      )}

      {/* ── Converting step bar ── */}
      {busy && (
        <div className="convert-steps">
          <span className={step === 'downloading' || step === 'converting' || step === 'done' ? 'active' : ''}>⬇ Downloading</span>
          <span className="step-arrow">→</span>
          <span className={step === 'converting' || step === 'done' ? 'active' : ''}>⚙ Converting</span>
          <span className="step-arrow">→</span>
          <span className={step === 'done' ? 'active' : ''}>✅ Ready</span>
        </div>
      )}

      {/* ── Meta card ── */}
      {meta && (
        <div className="meta-card">
          <div className="cover-art">
            {meta.thumbnail ? <img src={meta.thumbnail} alt="" /> : <AudioPlaceholder />}
          </div>
          <div>
            <span className="eyebrow">{meta.platform === 'upload' ? 'LOCAL UPLOAD' : meta.platform.toUpperCase()} · {meta.duration}</span>
            <h3>{meta.title}</h3>
            <p className="muted">{meta.artist}{files.length === 1 ? ` · ${formatFileSize(files[0].size)}` : files.length > 1 ? ` · ${files.length} files` : ''}</p>
          </div>
        </div>
      )}

      {/* ── Presets ── */}
      {meta && (
        <div className="presets-row">
          <span className="format-label">Presets</span>
          <div className="presets-list">
            {presets.map((p) => (
              <div className="preset-chip" key={p.id}>
                <button className="preset-apply" onClick={() => applyPreset(p.id)}>{p.name}</button>
                <button className="preset-remove" aria-label={`Remove preset ${p.name}`} onClick={() => removePreset(p.id)}>×</button>
              </div>
            ))}
            <button className="preset-add-btn" onClick={() => setShowPresetSave((v) => !v)}>+ Save current</button>
          </div>
          {showPresetSave && (
            <div className="preset-save-row">
              <input
                className="preset-name-input"
                placeholder="Preset name…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                maxLength={40}
              />
              <button className="primary-button" onClick={handleSavePreset} disabled={!presetName.trim()}>Save</button>
            </div>
          )}
        </div>
      )}

      {/* ── Format selector with badges ── */}
      {meta && (
        <div className="format-options" aria-label="Audio format">
          <span className="format-label">Audio format</span>
          {meta.formats.map((f) => {
            const fm = FORMAT_META[f];
            return (
              <button
                className={`format-option${format === f ? ' active' : ''}`}
                key={f}
                onClick={() => setFormat(f)}
                title={fm?.title}
              >
                {f.toUpperCase()}
                {fm?.badge && <span className={`format-badge ${fm.badgeClass ?? ''}`}>{fm.badge}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Controls ── */}
      {meta && (
        <div className="controls-grid">
          <label>Speed <output>{speed.toFixed(1)}x</output>
            <input type="range" min="0.5" max="3" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <label>Amplify <output>{amplify > 0 ? '+' : ''}{amplify} dB</output>
            <input type="range" min="-20" max="10" step="1" value={amplify} onChange={(e) => setAmplify(Number(e.target.value))} />
          </label>
        </div>
      )}

      {/* ── Roblox playback helper ── */}
      {meta && (
        <div className="playback-info">
          <div className="playback-icon">⌁</div>
          <div className="playback-copy">
            <span className="eyebrow">Roblox playback speed</span>
            <strong>{playbackNormal.toFixed(2)}</strong>
            <p>Set <code>Sound.PlaybackSpeed = {playbackNormal.toFixed(4)}</code> di Roblox supaya speed audio kembali normal.</p>
          </div>
          <button className="copy-playback" onClick={copyPlaybackSpeed}>Copy value</button>
        </div>
      )}

      {/* ── Tool checkboxes ── */}
      {meta && (
        <div className="tools-grid">
          <label className="check-label">
            <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} /> Normalize volume
          </label>
          <label className="check-label">
            <input type="checkbox" checked={removeSilence} onChange={(e) => setRemoveSilence(e.target.checked)} /> Remove silence
          </label>
        </div>
      )}

      {/* ── Convert button ── */}
      {meta && (
        <button className="convert-button" onClick={() => void handleConvert()} disabled={busy}>
          {busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
        </button>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <div className="result-list">
          <div className="results-heading">
            <span className="eyebrow">Ready</span>
            <strong>{results.length} file{results.length > 1 ? 's' : ''} converted</strong>
          </div>
          {results.map((result) => {
            const ps = publishStates[result.file.name];
            const robloxReady = isRobloxReady();
            return (
              <div className="result-card" key={result.file.name}>
                <div>
                  <span className="eyebrow">Ready</span>
                  <h3>{result.file.name}</h3>
                  <p className="muted">{result.file.size_mb} MB · Playback normal {result.playback_speed_normal.toFixed(2)}</p>
                </div>
                <AudioPlayer src={downloadUrl(result.file.name)} />
                <div className="result-actions">
                  <DownloadButton url={downloadUrl(result.file.name)} filename={result.file.name} />
                  <button
                    className="share-button"
                    onClick={() => void handleShare(result.file.name)}
                    title="Generate & copy a 1-hour share link"
                  >
                    {copiedShare === result.file.name ? '✅ Copied!' : shareUrls[result.file.name] ? '🔗 Share link' : '🔗 Share'}
                  </button>
                </div>
                {/* ── Publish to Roblox row ── */}
                <div className="publish-row">
                  <button
                    className={`publish-roblox-btn${ps?.ok ? ' published' : ''}`}
                    onClick={() => void handlePublish(result, () => onGoToSettings?.())}
                    disabled={ps?.busy || ps?.ok}
                    title={robloxReady ? `Publish ke Roblox sebagai ${robloxSettings.creatorName || robloxSettings.creatorId}` : 'Setup Roblox settings dulu'}
                  >
                    {ps?.busy
                      ? '⏳ Uploading…'
                      : ps?.ok
                      ? '✅ Published'
                      : robloxReady
                      ? `⌘ Publish to Roblox`
                      : '⌘ Setup Roblox Settings'}
                  </button>
                  {ps?.msg && !ps.busy && (
                    <span className={`publish-status-msg ${ps.ok ? 'ok' : 'err'}`}>{ps.msg}</span>
                  )}
                  {!robloxReady && !ps && (
                    <span className="publish-hint">API key &amp; Creator ID belum di-save di Settings</span>
                  )}
                  {robloxReady && !ps && (
                    <span className="publish-hint ok">
                      → {robloxSettings.creatorName || robloxSettings.creatorId} ({robloxSettings.creatorType})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
