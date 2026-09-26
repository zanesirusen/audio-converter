import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { SiApple, SiSoundcloud, SiSpotify, SiTiktok, SiYoutube } from 'react-icons/si';
import { AudioPlayer } from '../../components/AudioPlayer';
import { DownloadButton } from '../../components/DownloadButton';
import { toast } from '../../components/Toast';
import { convertAudio, convertUploadedAudio, detectAudio, downloadUrl, type AudioMeta, type ConvertResult } from '../../services/api';
import { addHistory } from '../../stores/appStore';
import { usePresets, addPreset, removePreset } from '../../stores/presetsStore';
import { useRobloxSettings, isRobloxReady } from '../../stores/robloxSettingsStore';

const uploadFormats = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav', 'wma'];
type InputMode = 'url' | 'upload';

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

const STEP_LABELS: Record<string, string> = {
  idle:       'Paste a link or upload an audio file to begin.',
  detecting:  '🔍 Detecting metadata...',
  ready:      'Ready to convert.',
  downloading:'⬇ Downloading source audio...',
  converting: '⚙ Converting audio...',
  done:       '✅ Conversion complete.',
};

// ── Queue item ────────────────────────────────────────────────
interface QueueItem {
  id: string;
  url: string;
  status: 'queued' | 'detecting' | 'converting' | 'done' | 'error';
  title?: string;
  result?: ConvertResult;
  error?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function parseDuration(dur: string): number {
  // "4:58" → 298 seconds
  const parts = dur.split(':').map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return 0;
}

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
  const [dragFileName, setDragFileName] = useState('');   // task 5: drag feedback
  const [files, setFiles] = useState<File[]>([]);
  const [fileDragOver, setFileDragOver] = useState(false); // task 5
  const [fileDragPreview, setFileDragPreview] = useState(''); // task 5

  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [format, setFormat] = useState('ogg');
  const [speed, setSpeed] = useState(2.3);
  const [pitch, setPitch] = useState(1.0);               // task 6: pitch control
  const [amplify, setAmplify] = useState(-2);
  const [normalize, setNormalize] = useState(false);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [trimStart, setTrimStart] = useState('');         // task 7: audio trimmer
  const [trimEnd, setTrimEnd] = useState('');             // task 7

  const [results, setResults] = useState<ConvertResult[]>([]);
  const [step, setStep] = useState<keyof typeof STEP_LABELS>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Task 9: Conversion queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueInput, setQueueInput] = useState('');
  const [showQueue, setShowQueue] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);

  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [copiedShare, setCopiedShare] = useState('');
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [publishStates, setPublishStates] = useState<Record<string, { busy: boolean; msg: string; ok: boolean }>>({});

  const urlInputRef = useRef<HTMLInputElement>(null);

  function resetDefaults() {
    setFormat('ogg'); setSpeed(2.3); setPitch(1.0); setAmplify(-2);
    setTrimStart(''); setTrimEnd('');
  }

  function selectMode(nextMode: InputMode) {
    setMode(nextMode); setMeta(null); setFiles([]); setResults([]);
    setStep('idle'); setErrorMsg(''); resetDefaults();
  }

  // ── URL drag-and-drop ────────────────────────────────────────
  function handleUrlDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setUrlDragOver(true);
    const items = Array.from(e.dataTransfer.items);
    const textItem = items.find(i => i.kind === 'string');
    if (textItem) textItem.getAsString(s => setDragFileName(s.length > 60 ? s.slice(0, 60) + '…' : s));
  }
  function handleUrlDragLeave() { setUrlDragOver(false); setDragFileName(''); }
  function handleUrlDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setUrlDragOver(false); setDragFileName('');
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text?.trim().startsWith('http')) {
      setUrl(text.trim()); setMeta(null); setResults([]); setStep('idle');
      toast('URL dropped — click Detect to continue', 'info', 2500);
    }
  }

  // ── File drag-and-drop with preview (task 5) ─────────────────
  function handleFileDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault(); setFileDragOver(true);
    const f = e.dataTransfer.items[0];
    if (f?.kind === 'file') setFileDragPreview(f.getAsFile()?.name ?? '');
  }
  function handleFileDragLeave() { setFileDragOver(false); setFileDragPreview(''); }
  function handleFileDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault(); setFileDragOver(false); setFileDragPreview('');
    const dropped = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|flac|wav|wma)$/i.test(f.name)
    );
    if (dropped.length) processFiles(dropped);
  }

  function processFiles(selected: File[]) {
    const invalid = selected.find(
      (item) => !item.type.startsWith('audio/') && !item.name.match(/\.(mp3|m4a|aac|ogg|opus|flac|wav|wma)$/i)
    );
    if (invalid) { setErrorMsg(`File tidak didukung: ${invalid.name}`); return; }
    setFiles(selected); setResults([]); setFormat('mp3'); setErrorMsg('');
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (selected.length) processFiles(selected);
  }

  async function handleDetect() {
    if (!url.trim()) { setErrorMsg('Masukkan URL audio terlebih dahulu.'); return; }
    setBusy(true); setStep('detecting'); setErrorMsg(''); setResults([]);
    try {
      const data = await detectAudio(url.trim());
      setMeta(data);
      setFormat(data.formats.includes('ogg') ? 'ogg' : data.formats[0] || 'mp3');
      setSpeed(2.3); setPitch(1.0); setAmplify(-2);
      setStep('ready');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal membaca URL.';
      setErrorMsg(msg);
      toast(msg, 'error');
      setStep('idle');
    } finally { setBusy(false); }
  }

  async function handleConvert() {
    if (mode === 'url' && !meta) { setErrorMsg('Detect URL terlebih dahulu.'); return; }
    if (mode === 'upload' && !files.length) { setErrorMsg('Pilih file audio terlebih dahulu.'); return; }
    setBusy(true); setErrorMsg('');
    const options = { format, speed, pitch, amplify, normalize, removeSilence,
      trimStart: trimStart.trim() || undefined,
      trimEnd: trimEnd.trim() || undefined,
    };
    const converted: ConvertResult[] = [];
    try {
      if (mode === 'upload') {
        for (const currentFile of files) {
          setStep('converting');
          const data = await convertUploadedAudio(currentFile, options);
          converted.push(data);
          addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: downloadUrl(data.file.name) });
        }
      } else {
        setStep('downloading');
        await new Promise((r) => setTimeout(r, 50));
        setStep('converting');
        const data = await convertAudio({ url, ...options });
        converted.push(data);
        addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: downloadUrl(data.file.name) });
      }
      const last = converted[converted.length - 1];
      localStorage.setItem('3zane_last_result', JSON.stringify({
        fileUrl: downloadUrl(last.file.name), fileName: last.file.name,
        title: last.title, artist: last.artist, format: last.format,
      }));
      setResults(converted);
      setStep('done');
      toast(`✅ ${last.title} converted to ${last.format.toUpperCase()}`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Conversion gagal.';
      setErrorMsg(msg);
      toast(msg, 'error');
      setStep('idle');
    } finally { setBusy(false); }
  }

  // ── Task 9: Queue processing ──────────────────────────────────
  function addToQueue() {
    const trimmed = queueInput.trim();
    if (!trimmed || !trimmed.startsWith('http')) return;
    const id = crypto.randomUUID();
    setQueue(q => [...q, { id, url: trimmed, status: 'queued' }]);
    setQueueInput('');
  }

  function removeFromQueue(id: string) {
    setQueue(q => q.filter(item => item.id !== id));
  }

  async function processQueue() {
    if (queueBusy) return;
    setQueueBusy(true);
    const options = { format, speed, pitch, amplify, normalize, removeSilence };
    for (const item of queue) {
      if (item.status !== 'queued') continue;
      // detecting
      setQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'detecting' } : i));
      try {
        const meta = await detectAudio(item.url);
        setQueue(q => q.map(i => i.id === item.id ? { ...i, title: meta.title, status: 'converting' } : i));
        const data = await convertAudio({ url: item.url, ...options });
        addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: downloadUrl(data.file.name) });
        setQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'done', result: data } : i));
        toast(`✅ ${data.title} done`, 'success', 2500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed';
        setQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'error', error: msg } : i));
        toast(`❌ ${item.url.slice(0, 40)}… failed`, 'error');
      }
    }
    setQueueBusy(false);
  }

  // ── Share ────────────────────────────────────────────────────
  async function handleShare(fileName: string) {
    try {
      const res = await fetch('/api/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: `/downloads/${encodeURIComponent(fileName)}` }),
      });
      const data = await res.json() as { share_url?: string; error?: string };
      if (data.share_url) {
        setShareUrls(prev => ({ ...prev, [fileName]: data.share_url! }));
        await navigator.clipboard.writeText(data.share_url!);
        setCopiedShare(fileName);
        setTimeout(() => setCopiedShare(''), 3000);
        toast('🔗 Share link copied!', 'success', 2500);
      }
    } catch { toast('Failed to generate share link', 'error'); }
  }

  // ── Publish ──────────────────────────────────────────────────
  async function handlePublish(result: ConvertResult, navigateToSettings: () => void) {
    if (!isRobloxReady()) { navigateToSettings(); return; }
    const { apiKey, creatorType, creatorId, defaultAssetName } = robloxSettings;
    const fileName = result.file.name;
    setPublishStates(prev => ({ ...prev, [fileName]: { busy: true, msg: 'Uploading to Roblox…', ok: false } }));
    try {
      const assetName = defaultAssetName ? `${defaultAssetName}${result.title}`.slice(0, 50) : result.title.slice(0, 50);
      const res = await fetch('/api/publish-roblox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: `/downloads/${encodeURIComponent(fileName)}`, name: assetName, description: `Uploaded via 3Zane · ${result.artist || ''}`.trim(), api_key: apiKey, creator_type: creatorType, creator_id: creatorId }),
      });
      const data = await res.json() as { success: boolean; operation_id?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Publish failed.');
      setPublishStates(prev => ({ ...prev, [fileName]: { busy: false, msg: `✅ Op ID: ${data.operation_id || 'processing'}`, ok: true } }));
      toast('✅ Published to Roblox!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed.';
      setPublishStates(prev => ({ ...prev, [fileName]: { busy: false, msg: `✗ ${msg}`, ok: false } }));
      toast(`❌ ${msg}`, 'error');
    }
  }

  // ── Presets ──────────────────────────────────────────────────
  function applyPreset(id: string) {
    const p = presets.find(p => p.id === id);
    if (!p) return;
    setFormat(p.format); setSpeed(p.speed); setAmplify(p.amplify);
    setNormalize(p.normalize); setRemoveSilence(p.removeSilence);
    toast(`Preset "${p.name}" applied`, 'info', 2000);
  }

  function handleSavePreset() {
    if (!presetName.trim()) return;
    addPreset({ name: presetName.trim(), format, speed, amplify, normalize, removeSilence });
    toast(`Preset "${presetName}" saved`, 'success', 2000);
    setPresetName(''); setShowPresetSave(false);
  }

  // ── Roblox warning (task 8) ───────────────────────────────────
  function getRobloxWarning(result: ConvertResult): string | null {
    const sizeMb = parseFloat(result.file.size_mb);
    const secs = parseDuration(result.duration);
    if (sizeMb > 20) return `⚠ File ${sizeMb}MB melebihi batas Roblox 20MB`;
    if (secs > 420) return `⚠ Durasi ${result.duration} melebihi batas Roblox 7 menit`;
    return null;
  }

  const playbackNormal = speed === 1 ? 1 : 1 / speed;

  return (
    <section className="panel converter-panel" id="converter">
      {/* Header */}
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Audio converter</span>
          <h2>{mode === 'upload' ? 'Turn a file into sound.' : 'Turn a link into sound.'}</h2>
          <p className="muted">Convert, shape, preview, and keep every result in your history.</p>
        </div>
        <span className="live-badge"><span className="status-dot" /> Online</span>
      </div>

      {/* Mode tabs */}
      <div className="converter-modes" role="tablist" aria-label="Conversion source">
        <button className={mode === 'url' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'url'} onClick={() => selectMode('url')}>↗ Paste URL</button>
        <button className={mode === 'upload' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'upload'} onClick={() => selectMode('upload')}>↑ Upload file</button>
      </div>

      {/* URL input */}
      {mode === 'url' ? (
        <>
          <div className={`url-drop-zone${urlDragOver ? ' drag-over' : ''}`} onDragOver={handleUrlDragOver} onDragLeave={handleUrlDragLeave} onDrop={handleUrlDrop}>
            <div className="url-row">
              <input ref={urlInputRef} className="url-input" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && void handleDetect()} placeholder="Paste or drag a link here…" />
              <button className="primary-button" onClick={() => void handleDetect()} disabled={busy}>{step === 'detecting' ? '...' : 'Detect'}</button>
            </div>
            {urlDragOver && <p className="url-drop-hint">↓ {dragFileName || 'Drop link here'}</p>}
          </div>
          <div className="platforms">
            <span><SiYoutube className="platform-icon youtube-icon" />YouTube</span>
            <span><SiSoundcloud className="platform-icon soundcloud-icon" />SoundCloud</span>
            <span><SiTiktok className="platform-icon tiktok-icon" />TikTok</span>
            <span><SiSpotify className="platform-icon spotify-icon" />Spotify</span>
            <span><SiApple className="platform-icon apple-icon" />Apple Music</span>
          </div>

          {/* Task 9: Queue */}
          <div className="queue-section">
            <button className="queue-toggle" onClick={() => setShowQueue(v => !v)}>
              {showQueue ? '▾' : '▸'} Conversion queue {queue.length > 0 && <span className="queue-badge">{queue.length}</span>}
            </button>
            {showQueue && (
              <div className="queue-panel">
                <div className="queue-input-row">
                  <input className="url-input" value={queueInput} onChange={e => setQueueInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToQueue()} placeholder="Paste URL to add to queue…" />
                  <button className="secondary-button" onClick={addToQueue}>Add</button>
                </div>
                {queue.length > 0 && (
                  <>
                    <div className="queue-list">
                      {queue.map(item => (
                        <div className="queue-item" key={item.id}>
                          <span className={`queue-status queue-${item.status}`}>{item.status}</span>
                          <span className="queue-url">{item.title || item.url}</span>
                          {item.result && <DownloadButton compact url={downloadUrl(item.result.file.name)} filename={item.result.file.name} />}
                          {item.status === 'queued' && <button className="bulk-remove" onClick={() => removeFromQueue(item.id)}>×</button>}
                        </div>
                      ))}
                    </div>
                    <button className="convert-button" onClick={() => void processQueue()} disabled={queueBusy || queue.every(i => i.status !== 'queued')}>
                      {queueBusy ? 'Processing queue…' : `Convert ${queue.filter(i => i.status === 'queued').length} queued URLs`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        // File upload with improved drag feedback (task 5)
        <div className="upload-zone">
          <input id="audio-upload" type="file" accept="audio/*,.flac,.wav,.ogg,.opus" onChange={handleFileChange} />
          <label
            htmlFor="audio-upload"
            className={fileDragOver ? 'drag-active' : ''}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
            {fileDragOver && fileDragPreview ? (
              <>
                <span className="upload-icon">♫</span>
                <strong>Drop to convert:</strong>
                <span className="drag-filename">{fileDragPreview}</span>
              </>
            ) : (
              <>
                <span className="upload-icon">↑</span>
                <strong>{files.length ? 'Choose another audio file' : 'Drop an audio file here'}</strong>
                <span>MP3, WAV, M4A, OGG, OPUS, or FLAC up to 200 MB</span>
              </>
            )}
          </label>
          {files.length > 0 && (
            <div className="upload-file-list">
              {files.map(f => (
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

      {/* Status */}
      <div className={`status-message${errorMsg ? ' error' : ''}`}>
        {errorMsg || STEP_LABELS[step] || ''}
        {busy && step !== 'done' && <span className="step-dots"><span /><span /><span /></span>}
      </div>

      {/* Step bar */}
      {busy && (
        <div className="convert-steps">
          <span className={step === 'downloading' || step === 'converting' || step === 'done' ? 'active' : ''}>⬇ Downloading</span>
          <span className="step-arrow">→</span>
          <span className={step === 'converting' || step === 'done' ? 'active' : ''}>⚙ Converting</span>
          <span className="step-arrow">→</span>
          <span className={step === 'done' ? 'active' : ''}>✅ Ready</span>
        </div>
      )}

      {/* Meta card */}
      {meta && (
        <div className="meta-card">
          <div className="cover-art">{meta.thumbnail ? <img src={meta.thumbnail} alt="" /> : <AudioPlaceholder />}</div>
          <div>
            <span className="eyebrow">{meta.platform === 'upload' ? 'LOCAL UPLOAD' : meta.platform.toUpperCase()} · {meta.duration}</span>
            <h3>{meta.title}</h3>
            <p className="muted">{meta.artist}{files.length === 1 ? ` · ${formatFileSize(files[0].size)}` : files.length > 1 ? ` · ${files.length} files` : ''}</p>
          </div>
        </div>
      )}

      {/* Presets */}
      {meta && (
        <div className="presets-row">
          <span className="format-label">Presets</span>
          <div className="presets-list">
            {presets.map(p => (
              <div className="preset-chip" key={p.id}>
                <button className="preset-apply" onClick={() => applyPreset(p.id)}>{p.name}</button>
                <button className="preset-remove" aria-label={`Remove ${p.name}`} onClick={() => removePreset(p.id)}>×</button>
              </div>
            ))}
            <button className="preset-add-btn" onClick={() => setShowPresetSave(v => !v)}>+ Save current</button>
          </div>
          {showPresetSave && (
            <div className="preset-save-row">
              <input className="preset-name-input" placeholder="Preset name…" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePreset()} maxLength={40} />
              <button className="primary-button" onClick={handleSavePreset} disabled={!presetName.trim()}>Save</button>
            </div>
          )}
        </div>
      )}

      {/* Format */}
      {meta && (
        <div className="format-options" aria-label="Audio format">
          <span className="format-label">Audio format</span>
          {meta.formats.map(f => {
            const fm = FORMAT_META[f];
            return (
              <button className={`format-option${format === f ? ' active' : ''}`} key={f} onClick={() => setFormat(f)} title={fm?.title}>
                {f.toUpperCase()}
                {fm?.badge && <span className={`format-badge ${fm.badgeClass ?? ''}`}>{fm.badge}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Controls: Speed + Amplify + Pitch (task 6) */}
      {meta && (
        <div className="controls-grid controls-grid-3">
          <label>Speed <output>{speed.toFixed(1)}x</output>
            <input type="range" min="0.5" max="3" step="0.1" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
          </label>
          <label>Amplify <output>{amplify > 0 ? '+' : ''}{amplify} dB</output>
            <input type="range" min="-20" max="10" step="1" value={amplify} onChange={e => setAmplify(Number(e.target.value))} />
          </label>
          <label>Pitch <output>{pitch > 1 ? '+' : ''}{((pitch - 1) * 100).toFixed(0)}%</output>
            <input type="range" min="0.5" max="2" step="0.05" value={pitch} onChange={e => setPitch(Number(e.target.value))} />
          </label>
        </div>
      )}

      {/* Task 7: Audio trimmer */}
      {meta && (
        <div className="trimmer-row">
          <span className="format-label">Trim audio</span>
          <div className="trimmer-inputs">
            <label className="trimmer-label">
              Start
              <input className="trimmer-input" type="text" value={trimStart} onChange={e => setTrimStart(e.target.value)} placeholder="e.g. 0:30" />
            </label>
            <span className="trimmer-sep">→</span>
            <label className="trimmer-label">
              End
              <input className="trimmer-input" type="text" value={trimEnd} onChange={e => setTrimEnd(e.target.value)} placeholder="e.g. 3:00" />
            </label>
            {(trimStart || trimEnd) && (
              <button className="trimmer-clear" onClick={() => { setTrimStart(''); setTrimEnd(''); }}>✕ Clear</button>
            )}
          </div>
        </div>
      )}

      {/* Roblox playback helper */}
      {meta && (
        <div className="playback-info">
          <div className="playback-icon">⌁</div>
          <div className="playback-copy">
            <span className="eyebrow">Roblox playback speed</span>
            <strong>{playbackNormal.toFixed(2)}</strong>
            <p>Set <code>Sound.PlaybackSpeed = {playbackNormal.toFixed(4)}</code> di Roblox supaya speed kembali normal.</p>
          </div>
          <button className="copy-playback" onClick={() => { void navigator.clipboard?.writeText(playbackNormal.toFixed(4)); toast('Copied!', 'success', 1500); }}>Copy</button>
        </div>
      )}

      {/* Tools */}
      {meta && (
        <div className="tools-grid">
          <label className="check-label"><input type="checkbox" checked={normalize} onChange={e => setNormalize(e.target.checked)} /> Normalize volume</label>
          <label className="check-label"><input type="checkbox" checked={removeSilence} onChange={e => setRemoveSilence(e.target.checked)} /> Remove silence</label>
        </div>
      )}

      {/* Convert button — task 4: shimmer animation */}
      {meta && (
        <button className={`convert-button${busy ? ' btn-converting' : ''}`} onClick={() => void handleConvert()} disabled={busy}>
          {busy ? <><span className="btn-shimmer" /><span>Converting…</span></> : `Convert to ${format.toUpperCase()}`}
        </button>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="result-list">
          <div className="results-heading">
            <span className="eyebrow">Ready</span>
            <strong>{results.length} file{results.length > 1 ? 's' : ''} converted</strong>
          </div>
          {results.map(result => {
            const ps = publishStates[result.file.name];
            const robloxReady = isRobloxReady();
            const robloxWarn = getRobloxWarning(result); // task 8
            return (
              <div className="result-card" key={result.file.name}>
                <div>
                  <span className="eyebrow">Ready</span>
                  <h3>{result.file.name}</h3>
                  <p className="muted">{result.file.size_mb} MB · Playback normal {result.playback_speed_normal.toFixed(2)}</p>
                  {/* Task 8: Roblox warning */}
                  {robloxWarn && <p className="roblox-limit-warn">{robloxWarn}</p>}
                </div>
                <AudioPlayer src={downloadUrl(result.file.name)} />
                <div className="result-actions">
                  <DownloadButton url={downloadUrl(result.file.name)} filename={result.file.name} />
                  <button className="share-button" onClick={() => void handleShare(result.file.name)} title="Generate 1-hour share link">
                    {copiedShare === result.file.name ? '✅ Copied!' : shareUrls[result.file.name] ? '🔗 Share link' : '🔗 Share'}
                  </button>
                </div>
                <div className="publish-row">
                  <button
                    className={`publish-roblox-btn${ps?.ok ? ' published' : ''}`}
                    onClick={() => void handlePublish(result, () => onGoToSettings?.())}
                    disabled={ps?.busy || ps?.ok}
                  >
                    {ps?.busy ? '⏳ Uploading…' : ps?.ok ? '✅ Published' : robloxReady ? '⌘ Publish to Roblox' : '⌘ Setup Roblox Settings'}
                  </button>
                  {ps?.msg && !ps.busy && <span className={`publish-status-msg ${ps.ok ? 'ok' : 'err'}`}>{ps.msg}</span>}
                  {!robloxReady && !ps && <span className="publish-hint">API key & Creator ID belum di-save</span>}
                  {robloxReady && !ps && <span className="publish-hint ok">→ {robloxSettings.creatorName || robloxSettings.creatorId} ({robloxSettings.creatorType})</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
