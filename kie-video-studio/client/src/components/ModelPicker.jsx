import { useState } from 'react';
import { Cpu, Volume2, Dices } from 'lucide-react';

const VENDOR_COLOR = {
  Wan: 'from-orange-500 to-rose-500',
  Kling: 'from-sky-500 to-indigo-500',
  Seedance: 'from-emerald-500 to-teal-500',
  Hailuo: 'from-fuchsia-500 to-purple-600',
};

export function ModelPicker({ models, vendors, mode, modelId, onSelect }) {
  const [vendor, setVendor] = useState('Todos');
  const compatible = models.filter((m) => m.modes.includes(mode));
  const shown = compatible.filter((m) => vendor === 'Todos' || m.vendor === vendor);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label">Modelo</span>
        <span className="text-[11px] text-zinc-600">
          {compatible.length} de {models.length} aceitam este modo
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['Todos', ...vendors].map((v) => {
          const n = v === 'Todos' ? compatible.length : compatible.filter((m) => m.vendor === v).length;
          return (
            <button key={v} disabled={!n} className={`chip disabled:opacity-30 ${vendor === v ? 'chip-on' : ''}`} onClick={() => setVendor(v)}>
              {v} <span className="text-zinc-500">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {shown.map((m) => {
          const on = m.id === modelId;
          const s = m.settings;
          const dur = s.duration ? (s.duration.options ? s.duration.options.join('/') + 's' : `${s.duration.min}–${s.duration.max}s`) : '—';
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`flex items-start gap-3 rounded-xl border p-2.5 text-left transition ${
                on ? 'border-accent/70 bg-accent/10' : 'border-white/5 bg-studio-850 hover:border-white/15'
              }`}
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${VENDOR_COLOR[m.vendor] || 'from-zinc-600 to-zinc-700'}`}>
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.name}</div>
                <div className="truncate font-mono text-[10px] text-zinc-500">{m.id}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                  <span>{dur}</span>
                  {s.resolutions.length > 0 && <span>· {s.resolutions.join('/')}</span>}
                  {s.audio && <Volume2 className="h-3 w-3 text-accent-2" />}
                  {s.seed && <Dices className="h-3 w-3 text-zinc-500" />}
                </div>
              </div>
            </button>
          );
        })}
        {!shown.length && <p className="text-sm text-zinc-500">Nenhum modelo deste fabricante aceita este modo.</p>}
      </div>
    </div>
  );
}
