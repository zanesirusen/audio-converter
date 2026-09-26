import { useEffect, useState } from 'react';
import { useRobloxSettings, saveRobloxSettings, clearRobloxSettings } from '../../stores/robloxSettingsStore';
import { useHistory } from '../../stores/appStore';

export function RobloxSettingsPage() {
  const saved = useRobloxSettings();
  const history = useHistory();

  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [creatorType, setCreatorType] = useState<'user' | 'group'>(saved.creatorType);
  const [creatorId, setCreatorId] = useState(saved.creatorId);
  const [defaultAssetName, setDefaultAssetName] = useState(saved.defaultAssetName);

  const [apiKeyStatus, setApiKeyStatus] = useState<string>(
    saved.apiKeyValid ? '✓ API key saved & validated' : saved.apiKey ? 'API key saved but not validated yet' : ''
  );
  const [permissions, setPermissions] = useState<string[]>([]);
  const [hasWrite, setHasWrite] = useState(saved.apiKeyValid);
  const [apiKeyWarn, setApiKeyWarn] = useState<string>('');

  const [creatorStatus, setCreatorStatus] = useState<string>(
    saved.creatorValid ? `✓ ${saved.creatorName || saved.creatorId} saved & validated` : saved.creatorId ? 'Creator ID saved but not validated yet' : ''
  );
  const [apiKeyOk, setApiKeyOk] = useState(saved.apiKeyValid);
  const [creatorOk, setCreatorOk] = useState(saved.creatorValid);
  const [validatingKey, setValidatingKey] = useState(false);
  const [validatingCreator, setValidatingCreator] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Auto-detect asset name from last converted file
  useEffect(() => {
    if (!defaultAssetName && history.length > 0) {
      const last = history[0];
      const autoName = last.title ? last.title.slice(0, 40) : '';
      if (autoName) setDefaultAssetName(autoName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleValidateKey() {
    if (!apiKey.trim()) { setApiKeyStatus('API key tidak boleh kosong.'); setApiKeyOk(false); return; }
    setValidatingKey(true);
    setApiKeyStatus('Checking…');
    setPermissions([]);
    setApiKeyWarn('');
    try {
      const res = await fetch('/api/roblox/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json() as {
        valid: boolean;
        message?: string;
        error?: string;
        permissions?: string[];
        has_write?: boolean;
        warning?: string | null;
      };
      if (data.valid) {
        setApiKeyStatus(`${data.message || 'API key valid.'}`);
        setApiKeyOk(true);
        setPermissions(data.permissions || []);
        setHasWrite(data.has_write ?? true);
        if (data.warning) setApiKeyWarn(data.warning);
      } else {
        setApiKeyStatus(`✗ ${data.error || 'API key tidak valid.'}`);
        setApiKeyOk(false);
        setHasWrite(false);
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
      const data = await res.json() as { valid: boolean; name?: string; displayName?: string; memberCount?: number; error?: string };
      if (data.valid) {
        const name = data.displayName || data.name || creatorId.trim();
        const extra = data.memberCount ? ` · ${data.memberCount.toLocaleString()} members` : '';
        setCreatorStatus(`✓ ${name} (${creatorType})${extra}`);
        setCreatorOk(true);
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
      apiKeyValid: apiKeyOk && hasWrite,
      creatorValid: creatorOk,
    });
    setSaveMsg('✓ Settings saved!');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  function handleClear() {
    clearRobloxSettings();
    setApiKey(''); setCreatorType('user'); setCreatorId(''); setDefaultAssetName('');
    setApiKeyStatus(''); setCreatorStatus(''); setApiKeyOk(false); setCreatorOk(false);
    setPermissions([]); setHasWrite(false); setApiKeyWarn('');
    setSaveMsg('Settings cleared.');
    setTimeout(() => setSaveMsg(''), 3000);
  }

  const isReady = apiKeyOk && hasWrite && creatorOk;
  const isDirty =
    apiKey.trim() !== saved.apiKey ||
    creatorType !== saved.creatorType ||
    creatorId.trim() !== saved.creatorId ||
    defaultAssetName.trim() !== saved.defaultAssetName;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <span className="eyebrow">⌘ Roblox</span>
          <h1>Roblox Settings</h1>
          <p className="muted">Simpan API key dan Creator ID kamu sekali, lalu publish langsung dari halaman Converter.</p>
        </div>
        <div className={`settings-status-badge ${isReady ? 'ready' : 'not-ready'}`}>
          <span className={`status-dot ${isReady ? '' : 'red'}`} />
          {isReady ? 'Ready to publish' : 'Not configured'}
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-forms">

          {/* ── API Key ── */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className={`settings-step-badge ${apiKeyOk && hasWrite ? 'done' : ''}`}>{apiKeyOk && hasWrite ? '✓' : '01'}</span>
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
                  onChange={(e) => { setApiKey(e.target.value); setApiKeyOk(false); setApiKeyStatus(''); setPermissions([]); setApiKeyWarn(''); }}
                  placeholder="Paste API key kamu di sini"
                  className="settings-input"
                  autoComplete="off"
                />
                <button className="secondary-button" onClick={() => void handleValidateKey()} disabled={validatingKey || !apiKey.trim()}>
                  {validatingKey ? '…' : 'Validate'}
                </button>
              </div>
              {apiKeyStatus && (
                <span className={`settings-field-status ${apiKeyOk ? 'ok' : apiKeyStatus.startsWith('✗') ? 'err' : 'muted-status'}`}>
                  {apiKeyStatus}
                </span>
              )}
              {/* Permission badges */}
              {permissions.length > 0 && (
                <div className="permission-badges">
                  <span className="permission-label">Detected permissions:</span>
                  {permissions.map(p => (
                    <span key={p} className={`permission-badge ${p === 'asset:write' ? 'perm-write' : 'perm-read'}`}>
                      {p === 'asset:write' ? '✓' : '◎'} {p}
                    </span>
                  ))}
                  {!permissions.includes('asset:write') && (
                    <span className="permission-badge perm-missing">✗ asset:write missing</span>
                  )}
                </div>
              )}
              {apiKeyWarn && (
                <div className="settings-key-warn">
                  ⚠ {apiKeyWarn}
                  <a href="https://create.roblox.com/credentials" target="_blank" rel="noopener noreferrer" className="settings-link"> → Fix on Roblox</a>
                </div>
              )}
            </div>
          </section>

          {/* ── Creator ID ── */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className={`settings-step-badge ${creatorOk ? 'done' : ''}`}>{creatorOk ? '✓' : '02'}</span>
                <h2>Creator Destination</h2>
              </div>
              <p className="muted">User ID atau Group ID tempat audio akan di-publish.</p>
            </div>
            <div className="settings-field">
              <label>Creator type</label>
              <div className="settings-type-toggle">
                <button className={`type-btn ${creatorType === 'user' ? 'active' : ''}`} onClick={() => { setCreatorType('user'); setCreatorOk(false); setCreatorStatus(''); }}>👤 User</button>
                <button className={`type-btn ${creatorType === 'group' ? 'active' : ''}`} onClick={() => { setCreatorType('group'); setCreatorOk(false); setCreatorStatus(''); }}>👥 Group</button>
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
                <button className="secondary-button" onClick={() => void handleValidateCreator()} disabled={validatingCreator || !creatorId.trim()}>
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

          {/* ── Default asset name ── */}
          <section className="panel settings-section">
            <div className="settings-section-header">
              <div>
                <span className="settings-step-badge">03</span>
                <h2>Default Asset Name</h2>
              </div>
              <p className="muted">Nama default untuk asset. Kalau kosong akan pakai judul lagu otomatis.</p>
            </div>
            <div className="settings-field">
              <label htmlFor="default-asset-input">Asset name / prefix</label>
              <div className="settings-input-row">
                <input
                  id="default-asset-input"
                  type="text"
                  value={defaultAssetName}
                  onChange={(e) => setDefaultAssetName(e.target.value)}
                  placeholder={history[0]?.title || 'Contoh: MyGame_BGM'}
                  className="settings-input"
                  maxLength={50}
                />
                {history[0] && !defaultAssetName && (
                  <button className="secondary-button" onClick={() => setDefaultAssetName(history[0].title.slice(0, 50))}>
                    Auto-fill
                  </button>
                )}
              </div>
              {history[0] && (
                <span className="settings-field-status muted-status">
                  Last converted: {history[0].title} · {history[0].format.toUpperCase()}
                </span>
              )}
            </div>
          </section>

          {/* ── Save / Clear ── */}
          <div className="settings-actions">
            <button className="convert-button settings-save-btn" onClick={handleSave} disabled={!apiKey.trim() || !creatorId.trim()}>
              {isDirty ? 'Save Settings' : 'Settings Saved'}
            </button>
            <button className="secondary-button" onClick={handleClear}>Clear all</button>
            {saveMsg && <span className={`settings-save-msg ${saveMsg.startsWith('✓') ? 'ok' : ''}`}>{saveMsg}</span>}
          </div>
        </div>

        {/* ── Right rail ── */}
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
                {saved.creatorId ? (saved.creatorValid ? `✓ ${saved.creatorName || saved.creatorId}` : `⚠ ${saved.creatorId}`) : '— Not set'}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Type</span>
              <span className="summary-value">{saved.creatorType === 'user' ? '👤 User' : '👥 Group'}</span>
            </div>
            {saved.defaultAssetName && (
              <div className="summary-row">
                <span className="summary-label">Asset name</span>
                <span className="summary-value">{saved.defaultAssetName}</span>
              </div>
            )}
            <div className={`summary-ready-box ${isReady ? 'ready' : ''}`}>
              {isReady ? '✅ Everything configured — go to Converter to publish!' : '⚠ Validate API key (with asset:write) and Creator ID, then Save.'}
            </div>
          </section>

          <section className="panel settings-guide">
            <span className="eyebrow">How to get your API key</span>
            <ol className="settings-guide-steps">
              <li>Buka <a href="https://create.roblox.com/credentials" target="_blank" rel="noopener noreferrer" className="settings-link">create.roblox.com/credentials</a></li>
              <li>Klik <strong>Create API Key</strong></li>
              <li>Di <em>Access Permissions</em>, pilih <strong>Assets API</strong></li>
              <li>Tambahkan operation: <strong>asset:write</strong></li>
              <li>Di <em>Security</em>, tambahkan IP atau biarkan kosong untuk semua IP</li>
              <li>Klik <strong>Save &amp; Generate Key</strong></li>
              <li>Copy key → paste di form kiri</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
