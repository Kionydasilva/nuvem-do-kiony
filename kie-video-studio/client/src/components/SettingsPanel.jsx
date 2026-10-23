import { Volume2, VolumeX, Dices, Info, ExternalLink } from 'lucide-react';
import { MODE_INFO } from './ModeSelector.jsx';

const ASPECTS = {
  '16:9': 'Cinema / YouTube',
  '9:16': 'TikTok / Reels',
  '1:1': 'Quadrado',
  '4:3': 'Clássico',
  '3:4': 'Retrato',
  '21:9': 'Ultra-Wide',
  adaptive: 'Automático',
  auto: 'Automático',
};
const PRESETS = [3, 5, 10, 15, 30];

function AspectIcon({ ratio }) {
  const [w, h] = ratio.includes(':') ? ratio.split(':').map(Number) : [1, 1];
  const scale = 22 / Math.max(w, h);
  return (
    <span
      className={`inline-block rounded-[3px] border-2 ${ratio.includes(':') ? 'border-current' : 'border-dashed border-current'}`}
      style={{ width: Math.max(8, w * scale), height: Math.max(8, h * scale) }}
    />
  );
}

export function SettingsPanel({ model, mode, settings, setSettings, schemaSource }) {
  if (!model) return null;
  const s = model.settings;
  const set = (patch) => setSettings((x) => ({ ...x, ...patch }));
  const d = s.duration;
  const presets = d ? (d.options ? d.options : PRESETS.filter((p) => p >= d.min && p <= d.max)) : [];
  const hasFrame = ['first_frame', 'first_and_last_frame'].includes(mode);

  return (
    <div className="space-y-5">
      {s.resolutions.length > 0 && (
        <div>
          <div className="label mb-2">Resolução</div>
          <div className="flex flex-wrap gap-1.5">
            {s.resolutions.map((r) => (
              <button key={r} className={`chip ${settings.resolution === r ? 'chip-on' : ''}`} onClick={() => set({ resolution: r })}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {d && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Duração</span>
            <span className="text-sm font-semibold tabular-nums text-accent-2">{settings.duration === -1 ? 'Auto' : `${settings.duration}s`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} className={`chip ${Number(settings.duration) === p ? 'chip-on' : ''}`} onClick={() => set({ duration: p })}>
                {p}s
              </button>
            ))}
            {d.auto && (
              <button className={`chip ${settings.duration === -1 ? 'chip-on' : ''}`} onClick={() => set({ duration: -1 })} title="O modelo escolhe a duração">
                Auto
              </button>
            )}
          </div>
          {!d.options && (
            <input
              type="range"
              className="mt-3 w-full"
              min={d.min}
              max={d.max}
              value={settings.duration === -1 ? d.default : settings.duration}
              onChange={(e) => set({ duration: Number(e.target.value) })}
            />
          )}
          {!d.options && (
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>{d.min}s</span>
              <span>{d.max}s</span>
            </div>
          )}
        </div>
      )}

      {s.aspectRatios.length > 0 && (
        <div>
          <div className="label mb-2">Proporção {hasFrame && <span className="normal-case tracking-normal text-zinc-600">(com frame, a imagem pode definir)</span>}</div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {s.aspectRatios.map((r) => (
              <button
                key={r}
                onClick={() => set({ aspectRatio: r })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition ${
                  settings.aspectRatio === r ? 'border-accent/70 bg-accent/10 text-white' : 'border-white/5 bg-studio-850 text-zinc-400 hover:border-white/15'
                }`}
              >
                <span className="grid h-6 place-items-center">
                  <AspectIcon ratio={r} />
                </span>
                <span className="text-xs font-semibold">{ASPECTS[r] && !r.includes(':') ? 'Auto' : r}</span>
                <span className="text-[9px] leading-tight text-zinc-500">{ASPECTS[r] || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {s.audio && (
          <button
            onClick={() => set({ audio: !settings.audio })}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${
              settings.audio ? 'border-accent-2/50 bg-cyan-500/10' : 'border-white/5 bg-studio-850'
            }`}
          >
            {settings.audio ? <Volume2 className="h-4 w-4 text-accent-2" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
            <span>
              Áudio nativo IA <span className="block text-[11px] text-zinc-500">{settings.audio ? 'Ligado' : 'Desligado'}</span>
            </span>
          </button>
        )}
        {s.seed && (
          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-studio-850 p-2">
            <Dices className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              placeholder="Seed (vazio = aleatório)"
              inputMode="numeric"
              value={settings.seed}
              onChange={(e) => set({ seed: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            />
            <button className="chip !px-2 !py-1" onClick={() => set({ seed: String(Math.floor(Math.random() * 2147483647)) })}>
              Gerar
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/5 bg-studio-850 p-3 text-xs">
        <div className="mb-2 flex items-center gap-1.5 font-semibold text-zinc-300">
          <Info className="h-3.5 w-3.5" /> Ficha técnica
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-400">
          <dt className="text-zinc-600">ID</dt>
          <dd className="truncate font-mono">{model.id}</dd>
          <dt className="text-zinc-600">Modos</dt>
          <dd>{model.modes.map((m) => MODE_INFO[m]?.label).join(', ')}</dd>
          <dt className="text-zinc-600">Recursos</dt>
          <dd>{[s.audio && 'áudio', s.seed && 'seed', s.negativePrompt && 'prompt negativo', d?.auto && 'duração auto'].filter(Boolean).join(', ') || '—'}</dd>
          <dt className="text-zinc-600">Custo</dt>
          <dd>
            {model.observedCost ? (
              <>
                ~{model.observedCost.perSec} cr/s <span className="text-zinc-600">(média de {model.observedCost.samples} geração(ões) suas)</span>
              </>
            ) : (
              <a className="inline-flex items-center gap-1 text-accent hover:underline" href="https://kie.ai/pricing" target="_blank" rel="noreferrer">
                ver tabela oficial <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </dd>
          <dt className="text-zinc-600">Schema</dt>
          <dd>{{ live: 'ao vivo (API KIE)', cache: 'cache local', docs: 'documentação oficial' }[schemaSource] || '…'}</dd>
        </dl>
        {model.notes && <p className="mt-2 text-[11px] text-amber-200/80">{model.notes}</p>}
      </div>
    </div>
  );
}
