import React, { useEffect, useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { Card } from './ui.jsx';

function Chart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.downloads));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36">
        {series.map((d) => (
          <div
            key={d.date}
            className="flex-1 bg-violet-500/70 rounded-t-sm min-h-[2px] hover:bg-violet-400 transition-colors"
            style={{ height: `${(d.downloads / max) * 100}%` }}
            title={`${d.date}: ${d.downloads} downloads`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function StatsDashboard({ showId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.statsShow(showId, 30).then(setStats);
  }, [showId]);

  if (!stats) return <div className="text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 text-violet-400 flex items-center justify-center shrink-0">
            <Download size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums">{stats.total}</div>
            <div className="text-xs text-zinc-500">Total downloads</div>
          </div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums">{stats.series.reduce((a, d) => a + d.downloads, 0)}</div>
            <div className="text-xs text-zinc-500">Last 30 days</div>
          </div>
        </div>
      </div>

      <Card title="Downloads — last 30 days">
        <Chart series={stats.series} />
      </Card>

      <Card title="Downloads per episode">
        {stats.perEpisode.length === 0 ? (
          <p className="text-zinc-500 text-sm">No episodes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-semibold">Episode</th>
                <th className="pb-2 font-semibold text-right">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {stats.perEpisode.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/60 last:border-0">
                  <td className="py-2.5">{e.title}</td>
                  <td className="py-2.5 text-right tabular-nums">{e.downloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-zinc-600">Downloads count unique IP+episode+day, hashed with a rotating daily salt — no raw IPs are stored.</p>
    </div>
  );
}
