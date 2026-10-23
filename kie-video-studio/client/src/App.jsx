import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rocket, Loader2, X } from 'lucide-react';
import { api } from './api.js';
import { Header } from './components/Header.jsx';
import { ModeSelector, MODE_INFO } from './components/ModeSelector.jsx';
import { PromptEditor } from './components/PromptEditor.jsx';
import { MediaInputs, MODE_SLOTS } from './components/MediaInputs.jsx';
import { ModelPicker } from './components/ModelPicker.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';
import { Pipeline } from './components/Pipeline.jsx';
import { Gallery, PlayerModal } from './components/Gallery.jsx';

const DRAFT_KEY = 'kvs-draft';
const PENDING = ['submitted', 'waiting', 'queuing', 'generating'];
const TAG_HINT = {
  wan3: 'Wan 3.0: cite as mídias como Image1, Video1 (ou @image_1 — convertemos automaticamente).',
  kling4: 'Kling 4.0: cite as mídias como @image_1, @video_1. Toda menção precisa de arquivo.',
  keyframe: 'Kling Keyframes: cite os frames como @first_frame e @last_frame.',
};

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch {
    return {};
  }
}

// Ajusta as configurações aos valores aceitos pelo modelo.
function fitSettings(prev, s) {
  const d = s.duration;
  let duration = prev.duration;
  if (d) {
    const ok = duration === -1 ? d.auto : d.options ? d.options.includes(Number(duration)) : duration >= d.min && duration <= d.max;
    if (!ok) duration = d.default;
  }
  const lower = (list) => list.map((x) => x.toLowerCase());
  return {
    ...prev,
    duration,
    resolution:
      s.resolutions[lower(s.resolutions).indexOf(String(prev.resolution).toLowerCase())] ||
      s.resolutions.find((r) => /720/.test(r)) ||
      s.defaultResolution,
    aspectRatio: s.aspectRatios.includes(prev.aspectRatio)
      ? prev.aspectRatio
      : s.aspectRatios.includes('16:9')
        ? '16:9'
        : s.defaultAspect || s.aspectRatios[0] || null,
  };
}

export default function App() {
  const draft = useMemo(loadDraft, []);
  const [config, setConfig] = useState(null);
  const [credits, setCredits] = useState({ value: null, loading: false, error: null });
  const [models, setModels] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [schemaSource, setSchemaSource] = useState(null);

  const [mode, setMode] = useState(draft.mode || 'text_to_video');
  const [modelId, setModelId] = useState(draft.modelId || 'wan/3-0-video');
  const [prompt, setPrompt] = useState(draft.prompt || '');
  const [negative, setNegative] = useState(draft.negative || '');
  const [settings, setSettings] = useState({ duration: 5, resolution: '720P', aspectRatio: '16:9', audio: true, seed: '', ...draft.settings });
  const [media, setMedia] = useState({});

  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [toast, setToast] = useState(null);
  const pollRef = useRef(null);

  const model = models.find((m) => m.id === modelId);

  // ---------- carregamento ----------
  const refreshConfig = useCallback(async () => {
    const c = await api.config();
    setConfig(c);
    return c;
  }, []);

  const refreshCredits = useCallback(async () => {
    setCredits((c) => ({ ...c, loading: true }));
    try {
      const r = await api.credits();
      setCredits({ value: r.credits, loading: false, error: null });
    } catch (e) {
      setCredits({ value: null, loading: false, error: e.message });
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    const r = await api.history();
    setHistory(r.items);
    return r.items;
  }, []);

  useEffect(() => {
    refreshConfig().then((c) => c.hasKey && refreshCredits());
    api.models().then((r) => {
      setModels(r.models);
      setVendors(r.vendors);
    });
    refreshHistory().then((items) => {
      // retoma o acompanhamento de uma geração que ainda estava rodando
      const pending = items.find((h) => PENDING.includes(h.state) && Date.now() - h.createdAt < 3600_000);
      if (pending) startPolling({ taskId: pending.taskId, historyId: pending.id, state: pending.state, startedAt: pending.createdAt });
    });
    return () => clearTimeout(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // salva rascunho local
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, modelId, prompt, negative, settings }));
    } catch {
      /* armazenamento indisponível */
    }
  }, [mode, modelId, prompt, negative, settings]);

  // modelo incompatível com o modo -> escolhe outro
  useEffect(() => {
    if (!models.length) return;
    if (model && model.modes.includes(mode)) return;
    const next = models.find((m) => m.id === 'wan/3-0-video' && m.modes.includes(mode)) || models.find((m) => m.modes.includes(mode));
    if (next) setModelId(next.id);
  }, [mode, models, model]);

  // ao trocar de modelo: busca o schema (ao vivo/cache) e encaixa as configurações
  useEffect(() => {
    if (!modelId || !models.length) return;
    let alive = true;
    const base = models.find((m) => m.id === modelId);
    if (base) setSettings((s) => fitSettings(s, base.settings));
    setSchemaSource(null);
    api
      .schema(modelId)
      .then((r) => {
        if (!alive) return;
        setSchemaSource(r.source);
        if (r.settings) {
          setModels((list) => list.map((m) => (m.id === modelId ? { ...m, settings: r.settings } : m)));
          setSettings((s) => fitSettings(s, r.settings));
        }
      })
      .catch(() => alive && setSchemaSource('docs'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, models.length]);

  const notify = useCallback((text, type = 'err') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // ---------- geração ----------
  function startPolling(initial) {
    clearTimeout(pollRef.current);
    setJob({ warnings: [], ...initial });
    let failures = 0;
    const tick = async () => {
      try {
        const r = await api.task(initial.taskId);
        failures = 0;
        setJob((j) => {
          if (!j || j.taskId !== initial.taskId) return j;
          const next = { ...j, state: r.state, progress: r.progress, credits: r.creditsConsumed ?? j.credits };
          if (r.state === 'generating' && !j.genStartedAt) next.genStartedAt = Date.now();
          if (r.state === 'success') {
            next.finishedAt = Date.now();
            next.genStartedAt ||= j.startedAt;
            next.genEndedAt = Date.now();
          }
          if (r.state === 'fail') {
            next.finishedAt = Date.now();
            next.error = r.failMsg || 'A KIE marcou a tarefa como falha.';
            next.failedAt = j.genStartedAt ? 2 : 1;
          }
          return next;
        });
        if (r.state === 'success' || r.state === 'fail') {
          refreshHistory();
          refreshCredits();
          return;
        }
        refreshHistoryThrottled();
      } catch (e) {
        failures += 1;
        if (failures > 15) {
          setJob((j) => ({ ...j, state: 'error', error: `Perdi contato com a tarefa: ${e.message}`, finishedAt: Date.now() }));
          return;
        }
        pollRef.current = setTimeout(tick, e.status === 429 ? 10000 : 5000);
        return;
      }
      pollRef.current = setTimeout(tick, 4000);
    };
    pollRef.current = setTimeout(tick, 1500);
  }

  const lastHistoryRefresh = useRef(0);
  function refreshHistoryThrottled() {
    if (Date.now() - lastHistoryRefresh.current < 15000) return;
    lastHistoryRefresh.current = Date.now();
    refreshHistory();
  }

  const slots = MODE_SLOTS[mode] || [];
  const missing = slots.filter((s) => {
    const v = media[s.key];
    return s.multi ? false : !v;
  });
  const refMissing = mode === 'reference_to_video' && !(media.refImages?.length || media.refVideos?.length);
  const busy = job && (job.state === 'submitting' || PENDING.includes(job.state));
  const canGenerate = model && !busy && !missing.length && !refMissing && (prompt.trim() || mode !== 'text_to_video');

  async function generate() {
    // envia só as mídias do modo atual
    const body = { model: modelId, mode, prompt, negativePrompt: negative, ...settings, assets: {} };
    for (const s of slots) {
      const v = media[s.key];
      if (!v) continue;
      body[s.key] = Array.isArray(v) ? v.map((a) => a.url) : v.url;
      body.assets[s.key] = v;
    }
    const startedAt = Date.now();
    setJob({ state: 'submitting', startedAt, warnings: [] });
    try {
      const r = await api.generate(body);
      startPolling({ taskId: r.taskId, historyId: r.historyId, state: 'submitted', startedAt, warnings: r.warnings });
      refreshHistory();
    } catch (e) {
      setJob({ state: 'error', startedAt, finishedAt: Date.now(), error: e.message, hint: e.hint, failedAt: 0, warnings: [] });
      if (e.status === 401 || e.status === 402) refreshCredits();
    }
  }

  function reuse(item) {
    const req = item.request || {};
    setMode(req.mode || item.mode);
    setModelId(req.model || item.model);
    setPrompt(req.prompt || '');
    setNegative(req.negativePrompt || '');
    setSettings((s) => ({
      ...s,
      duration: req.duration ?? s.duration,
      resolution: req.resolution ?? s.resolution,
      aspectRatio: req.aspectRatio ?? s.aspectRatio,
      audio: req.audio ?? s.audio,
      seed: req.seed ?? '',
    }));
    setMedia(item.assets || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('Configurações carregadas no estúdio.', 'ok');
  }

  async function remove(item) {
    if (!confirm('Excluir este vídeo do histórico?')) return;
    await api.deleteHistory(item.id);
    refreshHistory();
  }

  const openById = (id) => setPlaying(history.find((h) => h.id === id) || null);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.12),transparent_60%)]">
      <Header
        config={config}
        credits={credits}
        onRefreshCredits={refreshCredits}
        onConfigChange={() => refreshConfig().then(refreshCredits)}
      />

      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-4">
        <ModeSelector mode={mode} onChange={setMode} models={models} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section className="panel space-y-5 p-4">
            <MediaInputs mode={mode} media={media} setMedia={setMedia} fileAccept={model?.fileAccept} onError={notify} />
            <PromptEditor
              prompt={prompt}
              setPrompt={setPrompt}
              negative={negative}
              setNegative={setNegative}
              showNegative={!!model?.settings.negativePrompt}
              usesImages={mode !== 'text_to_video' && mode !== 'link_to_video'}
              promptMax={model?.settings.promptMax}
              tagHint={mode === 'reference_to_video' || mode === 'first_and_last_frame' ? TAG_HINT[model?.tagStyle] : null}
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
              <button className="btn-primary !px-6 !py-3 text-base" disabled={!canGenerate} onClick={generate}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                {busy ? 'Gerando…' : 'Gerar vídeo'}
              </button>
              <span className="text-xs text-zinc-500">
                {!config?.hasKey
                  ? 'Defina a chave de API no topo.'
                  : missing.length
                    ? `Falta: ${missing.map((m) => m.label.toLowerCase()).join(', ')}`
                    : refMissing
                      ? 'Adicione pelo menos 1 imagem ou vídeo de referência.'
                      : `${MODE_INFO[mode].label} · ${model?.name || ''}`}
              </span>
            </div>
            <Pipeline job={job} onOpen={openById} />
          </section>

          <aside className="panel space-y-5 p-4">
            <ModelPicker models={models} vendors={vendors} mode={mode} modelId={modelId} onSelect={setModelId} />
            <SettingsPanel model={model} mode={mode} settings={settings} setSettings={setSettings} schemaSource={schemaSource} />
          </aside>
        </div>

        <Gallery items={history} onPlay={setPlaying} onReuse={reuse} onDelete={remove} />
      </main>

      {playing && <PlayerModal item={playing} onClose={() => setPlaying(null)} onReuse={reuse} />}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-xl ${
            toast.type === 'ok' ? 'border-emerald-500/40 bg-emerald-950 text-emerald-100' : 'border-red-500/40 bg-red-950 text-red-100'
          }`}
        >
          {toast.text}
          <button onClick={() => setToast(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
