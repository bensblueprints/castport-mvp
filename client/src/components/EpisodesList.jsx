import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Clock, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { Card, Button, StatusChip } from './ui.jsx';

// published_at is stored as 'YYYY-MM-DD HH:MM:SS' UTC — normalize before parsing.
function parseUtc(s) {
  return new Date(String(s).includes(' ') ? s.replace(' ', 'T') + 'Z' : s);
}

function statusOf(ep) {
  if (!ep.audio_path) return 'draft';
  return parseUtc(ep.published_at) > new Date() ? 'scheduled' : 'published';
}

export default function EpisodesList({ showId, showSlug, onOpenEpisode }) {
  const [episodes, setEpisodes] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    api.episodes(showId).then(setEpisodes);
  }
  useEffect(refresh, [showId]);

  async function createNew() {
    setBusy(true);
    try {
      const ep = await api.createEpisode(showId, { title: 'New episode' });
      onOpenEpisode(ep.id);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this episode?')) return;
    await api.deleteEpisode(id);
    setEpisodes((list) => list.filter((e) => e.id !== id));
  }

  if (!episodes) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Episodes</h2>
        <Button onClick={createNew} disabled={busy}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> New episode
          </span>
        </Button>
      </div>

      {episodes.length === 0 && (
        <Card className="text-center py-10 text-zinc-400">No episodes yet — create one and upload an MP3/M4A.</Card>
      )}

      <div className="space-y-2">
        {episodes.map((ep) => {
          const status = statusOf(ep);
          return (
            <Card key={ep.id} className="flex items-center justify-between gap-3 py-3.5">
              <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => onOpenEpisode(ep.id)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {ep.season_no ? `S${ep.season_no}` : ''}
                    {ep.episode_no ? `E${ep.episode_no} · ` : ''}
                    {ep.title}
                  </span>
                  <StatusChip status={status} />
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                  <Clock size={11} /> {parseUtc(ep.published_at).toLocaleString()}
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {status === 'published' && (
                  <a
                    href={`/p/${showSlug}/${ep.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    title="View episode page"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <button onClick={() => remove(ep.id)} className="p-2 rounded-lg hover:bg-red-600/20 text-zinc-400 hover:text-red-400 cursor-pointer" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
