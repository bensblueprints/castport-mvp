import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Mic, ExternalLink, Trash2, Settings, ListMusic } from 'lucide-react';
import { api } from '../api';
import { Card, Button } from './ui.jsx';

export default function ShowsList({ onOpenShow }) {
  const [shows, setShows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.shows().then(setShows);
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const show = await api.createShow({ title, author: '', description: '' });
      setShows((s) => [show, ...s]);
      setCreating(false);
      setTitle('');
      onOpenShow(show.id);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this show and all its episodes? This cannot be undone.')) return;
    await api.deleteShow(id);
    setShows((s) => s.filter((x) => x.id !== id));
  }

  if (!shows) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Your shows</h1>
        <Button onClick={() => setCreating((v) => !v)}>
          <span className="flex items-center gap-1.5">
            <Plus size={16} /> New show
          </span>
        </Button>
      </div>

      {creating && (
        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} onSubmit={create} className="mb-5">
          <Card>
            <label>Show title</label>
            <div className="flex gap-2">
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Weekly Debrief" />
              <Button disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create'}</Button>
            </div>
          </Card>
        </motion.form>
      )}

      {shows.length === 0 && !creating && (
        <Card className="text-center py-12">
          <Mic size={32} className="mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-400">No shows yet. Create your first show to get an Apple/Spotify-valid RSS feed.</p>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shows.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {s.artwork_path ? (
                <img src={s.artwork_path} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-700" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600">
                  <Mic size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-zinc-500 truncate">/{s.slug}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="ghost" className="flex-1" onClick={() => onOpenShow(s.id)}>
                <span className="flex items-center justify-center gap-1.5">
                  <ListMusic size={14} /> Manage
                </span>
              </Button>
              <a href={`/p/${s.slug}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white" title="View public page">
                <ExternalLink size={15} />
              </a>
              <button onClick={() => remove(s.id)} className="p-2 rounded-lg hover:bg-red-600/20 text-zinc-400 hover:text-red-400 cursor-pointer" title="Delete show">
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
