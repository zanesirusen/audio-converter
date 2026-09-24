import { useMemo } from 'react';
import { DownloadButton } from '../../components/DownloadButton';
import { useHistory } from '../../stores/appStore';

export function AssetLibrary() {
  const history = useHistory();
  const formats = useMemo(() => [...new Set(history.map((item) => item.format))], [history]);
  return <section className="asset-library panel"><div className="asset-overview"><div><span className="eyebrow">Audio vault</span><h2>Ready-to-use assets</h2><p className="muted">Your converted files in one organized place.</p></div><div className="asset-metrics" aria-label="Asset summary"><div><b>{history.length}</b><span>Files</span></div><div><b>{formats.length}</b><span>Formats</span></div><div><b>{history.filter((item) => item.platform === 'youtube').length}</b><span>YouTube uploads</span></div></div></div><div className="asset-grid">{history.length ? history.map((item) => <article className="asset-card" key={item.id}><div className="asset-icon">♫</div><div className="asset-copy"><strong>{item.title}</strong><span>{item.artist || 'Unknown artist'}</span><small>{item.format.toUpperCase()} · {new Date(item.createdAt).toLocaleDateString('id-ID')}</small></div><DownloadButton compact url={item.downloadUrl} filename={item.fileName} /></article>) : <div className="empty-state">Belum ada asset. Convert audio pertama kamu untuk mengisinya.</div>}</div></section>;
}
