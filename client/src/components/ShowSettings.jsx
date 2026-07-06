import React, { useEffect, useState } from 'react';
import { Card, Button, Toggle, ImageUpload } from './ui.jsx';
import { api } from '../api';

export default function ShowSettings({ showId }) {
  const [show, setShow] = useState(null);
  const [meta, setMeta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    api.show(showId).then(setShow);
    api.meta().then(setMeta);
  }, [showId]);

  function set(k, v) {
    setShow((s) => ({ ...s, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateShow(showId, show);
      setShow(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!show || !meta) return <div className="text-zinc-500 text-sm">Loading…</div>;
  const subcats = meta.categories[show.category] || [];

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Card title="Artwork">
        <ImageUpload
          value={show.artwork_path}
          warning={warning}
          onUpload={(file) => api.uploadShowArtwork(showId, file)}
          onChange={(url, w) => {
            set('artwork_path', url);
            setWarning(w);
          }}
        />
        <p className="text-xs text-zinc-500 mt-3">Apple requires JPG/PNG, 1400x1400 to 3000x3000px, RGB color space.</p>
      </Card>

      <Card title="Show details">
        <div className="space-y-3">
          <div>
            <label>Title</label>
            <input value={show.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label>Description</label>
            <textarea rows={3} value={show.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Author</label>
              <input value={show.author} onChange={(e) => set('author', e.target.value)} />
            </div>
            <div>
              <label>Owner email (itunes:owner)</label>
              <input type="email" value={show.owner_email} onChange={(e) => set('owner_email', e.target.value)} />
            </div>
          </div>
          <div>
            <label>Site link</label>
            <input value={show.link} onChange={(e) => set('link', e.target.value)} placeholder="https://yourshow.com" />
          </div>
        </div>
      </Card>

      <Card title="Apple Podcasts category">
        <div className="space-y-3">
          <div>
            <label>Category</label>
            <select
              value={show.category}
              onChange={(e) => {
                set('category', e.target.value);
                set('subcategory', '');
              }}
            >
              {Object.keys(meta.categories).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {subcats.length > 0 && (
            <div>
              <label>Subcategory</label>
              <select value={show.subcategory || ''} onChange={(e) => set('subcategory', e.target.value)}>
                <option value="">None</option>
                {subcats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label>Language</label>
              <input value={show.language} onChange={(e) => set('language', e.target.value)} placeholder="en" />
            </div>
            <Toggle checked={!!show.explicit} onChange={(v) => set('explicit', v)} label="Explicit content" />
          </div>
        </div>
      </Card>

      <Card title="Feed & subscribe links">
        <div className="space-y-2 text-sm">
          <FeedLink label="RSS feed" href={`/feed/${show.slug}.xml`} />
          <FeedLink label="Public page" href={`/p/${show.slug}`} />
        </div>
      </Card>

      <div className="md:col-span-2 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
      </div>
    </div>
  );
}

function FeedLink({ label, href }) {
  return (
    <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <a href={href} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline truncate max-w-[220px]">
          {href}
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(location.origin + href)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
