import { useState } from 'react';
import { useRobloxSettings, saveRobloxSettings, clearRobloxSettings } from '../../stores/robloxSettingsStore';

export function RobloxSettingsPage() {
  const saved = useRobloxSettings();

  // Local form state (drafts — not committed until Save)
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [creatorType, setCreatorType] = useState<'user' | 'group'>(saved.creatorType);
  const [creatorId, setCreatorId] = useState(saved.creatorId);
  const [defaultAssetName, setDefaultAssetName] = useState(saved.defaultAssetName);

  const [apiKeyStatus, setApiKeyStatus] = useState<string>(
    saved.apiKeyValid ? '✓ API key saved & validated' : saved.apiKey ? 'API key saved but not validated yet' : ''
  );
  const [creatorStatus, setCreatorStatus] = useState<string>(
    saved.creatorValid ? `✓ ${saved.creatorName || saved.creatorId} saved & validated` : saved.creatorId ? 'Creator ID saved but not validated yet' : ''
  );
  const [apiKeyOk, setApiKeyOk] = useState(saved.apiKeyValid);
  const [creatorOk, setCreatorOk] = useState(saved.creatorValid);
  const [validatingKey, setValidatingKey] = useState(false);
  const [validatingCreator, setValidatingCreator] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  async function handleValidateKey() {
    if (!apiKey.trim()) { setApiKeyStatus('API key tidak boleh kosong.'); setApiKeyOk(false); return; }
    setValidatingKey(true);
    setApiKeyStatus('Checking…');
    try {
      const res = await fetch('/api/roblox/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json() as { valid: boolean; message?: string; error?: string };
      if (data.valid) {
        setApiKeyStatus(`✓ ${data.message || 'API key valid.'}`);
        setApiKeyOk(true);
      } else {
        setApiKeyStatus(`✗ ${data.error || 'API key tidak valid.'}`);
        setApiKeyOk(false);
      }
    } catch {
      setApiKeyStatus('✗ Gagal menghubungi server.');
      setApiKeyOk(false);
    } finally {
      setValidatingKey(false);
    }
  }

  async function handleValidateCreator() {
    if (!creatorId.trim()) { setCreatorStatus('Creator ID tidak boleh kosong.'); setCreatorOk(false); return; }
    setValidatingCreator(true);
    setCreatorStatus('Checking…');
    try {
      const endpoint = creatorType === 'user' ? '/api/roblox/validate-user' : '/api/roblox/validate-group';
      const body = creatorType === 'user' ? { user_id: creatorId.trim() } : { group_id: creatorId.trim() };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { valid: boolean; name?: string; displayName?: string; error?: string };
      if (data.valid) {
        const name = data.displayName || data.name || creatorId.trim();
        setCreatorStatus(`✓ ${name} (${creatorType})`);
        setCreatorOk(true);
        // Save display name for later use
        saveRobloxSettings({ creatorName: name });
      } else {
        setCreatorStatus(`✗ ${data.error || 'Creator tidak ditemukan.'}`);
        setCreatorOk(false);
      }
    } catch {
      setCreatorStatus('✗ Gagal menghubungi server.');
      setCreatorOk(false);
    } finally {
      setValidatingCreator(false);
    }
  }

  function handleSave() {
    saveRobloxSettings({
      apiKey: apiKey.trim(),
      creatorType,
      creatorId: creatorId.trim(),
      defaultAssetName: defaultAssetName.trim(),
      apiKeyValid: apiKeyOk,
      creatorValid: creatorOk,
    });
    setSaveMsg('✓ Settings saved!');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  function handleClear() {
    clearRobloxSettings();
    setApiKey('');
    setCreatorType('user');
    setCreatorId('');
    setDefaultAssetName('');
    setApiKeyStatus('');
    setCreatorStatus('');
    setApiKeyOk(false);
    setCreatorOk(false);
    setSaveMsg('Settings cleared.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  const isReady = apiKeyOk && creatorOk;
  const isDirty =
    apiKey.trim() !== saved.apiKey ||
    creatorType !== saved.creatorType ||
    creatorId.trim() !== saved.creatorId ||
    defaultAssetName.trim() !== saved.defaultAssetName;

  return (
    <div className="settings-page">
      {/* ── Header ── */}
      <div className="settings-header">
        <div>
          <span className="eyebrow">⌘ Roblox</span>
          <h1>Roblox Settings</h1>
          <p className="muted">Simpan API key dan Creator ID kamu sekali, lalu publish langsung dari halaman Converter.</p>
        </div>
        {/* Connection status badge */}
        <div className={`settings-status-badge ${isReady ? 'ready' : 'not-ready'}`}>
          <span className={`status-dot ${isReady ? '' : 'red'}`} />
          {isReady ? 'Ready to publish' : 'Not configured'}
        </div>
      </div>

      <div className="settings-grid">
        {/* ── Left: forms ── */}
        <div className="settings-forms">

          {/* API Key */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className={`settings-step-badge ${apiKeyOk ? 'done' : ''}`}>{apiKeyOk ? '✓' : '01'}</span>
                <h2>Open Cloud API Key</h2>
              </div>
              <p className="muted">Buat API key di <a href="https://create.roblox.com/credentials" target="_blank" rel="noopener noreferrer" className="settings-link">Roblox Creator Hub</a> dengan permission <code>asset:write</code>.</p>
            </div>
            <div className="settings-field">
              <label htmlFor="api-key-input">API Key</label>
              <div className="settings-input-row">
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setApiKeyOk(false); setApiKeyStatus(''); }}
                  placeholder="Paste API key kamu di sini"
                  className="settings-input"
                  autoComplete="off"
                />
                <button
                  className="secondary-button"
                  onClick={() => void handleValidateKey()}
                  disabled={validatingKey || !apiKey.trim()}
                >
                  {validatingKey ? '…' : 'Validate'}
                </button>
              </div>
              {apiKeyStatus && (
                <span className={`settings-field-status ${apiKeyOk ? 'ok' : apiKeyStatus.startsWith('✗') ? 'err' : 'muted-status'}`}>
                  {apiKeyStatus}
                </span>
              )}
            </div>
          </section>

          {/* Creator ID */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className={`settings-step-badge ${creatorOk ? 'done' : ''}`}>{creatorOk ? '✓' : '02'}</span>
                <h2>Creator Destination</h2>
              </div>
              <p className="muted">User ID atau Group ID tempat audio akan di-publish. Bisa dicek di URL profil Roblox kamu.</p>
            </div>
            <div className="settings-field">
              <label>Creator type</label>
              <div className="settings-type-toggle">
                <button
                  className={`type-btn ${creatorType === 'user' ? 'active' : ''}`}
                  onClick={() => { setCreatorType('user'); setCreatorOk(false); setCreatorStatus(''); }}
                >
                  👤 User
                </button>
                <button
                  className={`type-btn ${creatorType === 'group' ? 'active' : ''}`}
                  onClick={() => { setCreatorType('group'); setCreatorOk(false); setCreatorStatus(''); }}
                >
                  👥 Group
                </button>
              </div>
            </div>
            <div className="settings-field">
              <label htmlFor="creator-id-input">{creatorType === 'user' ? 'User' : 'Group'} ID</label>
              <div className="settings-input-row">
                <input
                  id="creator-id-input"
                  type="text"
                  value={creatorId}
                  onChange={(e) => { setCreatorId(e.target.value); setCreatorOk(false); setCreatorStatus(''); }}
                  placeholder={`Masukkan ${creatorType === 'user' ? 'user' : 'group'} ID`}
                  className="settings-input"
                />
                <button
                  className="secondary-button"
                  onClick={() => void handleValidateCreator()}
                  disabled={validatingCreator || !creatorId.trim()}
                >
                  {validatingCreator ? '…' : 'Validate'}
                </button>
              </div>
              {creatorStatus && (
                <span className={`settings-field-status ${creatorOk ? 'ok' : creatorStatus.startsWith('✗') ? 'err' : 'muted-status'}`}>
                  {creatorStatus}
                </span>
              )}
            </div>
          </section>

          {/* Default asset name */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className="settings-step-badge">03</span>
                <h2>Asset Name (opsional)</h2>
              </div>
              <p className="muted">Prefix default untuk nama asset di Roblox. Kalau kosong akan pakai judul lagu.</p>
            </div>
            <div className="settings-field">
              <label htmlFor="default-asset-input">Default asset name prefix</label>
              <input
                id="default-asset-input"
                type="text"
                value={defaultAssetName}
                onChange={(e) => setDefaultAssetName(e.target.value)}
                placeholder="Contoh: MyGame_"
                className="settings-input"
                maxLength={40}
              />
            </div>
          </section>

          {/* Save / Clear buttons */}
          <div className="settings-actions">
            <button
              className="convert-button settings-save-btn"
              onClick={handleSave}
              disabled={!apiKey.trim() || !creatorId.trim()}
            >
              {isDirty ? 'Save Settings' : 'Settings Saved'}
            </button>
            <button className="secondary-button" onClick={handleClear}>
              Clear all
            </button>
            {saveMsg && <span className={`settings-save-msg ${saveMsg.startsWith('✓') ? 'ok' : ''}`}>{saveMsg}</span>}
          </div>
        </div>

        {/* ── Right: status summary ── */}
        <aside className="settings-rail">
          <section className="panel settings-summary">
            <span className="eyebrow">Current config</span>
            <h3>Saved settings</h3>

            <div className="summary-row">
              <span className="summary-label">API Key</span>
              <span className={`summary-value ${saved.apiKeyValid ? 'ok' : 'missing'}`}>
                {saved.apiKey ? (saved.apiKeyValid ? '✓ Validated' : '⚠ Not validated') : '— Not set'}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Creator</span>
              <span className={`summary-value ${saved.creatorValid ? 'ok' : 'missing'}`}>
                {saved.creatorId
                  ? saved.creatorValid
                    ? `✓ ${saved.creatorName || saved.creatorId}`
                    : `⚠ ${saved.creatorId} (not validated)`
                  : '— Not set'}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Type</span>
              <span className="summary-value">{saved.creatorType === 'user' ? '👤 User' : '👥 Group'}</span>
            </div>
            {saved.defaultAssetName && (
              <div className="summary-row">
                <span className="summary-label">Name prefix</span>
                <span className="summary-value">{saved.defaultAssetName}</span>
              </div>
            )}

            <div className={`summary-ready-box ${isReady ? 'ready' : ''}`}>
              {isReady
                ? '✅ Everything configured — go to Converter to publish!'
                : '⚠ Validate API key and Creator ID, then Save to enable publishing.'}
            </div>
          </section>

          <section className="panel settings-guide">
            <span className="eyebrow">How to get your API key</span>
            <ol className="settings-guide-steps">
              <li>Buka <a href="https://create.roblox.com/credentials" target="_blank" rel="noopener noreferrer" className="settings-link">create.roblox.com/credentials</a></li>
              <li>Klik <strong>Create API Key</strong></li>
              <li>Di bagian <em>Access Permissions</em>, tambahkan <strong>Assets API</strong></li>
              <li>Set operation: <strong>asset:write</strong></li>
              <li>Copy key dan paste di form sebelah kiri</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
