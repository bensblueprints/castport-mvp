import React, { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

export function Card({ title, children, actions, className = '' }) {
  return (
    <div className={`bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-violet-600 hover:bg-violet-500 text-white',
    ghost: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
    danger: 'bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-800'
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 cursor-pointer group" type="button">
      <span className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm text-zinc-300 group-hover:text-white">{label}</span>}
    </button>
  );
}

export function StatusChip({ status }) {
  const styles = {
    published: 'bg-emerald-600/20 text-emerald-300 border-emerald-800',
    scheduled: 'bg-amber-600/20 text-amber-300 border-amber-800',
    draft: 'bg-zinc-700/40 text-zinc-300 border-zinc-600'
  };
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[status] || styles.draft}`}>{status}</span>;
}

// Drop zone for a single file (image or audio), with progress + hover states.
export function DropZone({ accept, label, hint, busy, progress, onFile, children }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        drag ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 hover:border-zinc-500'
      }`}
    >
      {children || (
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          {busy ? <Loader2 size={22} className="animate-spin text-violet-400" /> : <Upload size={22} />}
          <div className="text-sm font-medium">{busy ? `Uploading… ${progress ?? 0}%` : label}</div>
          {hint && !busy && <div className="text-xs text-zinc-600">{hint}</div>}
          {busy && (
            <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress ?? 0}%` }} />
            </div>
          )}
        </div>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

export function ImageUpload({ value, onChange, onUpload, warning }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(file) {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const { url, warning: w } = await onUpload(file);
      onChange(url, w);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt="" className="w-20 h-20 object-cover rounded-lg border border-zinc-700" />
            <button
              onClick={() => ref.current?.click()}
              className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-600 rounded-full p-0.5 hover:bg-violet-600 cursor-pointer"
              title="Replace"
            >
              <Upload size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="w-20 h-20 flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 hover:border-violet-500 text-zinc-500 hover:text-violet-400 transition-colors cursor-pointer"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </button>
        )}
        <div className="text-xs text-zinc-500">Square PNG/JPG, 1400-3000px</div>
      </div>
      {warning && <div className="text-xs text-amber-400 mt-1.5">⚠ {warning}</div>}
      {err && <div className="text-xs text-red-400 mt-1.5">{err}</div>}
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
