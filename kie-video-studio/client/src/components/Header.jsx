import { useState } from 'react';
import { Clapperboard, KeyRound, RefreshCw, ExternalLink, AlertTriangle, Coins, X, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';

export function Header({ config, credits, onRefreshCredits, onConfigChange }) {
  const [open, setOpen] = useState(false);
  const low = credits.value != null && credits.value < 10;
  const bad = !!credits.error || !config?.hasKey;

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-studio-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/40">
            <Clapperboard className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Kie Video Studio</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-2">IA Pro</div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              bad ? 'border-red-500/40 bg-red-500/10 text-red-300' : low ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
            title={credits.error || 'Saldo atual na KIE'}
          >
            {bad || low ? <AlertTriangle className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
            <span className="font-semibold tabular-nums">
              {!config?.hasKey ? 'Sem chave' : credits.error ? 'Erro no saldo' : credits.value == null ? '—' : `${credits.value.toFixed(1)} cr`}
            </span>
            <button onClick={onRefreshCredits} className="rounded-full p-0.5 hover:bg-white/10" aria-label="Atualizar saldo">
              <RefreshCw className={`h-3.5 w-3.5 ${credits.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button onClick={() => setOpen(true)} className="btn-ghost !rounded-full !px-3 !py-1.5 font-mono text-xs">
            <KeyRound className="h-4 w-4 text-accent" />
            {config?.maskedKey || 'Definir chave'}
          </button>

          <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className="btn-ghost !rounded-full !px-3 !py-1.5 text-xs">
            Painel KIE <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {open && <KeyModal config={config} onClose={() => setOpen(false)} onSaved={onConfigChange} />}
    </header>
  );
}

function KeyModal({ config, onClose, onSaved }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.setKey(key);
      setMsg(r.warning ? { type: 'warn', text: r.warning } : { type: 'ok', text: `Chave salva. Saldo: ${Number(r.credits).toFixed(1)} cr` });
      onSaved();
      if (!r.warning) setTimeout(onClose, 900);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleFallback() {
    await api.setConfig({ uploadFallback: !config.uploadFallback });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-accent" /> Chave de API da KIE
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-zinc-400">
          Atual: <span className="font-mono text-zinc-200">{config?.maskedKey || 'nenhuma'}</span>. A chave fica só neste computador
          (data/config.json e .env).
        </p>
        <input
          className="input font-mono"
          type="password"
          autoFocus
          placeholder="Cole a nova chave"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && key && save()}
        />
        {msg && (
          <p className={`mt-2 text-sm ${msg.type === 'ok' ? 'text-emerald-300' : msg.type === 'warn' ? 'text-amber-300' : 'text-red-300'}`}>{msg.text}</p>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/5 bg-studio-850 p-3">
          <input type="checkbox" className="mt-1 accent-violet-500" checked={!!config?.uploadFallback} onChange={toggleFallback} />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-accent-2" /> Fallback de upload público
            </span>
            <span className="text-zinc-400">
              Se o CDN da KIE falhar, envia para Catbox/Tmpfiles. Esses links são públicos: qualquer pessoa com o link vê o arquivo.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!key || busy} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar chave
          </button>
        </div>
      </div>
    </div>
  );
}
