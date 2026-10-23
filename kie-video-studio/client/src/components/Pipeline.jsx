import { useEffect, useState } from 'react';
import { Send, Clock, Cpu, CheckCircle2, XCircle, Coins, AlertTriangle, Play } from 'lucide-react';

const STEPS = [
  { key: 'sent', label: 'Enviado', icon: Send },
  { key: 'queue', label: 'Na fila de GPU', icon: Clock },
  { key: 'gen', label: 'Gerando com IA', icon: Cpu },
  { key: 'done', label: 'Concluído', icon: CheckCircle2 },
];

function stepIndex(state) {
  if (!state || state === 'submitting') return -1;
  if (state === 'submitted') return 0;
  if (state === 'waiting' || state === 'queuing') return 1;
  if (state === 'generating') return 2;
  if (state === 'success') return 3;
  return -2; // fail
}

function useTicker(active) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

export function Pipeline({ job, onOpen }) {
  const running = job && !['success', 'fail', 'error'].includes(job.state);
  useTicker(running);
  if (!job) return null;
  const idx = stepIndex(job.state);
  const failed = job.state === 'fail' || job.state === 'error';
  const end = job.finishedAt || Date.now();

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Pipeline</span>
        <span className="font-mono text-xs text-zinc-500">{job.taskId || '—'}</span>
      </div>

      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = idx > i || idx === 3;
          const active = idx === i && running;
          return (
            <li
              key={s.key}
              className={`relative rounded-xl border p-2.5 text-center transition ${
                failed && i >= Math.max(0, job.failedAt ?? 0)
                  ? 'border-red-500/30 bg-red-500/5 text-red-300'
                  : done
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : active
                      ? 'border-accent/60 bg-accent/10 text-white'
                      : 'border-white/5 bg-studio-850 text-zinc-600'
              }`}
            >
              <Icon className={`mx-auto h-4 w-4 ${active ? 'animate-pulse' : ''}`} />
              <div className="mt-1 text-[11px] font-medium leading-tight">
                {i + 1}. {s.label}
              </div>
              {s.key === 'gen' && (active || done) && job.genStartedAt && (
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-accent-2">{fmt((job.genEndedAt || end) - job.genStartedAt)}</div>
              )}
              {s.key === 'gen' && active && job.progress != null && <div className="text-[10px] text-zinc-400">{job.progress}%</div>}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span>Tempo total: <b className="tabular-nums text-zinc-200">{fmt(end - job.startedAt)}</b></span>
        {job.credits != null && (
          <span className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-300" /> Custo: <b className="text-zinc-200">{job.credits} cr</b>
          </span>
        )}
        {job.state === 'success' && job.historyId && (
          <button className="btn-ghost ml-auto !py-1 text-xs" onClick={() => onOpen(job.historyId)}>
            <Play className="h-3.5 w-3.5" /> Assistir
          </button>
        )}
      </div>

      {failed && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {job.error || 'A geração falhou.'}
            {job.hint && <div className="text-xs text-red-300/80">{job.hint}</div>}
          </div>
        </div>
      )}
      {job.warnings?.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-200/80">
          {job.warnings.map((w) => (
            <li key={w} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
