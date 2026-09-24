import { useState, type ChangeEvent } from 'react';
import { SiApple, SiSoundcloud, SiSpotify, SiTiktok, SiYoutube } from 'react-icons/si';
import { AudioPlayer } from '../../components/AudioPlayer';
import { DownloadButton } from '../../components/DownloadButton';
import { convertAudio, convertUploadedAudio, detectAudio, downloadUrl, type AudioMeta, type ConvertResult } from '../../services/api';
import { addHistory } from '../../stores/appStore';

const toolDefaults = { normalize: false, removeSilence: false };
const uploadFormats = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav', 'wma'];

type InputMode = 'url' | 'upload';

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ConverterPanel() {
  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [format, setFormat] = useState('mp3');
  const [speed, setSpeed] = useState(1);
  const [amplify, setAmplify] = useState(0);
  const [tools, setTools] = useState(toolDefaults);
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [status, setStatus] = useState('Paste a link or upload an audio file to begin.');
  const [busy, setBusy] = useState(false);

  function selectMode(nextMode: InputMode) {
    setMode(nextMode);
    setMeta(null);
    setFiles([]);
    setResults([]);
    setStatus(nextMode === 'url' ? 'Paste a link to begin.' : 'Choose an audio file to begin.');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const invalid = selected.find((item) => !item.type.startsWith('audio/') && !item.name.match(/\.(mp3|m4a|aac|ogg|opus|flac|wav|wma)$/i));
    if (invalid) {
      setFiles([]);
      setMeta(null);
      setStatus(`File tidak didukung: ${invalid.name}`);
      return;
    }
    setFiles(selected);
    setResults([]);
    setFormat('mp3');
    setMeta({ platform: 'upload', title: selected.length === 1 ? selected[0].name.replace(/\.[^.]+$/, '') : `${selected.length} audio files`, artist: 'Local upload', duration: 'Ready to inspect', thumbnail: null, formats: uploadFormats });
    setStatus(`${selected.length} file${selected.length > 1 ? 's' : ''} ready. Choose your output settings.`);
  }

  async function handleDetect() {
    if (!url.trim()) return setStatus('Masukkan URL audio terlebih dahulu.');
    setBusy(true); setStatus('Detecting metadata...'); setResults([]);
    try { const data = await detectAudio(url.trim()); setMeta(data); setFormat(data.formats[0] || 'mp3'); setStatus('Ready to convert.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Gagal membaca URL.'); }
    finally { setBusy(false); }
  }

  async function handleConvert() {
    if (mode === 'url' && !meta) return setStatus('Detect URL terlebih dahulu.');
    if (mode === 'upload' && !files.length) return setStatus('Pilih file audio terlebih dahulu.');
    setBusy(true); setResults([]); setStatus(mode === 'upload' ? `Uploading 0/${files.length} audio files...` : 'Downloading source and converting...');
    try {
      const options = { format, speed, amplify, ...tools };
      const converted: ConvertResult[] = [];
      if (mode === 'upload') {
        for (const [index, currentFile] of files.entries()) {
          setStatus(`Uploading and converting ${index + 1}/${files.length}: ${currentFile.name}`);
          const data = await convertUploadedAudio(currentFile, options);
          converted.push(data);
          const fileUrl = downloadUrl(data.file.name);
          addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: fileUrl });
        }
      } else {
        const data = await convertAudio({ url, ...options });
        converted.push(data);
        const fileUrl = downloadUrl(data.file.name);
        addHistory({ title: data.title, artist: data.artist, platform: data.platform, format: data.format, fileName: data.file.name, downloadUrl: fileUrl });
      }
      const last = converted[converted.length - 1];
      const fileUrl = downloadUrl(last.file.name);
      setResults(converted);
      localStorage.setItem('waveforge_last_result', JSON.stringify({ fileUrl, fileName: last.file.name, title: last.title, artist: last.artist, format: last.format }));
      setStatus('Conversion ready.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Conversion gagal.'); }
    finally { setBusy(false); }
  }

  function updateTool<K extends keyof typeof tools>(key: K, value: (typeof tools)[K]) { setTools((current) => ({ ...current, [key]: value })); }
  const playbackNormal = speed === 1 ? 1 : 1 / speed;
  function copyPlaybackSpeed() { void navigator.clipboard?.writeText(playbackNormal.toFixed(4)); }
  const isError = status.includes('gagal') || status.includes('Gagal') || status.includes('Pilih') || status.includes('Masukkan');

  return <section className="panel converter-panel" id="converter">
    <div className="panel-heading"><div><span className="eyebrow">Audio converter</span><h2>{mode === 'upload' ? 'Turn a file into sound.' : 'Turn a link into sound.'}</h2><p className="muted">Convert, shape, preview, and keep every result in your history.</p></div><span className="live-badge"><span className="status-dot" /> Online</span></div>
    <div className="converter-modes" role="tablist" aria-label="Conversion source"><button className={mode === 'url' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'url'} onClick={() => selectMode('url')}>↗ Paste URL</button><button className={mode === 'upload' ? 'converter-mode active' : 'converter-mode'} type="button" role="tab" aria-selected={mode === 'upload'} onClick={() => selectMode('upload')}>↑ Upload file</button></div>
    {mode === 'url' ? <><div className="url-row"><input className="url-input" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleDetect()} placeholder="https://..." /><button className="primary-button" onClick={() => void handleDetect()} disabled={busy}>{busy ? 'Working...' : 'Detect'}</button></div><div className="platforms"><span><SiYoutube className="platform-icon youtube-icon" aria-hidden="true" />YouTube</span><span><SiSoundcloud className="platform-icon soundcloud-icon" aria-hidden="true" />SoundCloud</span><span><SiTiktok className="platform-icon tiktok-icon" aria-hidden="true" />TikTok</span><span><SiSpotify className="platform-icon spotify-icon" aria-hidden="true" />Spotify</span><span><SiApple className="platform-icon apple-icon" aria-hidden="true" />Apple Music</span></div></> : <div className="upload-zone"><input id="audio-upload" type="file" accept="audio/*,.flac,.wav,.ogg,.opus" onChange={handleFileChange} /><label htmlFor="audio-upload"><span className="upload-icon">↑</span><strong>{files.length ? 'Choose another audio file' : 'Drop an audio file here'}</strong><span>MP3, WAV, M4A, OGG, OPUS, or FLAC up to 200 MB</span></label>{files.length > 0 && <div className="upload-file-list">{files.map((currentFile, index) => <div className="upload-file" key={`${currentFile.name}-${currentFile.lastModified}`}><span>♫</span><div><strong>{currentFile.name}</strong><small>{formatFileSize(currentFile.size)}</small></div><button type="button" aria-label={`Remove ${currentFile.name}`} onClick={() => { setFiles([]); setResults([]); setMeta(null); setStatus('Choose an audio file to begin.'); }}>×</button></div>)}</div>}</div>}
    <div className={`status-message ${isError ? 'error' : ''}`}>{status}</div>
    {meta && <div className="meta-card"><div className="cover-art">{meta.thumbnail ? <img src={meta.thumbnail} alt="" /> : '♫'}</div><div><span className="eyebrow">{meta.platform === 'upload' ? 'LOCAL UPLOAD' : meta.platform.toUpperCase()} · {meta.duration}</span><h3>{meta.title}</h3><p className="muted">{meta.artist}{files.length === 1 ? ` · ${formatFileSize(files[0].size)}` : files.length > 1 ? ` · ${files.length} files` : ''}</p></div></div>}
    {meta && <div className="format-options" aria-label="Audio format"><span className="format-label">Audio format</span>{meta.formats.map((item) => <button className={format === item ? 'format-option active' : 'format-option'} key={item} onClick={() => setFormat(item)}>{item.toUpperCase()}</button>)}</div>}
    {meta && <div className="controls-grid"><label>Speed <output>{speed.toFixed(1)}x</output><input type="range" min="0.5" max="3" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label><label>Amplify <output>{amplify > 0 ? '+' : ''}{amplify} dB</output><input type="range" min="-20" max="10" step="1" value={amplify} onChange={(event) => setAmplify(Number(event.target.value))} /></label></div>}
    {meta && <div className="playback-info"><div className="playback-icon">⌁</div><div className="playback-copy"><span className="eyebrow">Roblox playback speed</span><strong>{playbackNormal.toFixed(2)}</strong><p>Set <code>Sound.PlaybackSpeed = {playbackNormal.toFixed(4)}</code> di Roblox supaya speed audio kembali normal.</p></div><button className="copy-playback" onClick={copyPlaybackSpeed}>Copy value</button></div>}
    {meta && <div className="tools-grid"><label className="check-label"><input type="checkbox" checked={tools.normalize} onChange={(event) => updateTool('normalize', event.target.checked)} /> Normalize volume</label><label className="check-label"><input type="checkbox" checked={tools.removeSilence} onChange={(event) => updateTool('removeSilence', event.target.checked)} /> Remove silence</label></div>}
    {meta && <button className="convert-button" onClick={() => void handleConvert()} disabled={busy}>{busy ? 'Converting...' : `Convert to ${format.toUpperCase()}`}</button>}
    {results.length > 0 && <div className="result-list"><div className="results-heading"><span className="eyebrow">Ready</span><strong>{results.length} file{results.length > 1 ? 's' : ''} converted</strong></div>{results.map((result) => <div className="result-card" key={result.file.name}><div><span className="eyebrow">Ready</span><h3>{result.file.name}</h3><p className="muted">{result.file.size_mb} MB · Playback normal {result.playback_speed_normal.toFixed(2)}</p></div><AudioPlayer src={downloadUrl(result.file.name)} /><DownloadButton url={downloadUrl(result.file.name)} filename={result.file.name} /></div>)}</div>}
  </section>;
}
