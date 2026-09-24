import { useMemo, useRef, useState, type DragEvent } from 'react';
import { DownloadButton } from '../../components/DownloadButton';
import { convertUploadedAudio, downloadUrl, type ConvertResult } from '../../services/api';
import { addHistory } from '../../stores/appStore';

const formats = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav', 'wma'];
type FileStatus = 'Queued' | 'Converting' | 'Done' | 'Failed';
interface BulkFile { id: string; file: File; duration: string; status: FileStatus; error?: string; result?: ConvertResult; }

function sizeLabel(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function durationLabel(seconds: number) { const value = Math.floor(seconds || 0); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

export function BulkConverterPanel() {
  const [items, setItems] = useState<BulkFile[]>([]);
  const [format, setFormat] = useState('mp3');
  const [speed, setSpeed] = useState(1);
  const [amplify, setAmplify] = useState(0);
  const [normalize, setNormalize] = useState(false);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => items.reduce((total, item) => total + item.file.size, 0), [items]);
  const completed = items.filter((item) => item.status === 'Done').length;
  const results = items.filter((item) => item.result).map((item) => item.result as ConvertResult);
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0;
  const playbackNormal = speed === 1 ? 1 : 1 / speed;

  function addFiles(selected: File[]) {
    const audioFiles = selected.filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|flac|wav|wma)$/i.test(file.name));
    const next = audioFiles.map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, duration: 'Reading...', status: 'Queued' as FileStatus }));
    setItems((current) => [...current, ...next]);
    next.forEach((item) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, duration: durationLabel(audio.duration) } : entry)); URL.revokeObjectURL(audio.src); };
      audio.src = URL.createObjectURL(item.file);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }
  function removeFile(id: string) { if (!busy) setItems((current) => current.filter((item) => item.id !== id)); }
  function clearFiles() { if (!busy) setItems([]); }

  async function convertAll() {
    if (!items.length || busy) return;
    setBusy(true);
    const startedAt = Date.now();
    for (const item of items) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Converting', error: undefined } : entry));
      try {
        const result = await convertUploadedAudio(item.file, { format, speed, amplify, normalize, removeSilence });
        addHistory({ title: result.title, artist: result.artist, platform: result.platform, format: result.format, fileName: result.file.name, downloadUrl: downloadUrl(result.file.name) });
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Done', result } : entry));
      } catch (error) {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Failed', error: error instanceof Error ? error.message : 'Conversion failed.' } : entry));
      }
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, error: entry.error ? `${entry.error} (${elapsed}s elapsed)` : undefined } : entry));
    }
    setBusy(false);
  }

  function downloadAll() {
    results.forEach((result, index) => { window.setTimeout(() => { const link = document.createElement('a'); link.href = downloadUrl(result.file.name); link.download = result.file.name; link.click(); }, index * 250); });
  }

  return <section className="bulk-page">
    <div className="page-header"><span className="eyebrow">Batch workspace</span><h1>Bulk convert audio</h1><p>Upload multiple files, apply one set of settings, and keep every converted result in your history.</p></div>
    <div className="bulk-layout"><div className="bulk-main">
      <section className="panel bulk-upload-panel"><div className="panel-heading"><div><span className="eyebrow">1 · Source files</span><h2>Upload your audio batch</h2><p className="muted">Choose multiple files or drag them into the drop zone.</p></div><span className="bulk-count">{items.length} files · {sizeLabel(totalSize)}</span></div><div className={`bulk-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" multiple accept="audio/*,.flac,.wav,.ogg,.opus" onChange={(event) => addFiles(Array.from(event.target.files || []))} /><span className="upload-icon">↑</span><strong>Drop audio files here</strong><span>or click to choose multiple files · up to 200 MB each</span></div>{items.length > 0 && <div className="bulk-file-list">{items.map((item) => <div className="bulk-file-row" key={item.id}><div className="bulk-file-icon">♫</div><div className="bulk-file-copy"><strong>{item.file.name}</strong><span>{sizeLabel(item.file.size)} · {item.duration}</span>{item.error && <small>{item.error}</small>}</div><span className={`bulk-status ${item.status.toLowerCase()}`}>{item.status}</span><button className="bulk-remove" type="button" aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(item.id)}>×</button></div>)}</div>}</section>
      <section className="panel bulk-settings"><div className="section-heading"><div><span className="eyebrow">2 · Global settings</span><h2>Apply to every file</h2><p>These settings will be used for the entire batch.</p></div></div><div className="format-options"><span className="format-label">Output format</span>{formats.map((item) => <button className={format === item ? 'format-option active' : 'format-option'} type="button" key={item} onClick={() => setFormat(item)}>{item.toUpperCase()}</button>)}</div><div className="controls-grid"><label>Speed <output>{speed.toFixed(1)}x</output><input type="range" min="0.5" max="3" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label><label>Amplify <output>{amplify > 0 ? '+' : ''}{amplify} dB</output><input type="range" min="-20" max="10" step="1" value={amplify} onChange={(event) => setAmplify(Number(event.target.value))} /></label></div><div className="tools-grid"><label className="check-label"><input type="checkbox" checked={normalize} onChange={(event) => setNormalize(event.target.checked)} /> Normalize volume</label><label className="check-label"><input type="checkbox" checked={removeSilence} onChange={(event) => setRemoveSilence(event.target.checked)} /> Remove silence</label></div><div className="bulk-playback"><span className="eyebrow">Roblox playback speed</span><strong>{playbackNormal.toFixed(2)}</strong><span>Applied to every converted file</span></div><button className="convert-button" type="button" onClick={() => void convertAll()} disabled={!items.length || busy}>{busy ? `Converting ${completed}/${items.length}...` : 'Convert all files'}</button></section>
    </div><aside className="bulk-rail"><section className="panel bulk-progress"><div className="rail-heading"><h3>Batch progress</h3><span>{completed} / {items.length || 0} files</span></div><div className="bulk-progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}% complete</strong><p>{busy ? 'Processing files one by one...' : items.length ? 'Ready to convert this batch.' : 'Add files to start a batch.'}</p></section>{results.length > 0 && <section className="panel bulk-results"><div className="rail-heading"><h3>Completed files</h3><button className="text-button" type="button" onClick={downloadAll}>Download all</button></div>{results.map((result) => <div className="bulk-result" key={result.file.name}><div><strong>{result.file.name}</strong><span>{result.file.size_mb} MB · {result.format.toUpperCase()}</span></div><DownloadButton compact url={downloadUrl(result.file.name)} filename={result.file.name} /></div>)}</section>}</aside></div>
  </section>;
}
