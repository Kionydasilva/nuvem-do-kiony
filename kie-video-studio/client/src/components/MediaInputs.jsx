import { useRef, useState } from 'react';
import { Upload, X, Loader2, Link2, Film, FileText, Plus, Globe } from 'lucide-react';
import { api } from '../api.js';

// Quais slots de mídia cada modo usa.
export const MODE_SLOTS = {
  text_to_video: [],
  first_frame: [{ key: 'firstFrame', label: 'Primeiro frame', kind: 'image' }],
  first_and_last_frame: [
    { key: 'firstFrame', label: 'Primeiro frame', kind: 'image' },
    { key: 'lastFrame', label: 'Último frame', kind: 'image' },
  ],
  reference_to_video: [
    { key: 'refImages', label: 'Imagens de referência (rosto / estilo)', kind: 'image', multi: true, tag: 'image' },
    { key: 'refVideos', label: 'Vídeos de movimento', kind: 'video', multi: true, tag: 'video' },
  ],
  file_to_video: [{ key: 'sourceFile', label: 'Arquivo fonte', kind: 'file' }],
  link_to_video: [{ key: 'link', label: 'URL da página', kind: 'link' }],
};

const ACCEPT = { image: 'image/png,image/jpeg,image/webp,image/bmp', video: 'video/mp4,video/quicktime,video/webm' };
const HOST_LABEL = { kie: 'CDN KIE', catbox: 'Catbox · público', tmpfiles: 'Tmpfiles · público', url: 'URL externa' };

function isVideo(a) {
  return /^video\//.test(a.mime || '') || /\.(mp4|mov|webm)(\?|$)/i.test(a.url);
}
function isImage(a) {
  return /^image\//.test(a.mime || '') || /\.(png|jpe?g|webp|bmp|gif)(\?|$)/i.test(a.url);
}

function AssetThumb({ asset, index, tag, onRemove }) {
  const src = asset.preview || asset.url;
  return (
    <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-studio-800">
      {isImage(asset) ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : isVideo(asset) ? (
        <video src={src} muted className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center p-2 text-center text-[10px] text-zinc-400">
          <FileText className="mx-auto mb-1 h-6 w-6" />
          <span className="line-clamp-2 break-all">{asset.name}</span>
        </div>
      )}
      {tag && <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[10px] text-accent-2">@{tag}_{index + 1}</span>}
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/70 px-1 text-[9px] text-zinc-300">{HOST_LABEL[asset.host] || asset.host}</span>
      <button onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 opacity-0 transition group-hover:opacity-100" aria-label="Remover">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Slot({ slot, value, onChange, fileAccept, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState('');
  const list = slot.multi ? value || [] : value ? [value] : [];

  async function handleFiles(files) {
    const arr = [...files].slice(0, slot.multi ? 10 : 1);
    setBusy((b) => b + arr.length);
    const added = [];
    for (const f of arr) {
      try {
        const r = await api.upload(f);
        added.push({ url: r.url, name: f.name, mime: f.type, host: r.host, preview: `/media/uploads/${r.localName}` });
      } catch (e) {
        onError(`Falha ao enviar ${f.name}: ${e.message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (!added.length) return;
    onChange(slot.multi ? [...list, ...added] : added[0]);
  }

  function addUrl() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return onError('A URL precisa começar com http:// ou https://');
    const a = { url: u, name: u.split('/').pop() || u, host: 'url' };
    onChange(slot.multi ? [...list, a] : a);
    setUrl('');
    setUrlMode(false);
  }

  function remove(i) {
    if (slot.multi) onChange(list.filter((_, j) => j !== i));
    else onChange(null);
  }

  const accept = slot.kind === 'file' ? fileAccept || '*/*' : ACCEPT[slot.kind];
  const canAdd = slot.multi || list.length === 0;

  return (
    <div
      className="rounded-xl border border-dashed border-white/10 bg-studio-850/60 p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">{slot.label}</span>
        {canAdd && (
          <button className="text-[11px] text-zinc-500 hover:text-zinc-300" onClick={() => setUrlMode(!urlMode)}>
            {urlMode ? 'enviar arquivo' : 'colar URL'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((a, i) => (
          <AssetThumb key={a.url + i} asset={a} index={i} tag={slot.tag} onRemove={() => remove(i)} />
        ))}
        {busy > 0 && (
          <div className="grid h-24 w-24 place-items-center rounded-xl border border-white/10 bg-studio-800">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        )}
        {canAdd && !urlMode && (
          <button
            onClick={() => input.current?.click()}
            className="grid h-24 w-24 place-items-center rounded-xl border border-white/10 bg-studio-800 text-zinc-500 transition hover:border-accent/50 hover:text-zinc-200"
          >
            <span className="text-center text-[11px]">
              {list.length ? <Plus className="mx-auto h-5 w-5" /> : slot.kind === 'video' ? <Film className="mx-auto h-5 w-5" /> : <Upload className="mx-auto h-5 w-5" />}
              {list.length ? 'Adicionar' : 'Enviar'}
            </span>
          </button>
        )}
      </div>
      {urlMode && (
        <div className="mt-2 flex gap-2">
          <input className="input !py-1.5" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} />
          <button className="btn-ghost !py-1.5" onClick={addUrl}>
            OK
          </button>
        </div>
      )}
      <input ref={input} type="file" hidden multiple={!!slot.multi} accept={accept} onChange={(e) => (handleFiles(e.target.files), (e.target.value = ''))} />
    </div>
  );
}

export function MediaInputs({ mode, media, setMedia, fileAccept, onError }) {
  const slots = MODE_SLOTS[mode] || [];
  if (!slots.length) return null;
  return (
    <div className="space-y-2">
      <span className="label">Mídias do modo</span>
      <div className={`grid gap-2 ${slots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {slots.map((slot) =>
          slot.kind === 'link' ? (
            <div key={slot.key} className="rounded-xl border border-white/10 bg-studio-850/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Globe className="h-3.5 w-3.5" /> {slot.label}
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-zinc-500" />
                <input
                  className="input"
                  placeholder="https://exemplo.com/artigo (pública, sem login)"
                  value={media.link?.url || ''}
                  onChange={(e) => setMedia({ ...media, link: e.target.value ? { url: e.target.value, host: 'url' } : null })}
                />
              </div>
            </div>
          ) : (
            <Slot
              key={slot.key}
              slot={slot}
              value={media[slot.key]}
              fileAccept={fileAccept}
              onError={onError}
              onChange={(v) => setMedia((m) => ({ ...m, [slot.key]: v }))}
            />
          ),
        )}
      </div>
    </div>
  );
}
