import { useEffect, useState } from 'react';

interface ActivityItem {
  username: string;
  avatar: string | null;
  userId: string | null;
  title: string;
  artist: string;
  format: string;
  platform: string;
  fileName: string;
  createdAt: string;
}

const PLATFORM_ICON: Record<string, string> = {
  youtube: '▶',
  spotify: '●',
  soundcloud: '◎',
  tiktok: '✦',
  applemusic: '⌘',
  upload: '↑',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivityFeed() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchActivity() {
    try {
      const res = await fetch('/api/activity');
      const data = await res.json() as { activity: ActivityItem[] };
      setActivity(data.activity || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchActivity();
    // Poll every 15 seconds
    const interval = setInterval(() => void fetchActivity(), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="panel activity-panel">
      <div className="rail-heading">
        <h3>🕐 Recent Activity</h3>
        <span className="activity-live">● Live</span>
      </div>

      {loading && <div className="activity-loading">Loading…</div>}

      {!loading && activity.length === 0 && (
        <div className="activity-empty">Belum ada aktivitas. Jadilah yang pertama convert!</div>
      )}

      <div className="activity-list">
        {activity.map((item, i) => (
          <div className="activity-row" key={`${item.userId}-${item.createdAt}-${i}`}>
            {/* Avatar */}
            <div className="activity-avatar">
              {item.avatar
                ? <img src={item.avatar} alt={item.username} />
                : <span>{item.username.slice(0, 1).toUpperCase()}</span>
              }
            </div>
            {/* Info */}
            <div className="activity-info">
              <div className="activity-user">
                <strong>{item.username}</strong>
                <span className="activity-platform">{PLATFORM_ICON[item.platform] || '♫'}</span>
              </div>
              <div className="activity-title">{item.title}</div>
              <div className="activity-meta">{item.format.toUpperCase()} · {timeAgo(item.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
