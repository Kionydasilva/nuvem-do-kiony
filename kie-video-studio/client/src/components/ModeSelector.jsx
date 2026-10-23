import { Type, Image, Images, Layers, FileVideo, Link2 } from 'lucide-react';

export const MODE_INFO = {
  text_to_video: { label: 'Texto Puro', desc: 'Só o prompt', icon: Type },
  first_frame: { label: 'Primeiro Frame', desc: 'Anima 1 foto, mantém o rosto', icon: Image },
  first_and_last_frame: { label: 'Primeiro & Último', desc: 'Transição entre 2 imagens', icon: Images },
  reference_to_video: { label: 'Referência', desc: 'Imagem + vídeo de movimento', icon: Layers },
  file_to_video: { label: 'Arquivo Fonte', desc: 'Documento ou vídeo base', icon: FileVideo },
  link_to_video: { label: 'Link / URL', desc: 'Página web como fonte', icon: Link2 },
};

export function ModeSelector({ mode, onChange, models }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {Object.entries(MODE_INFO).map(([key, info], i) => {
        const Icon = info.icon;
        const count = models.filter((m) => m.modes.includes(key)).length;
        const on = mode === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`group relative rounded-xl border p-3 text-left transition ${
              on ? 'border-accent/70 bg-accent/10 shadow-lg shadow-violet-950/50' : 'border-white/5 bg-studio-850 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between">
              <Icon className={`h-5 w-5 ${on ? 'text-accent' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              <span className="text-[10px] text-zinc-600">Modo {i + 1}</span>
            </div>
            <div className="mt-2 text-sm font-semibold">{info.label}</div>
            <div className="text-[11px] leading-snug text-zinc-500">{info.desc}</div>
            <div className="mt-1 text-[10px] text-zinc-600">{count} modelo{count === 1 ? '' : 's'}</div>
          </button>
        );
      })}
    </div>
  );
}
