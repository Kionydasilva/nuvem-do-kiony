import { useEffect, useRef } from 'react';
import { Play, Download, RotateCcw, Trash2, X, Maximize, Loader2, XCircle, Film } from 'lucide-react';
import { MODE_INFO } from './ModeSelector.jsx';

export const videoSrc = (item) => item.localVideo || item.resultUrls?.[0] || null;
const PENDING = ['submitted', 'waiting', 'queuing', 'generating'];

function fmtDate(ts) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function Gallery({ items, onPlay, onReuse, onDelete }) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Film className="h-4 w-4 text-accent" /> Galeria
        </h2>
        <span className="text-xs text-zinc-500">{items.length} vídeo(s)</span>
      </div>
      {!items.length && <p className="py-10 text-center text-sm text-zinc-500">Seus vídeos aparecem aqui.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const src = videoSrc(item);
          const pending = PENDING.includes(item.state);
          return (
            <article key={item.id} className="group overflow-hidden rounded-xl border border-white/5 bg-studio-850">
              <button
                className="relative block aspect-video w-full bg-black"
                disabled={!src}
                onClick={() => onPlay(item)}
                aria-label="Assistir"
              >
                {src ? (
                  <video src={`${src}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-zinc-500">
                    {pending ? <Loader2 className="h-6 w-6 animate-spin text-accent" /> : <XCircle className="h-6 w-6 text-red-400" />}
                  </div>
                )}
                {src && (
                  <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                    <Play className="h-10 w-10 fill-white text-white" />
                  </span>
                )}
                <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px]">
                  {[item.durationSec && `${item.durationSec}s`, item.resolution].filter(Boolean).join(' · ') || MODE_INFO[item.mode]?.label}
                </span>
                {item.state !== 'success' && (
                  <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] ${pending ? 'bg-accent/80' : 'bg-red-600/80'}`}>
                    {pending ? 'gerando…' : 'falhou'}
                  </span>
                )}
              </button>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold">{item.modelName}</span>
                  <span className="shrink-0 text-zinc-500">{fmtDate(item.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5em] text-xs text-zinc-400" title={item.prompt}>
                  {item.prompt || <i className="text-zinc-600">sem prompt</i>}
                </p>
                {item.state === 'fail' && item.failMsg && <p className="mt-1 line-clamp-2 text-[11px] text-red-300">{item.failMsg}</p>}
                <div className="mt-2 flex items-center gap-1.5">
                  {src && (
                    <a className="chip flex items-center gap-1" href={src} download={`kie-${item.id.slice(0, 8)}.mp4`} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5" /> MP4
                    </a>
                  )}
                  <button className="chip flex items-center gap-1" onClick={() => onReuse(item)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reutilizar
                  </button>
                  {item.creditsConsumed != null && <span className="ml-auto text-[11px] text-zinc-500">{item.creditsConsumed} cr</span>}
                  <button className={`chip !px-2 ${item.creditsConsumed == null ? 'ml-auto' : ''}`} onClick={() => onDelete(item)} aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function PlayerModal({ item, onClose, onReuse }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!item) return null;
  const src = videoSrc(item);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{item.modelName}</div>
          <div className="truncate text-xs text-zinc-500">{item.prompt}</div>
        </div>
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => ref.current?.requestFullscreen?.()}>
          <Maximize className="h-4 w-4" /> Tela cheia
        </button>
        <a className="btn-ghost !py-1.5 text-xs" href={src} download target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" /> Baixar MP4
        </a>
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => (onReuse(item), onClose())}>
          <RotateCcw className="h-4 w-4" /> Reutilizar
        </button>
        <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={onClose} aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <video ref={ref} src={src} controls autoPlay loop playsInline className="max-h-full max-w-full rounded-xl shadow-2xl shadow-violet-950/50" />
      </div>
    </div>
  );
}
