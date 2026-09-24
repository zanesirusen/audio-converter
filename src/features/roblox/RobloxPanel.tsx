import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { validateRoblox } from '../../services/roblox';
import { useHistory } from '../../stores/appStore';

interface LastResult {
  fileUrl: string;
  fileName: string;
  title: string;
  artist: string;
  format: string;
}

export function RobloxPanel() {
  const history = useHistory();
  const [type, setType] = useState<'user' | 'group'>('user');
  const [id, setId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('Uploaded via Waveforge');
  const [lastAsset, setLastAsset] = useState<LastResult | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [creatorStatus, setCreatorStatus] = useState('Not validated');
  const [keyStatus, setKeyStatus] = useState('API key required');
  const [status, setStatus] = useState('Ready for upload.');
  const [busy, setBusy] = useState(false);
  const [assetSlot, setAssetSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setLastAsset(JSON.parse(localStorage.getItem('waveforge_last_result') || 'null'));
    } catch {
      setLastAsset(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedAssetId && history[0]) setSelectedAssetId(history[0].id);
  }, [history, selectedAssetId]);

  useEffect(() => setAssetSlot(document.getElementById('roblox-selected-asset-slot')), []);

  const historyAsset = history.find((item) => item.id === selectedAssetId);
  const selectedAsset: LastResult | null = historyAsset
    ? {
        fileUrl: historyAsset.downloadUrl,
        fileName: historyAsset.fileName,
        title: historyAsset.title,
        artist: historyAsset.artist,
        format: historyAsset.format
      }
    : lastAsset;

  async function handleValidateCreator() {
    if (!id.trim()) return setCreatorStatus('Creator ID is required.');
    setBusy(true);
    try {
      const result = await validateRoblox(type, id.trim());
      setCreatorStatus(result.valid ? `Valid: ${result.name || result.displayName || id}` : result.error || 'Creator not found.');
    } catch {
      setCreatorStatus('Creator validation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleValidateKey() {
    if (!apiKey.trim()) return setKeyStatus('API key is required.');
    setKeyStatus('Checking API key...');
    try {
      const response = await fetch('/api/roblox/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
      const result = await response.json();
      setKeyStatus(result.valid ? 'API key accepted.' : result.error || 'API key rejected.');
    } catch {
      setKeyStatus('Could not validate API key.');
    }
  }

  async function handlePublish() {
    if (!selectedAsset) return setStatus('Select an asset from conversion history first.');
    if (!id.trim() || !apiKey.trim()) return setStatus('Complete creator ID and API key first.');
    setBusy(true);
    setStatus('Uploading asset to Roblox...');
    try {
      const response = await fetch('/api/publish-roblox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: selectedAsset.fileUrl,
          name: name.trim() || selectedAsset.title,
          description,
          api_key: apiKey,
          creator_type: type,
          creator_id: id.trim()
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Publish failed.');
      setStatus(`Upload accepted. Operation ID: ${result.operation_id || 'processing'}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      setBusy(false);
    }
  }

  const selectedAssetCard = <aside className="publish-preview">
    <span className="eyebrow">Selected asset</span>
    <label className="asset-history-label">Choose from conversion history
      <select className="asset-history-select" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} disabled={!history.length}>
        {!history.length && <option value="">No converted assets yet</option>}
        {history.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.format.toUpperCase()}</option>)}
      </select>
    </label>
    {selectedAsset ? <>
      <div className="selected-history-item"><div className="selected-history-icon">♫</div><div className="selected-history-copy"><strong>{selectedAsset.title}</strong><span>{selectedAsset.artist || 'Unknown artist'}</span><small>{selectedAsset.format.toUpperCase()} · Ready to publish</small></div></div>
      <button className="convert-button" onClick={() => void handlePublish()} disabled={busy}>{busy ? 'Publishing...' : 'Publish to Roblox'}</button>
    </> : <div className="asset-empty">No converted asset yet.<br /><span>Go to Converter first.</span></div>}
    <div className="status-line"><span className="status-dot" /> {status}</div>
  </aside>;

  return <><section className="panel roblox-panel" id="roblox">
    <div className="roblox-title"><div><span className="eyebrow">Creator workflow</span><h2>Roblox publishing</h2><p className="muted">Publish your converted audio directly to a Roblox user or group.</p></div><span className="live-badge"><span className="status-dot" /> Open Cloud</span></div>
    <div className="roblox-steps"><span className="active">01 Creator</span><span>02 Asset details</span><span>03 Publish</span></div>
    <div className="roblox-layout"><div>
      <div className="form-section"><h3>Creator destination</h3><div className="roblox-form"><select value={type} onChange={(event) => setType(event.target.value as 'user' | 'group')}><option value="user">User ID</option><option value="group">Group ID</option></select><input value={id} onChange={(event) => setId(event.target.value)} placeholder={type === 'user' ? 'Enter user ID' : 'Enter group ID'} /><button className="primary-button" onClick={() => void handleValidateCreator()} disabled={busy}>Validate</button></div><span className="field-status">{creatorStatus}</span></div>
      <div className="form-section"><h3>Open Cloud API key</h3><div className="key-row"><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste API key" /><button className="secondary-button" onClick={() => void handleValidateKey()}>Check key</button></div><span className="field-status">{keyStatus}</span></div>
      <div className="form-section"><h3>Asset details</h3><div className="detail-grid"><label>Display name<input maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder={selectedAsset?.title || 'Audio asset name'} /></label><label>Description<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label></div></div>
    </div></div>
  </section>{assetSlot && createPortal(selectedAssetCard, assetSlot)}</>;
}
