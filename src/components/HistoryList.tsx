import { useMemo, useState } from 'react';
import { clearHistory, useHistory } from '../stores/appStore';
import { DownloadButton } from './DownloadButton';

export function HistoryList() {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => history.filter((item) => `${item.title} ${item.artist} ${item.format}`.toLowerCase().includes(query.toLowerCase())), [history, query]);
  return <section className="panel history-panel" id="history">
    <div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Conversion history</h2></div><button className="text-button" onClick={clearHistory} disabled={!history.length}>Clear all</button></div>
    <div className="history-summary"><span><b>{history.length}</b>Total files</span><span><b>{new Set(history.map((item) => item.format)).size}</b>Formats</span><span><b>{history.filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length}</b>Today</span></div>
    <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, artist, format" />
    <div className="history-list">{filtered.length ? filtered.map((item) => <div className="history-row" key={item.id}><div className="history-art">♫</div><div className="history-copy"><strong>{item.title}</strong><span>{item.artist || 'Unknown artist'} · {item.format.toUpperCase()} · {new Date(item.createdAt).toLocaleDateString('id-ID')}</span></div><DownloadButton compact url={item.downloadUrl} filename={item.fileName} /></div>) : <div className="empty-state">Belum ada hasil convert yang cocok.</div>}</div>
  </section>;
}
