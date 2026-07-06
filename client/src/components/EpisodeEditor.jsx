import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import { Music, Image as ImageIcon, Plus, Trash2, ArrowLeft, Eye, Code } from 'lucide-react';
import { api } from '../api';
import { Card, Button, Toggle, DropZone } from './ui.jsx';

function toLocalInput(iso) {
  // published_at is stored as 'YYYY-MM-DD HH:MM:SS' UTC — normalize before parsing.
  const d = new Date(String(iso).includes(' ') ? iso.replace(' ', 'T') + 'Z' : iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EmbedSnippet({ episodeId }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<iframe src="${location.origin}/embed/${episodeId}" width="100%" height="110" frameborder="0" title="Podcast player"></iframe>`;
  return (
    <div>
      <div className="flex items-start gap-2">
        <code className="flex-1 block text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400 break-all">{snippet}</code>
        <Button
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-zinc-600 mt-2">Paste into any blog post or newsletter to embed this episode's player.</p>
    </div>
  );
}

export default function EpisodeEditor({ episodeId, onBack }) {
  const [ep, setEp] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [artBusy, setArtBusy] = useState(false);

  function load() {
    api.episode(episodeId).then((data) => {
      setEp(data);
      setChapters(data.chapters || []);
    });
  }
  useEffect(load, [episodeId]);

  function set(k, v) {
    setEp((e) => ({ ...e, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateEpisode(episodeId, ep);
      setEp((e) => ({ ...e, ...updated }));
      await api.saveChapters(episodeId, chapters);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAudio(file) {
    setAudioBusy(true);
    setAudioProgress(0);
    try {
      const updated = await api.uploadEpisodeAudio(episodeId, file, setAudioProgress);
      setEp((e) => ({ ...e, ...updated }));
    } finally {
      setAudioBusy(false);
    }
  }

  async function uploadArtwork(file) {
    setArtBusy(true);
    try {
      const { url } = await api.uploadEpisodeArtwork(episodeId, file);
      set('artwork_path', url);
    } finally {
      setArtBusy(false);
    }
  }

  function addChapter() {
    setChapters((c) => [...c, { start_sec: 0, title: '' }]);
  }
  function updateChapter(i, patch) {
    setChapters((c) => c.map((ch, idx) => (idx === i ? { ...ch, ...patch } : ch)));
  }
  function removeChapter(i) {
    setChapters((c) => c.filter((_, idx) => idx !== i));
  }

  if (!ep) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer">
        <ArrowLeft size={15} /> Back to episodes
      </button>

      <Card title="Episode audio">
        {ep.audio_path ? (
          <div className="flex items-center gap-3">
            <Music size={20} className="text-violet-400" />
            <div className="text-sm text-zinc-300 flex-1">
              {(ep.audio_bytes / (1024 * 1024)).toFixed(1)} MB · {Math.round(ep.audio_duration_sec)}s · {ep.mime}
            </div>
            <label className="text-xs text-violet-400 hover:underline cursor-pointer">
              Replace
              <input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <DropZone accept="audio/mpeg,audio/mp4,.mp3,.m4a" label="Drop an MP3 or M4A here, or click to browse" hint="Streamed straight to disk — large files OK" busy={audioBusy} progress={audioProgress} onFile={uploadAudio} />
        )}
      </Card>

      <div className="grid md:grid-cols-3 gap-5">
        <Card title="Details" className="md:col-span-2">
          <div className="space-y-3">
            <div>
              <label>Title</label>
              <input value={ep.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label>Season</label>
                <input type="number" value={ep.season_no ?? ''} onChange={(e) => set('season_no', e.target.value)} />
              </div>
              <div>
                <label>Episode #</label>
                <input type="number" value={ep.episode_no ?? ''} onChange={(e) => set('episode_no', e.target.value)} />
              </div>
              <div>
                <label>Type</label>
                <select value={ep.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="full">Full</option>
                  <option value="trailer">Trailer</option>
                  <option value="bonus">Bonus</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label>Publish date</label>
                <input type="datetime-local" value={toLocalInput(ep.published_at)} onChange={(e) => set('published_at', new Date(e.target.value).toISOString())} />
              </div>
              <Toggle checked={!!ep.explicit} onChange={(v) => set('explicit', v)} label="Explicit" />
            </div>
            <p className="text-xs text-zinc-500">Future publish date = scheduled (hidden from the feed and public page until then).</p>
          </div>
        </Card>

        <Card title="Episode artwork (optional)">
          {ep.artwork_path ? (
            <img src={ep.artwork_path} alt="" className="w-full aspect-square object-cover rounded-lg border border-zinc-700" />
          ) : (
            <DropZone accept="image/png,image/jpeg" label="Drop artwork" hint="Overrides show artwork for this episode" busy={artBusy} onFile={uploadArtwork}>
              <div className="flex flex-col items-center gap-1.5 text-zinc-500 py-4">
                <ImageIcon size={20} />
                <span className="text-xs">Optional per-episode artwork</span>
              </div>
            </DropZone>
          )}
        </Card>
      </div>

      <Card title="Show notes (Markdown)" actions={
        <button onClick={() => setPreview((p) => !p)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer">
          {preview ? <Code size={13} /> : <Eye size={13} />} {preview ? 'Edit' : 'Preview'}
        </button>
      }>
        {preview ? (
          <div className="prose prose-invert prose-sm max-w-none bg-zinc-950 border border-zinc-800 rounded-lg p-4" dangerouslySetInnerHTML={{ __html: marked.parse(ep.notes_md || '') }} />
        ) : (
          <textarea rows={10} value={ep.notes_md} onChange={(e) => set('notes_md', e.target.value)} placeholder="## What we cover&#10;&#10;- Point one&#10;- Point two" />
        )}
      </Card>

      <Card title="Chapters" actions={
        <button onClick={addChapter} className="flex items-center gap-1.5 text-xs text-violet-400 hover:underline cursor-pointer">
          <Plus size={13} /> Add chapter
        </button>
      }>
        {chapters.length === 0 && <p className="text-sm text-zinc-500">No chapters. Add start times to power chapter markers in podcast apps.</p>}
        <div className="space-y-2">
          {chapters.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                className="w-24"
                value={c.start_sec}
                onChange={(e) => updateChapter(i, { start_sec: Number(e.target.value) })}
                placeholder="sec"
              />
              <input className="flex-1" value={c.title} onChange={(e) => updateChapter(i, { title: e.target.value })} placeholder="Chapter title" />
              <button onClick={() => removeChapter(i)} className="p-2 rounded-lg hover:bg-red-600/20 text-zinc-400 hover:text-red-400 cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {ep.audio_path && (
        <Card title="Embeddable player">
          <EmbedSnippet episodeId={ep.id} />
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save episode'}
        </Button>
        {saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
      </div>
    </div>
  );
}
