import { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, Wand2, AlertTriangle } from 'lucide-react';

const STYLES = [
  { label: 'Cinematográfico', text: 'cinematic lighting, anamorphic lens, shallow depth of field, subtle film grain' },
  { label: 'Drone FPV', text: 'FPV drone shot, fast sweeping flight, dynamic banking turns' },
  { label: 'Cyberpunk', text: 'cyberpunk aesthetic, neon lights, rain-soaked streets, volumetric fog' },
  { label: 'Anime 3D', text: '3D anime style, cel-shaded, vibrant colors' },
  { label: 'Slow Motion 120fps', text: 'slow motion, 120fps, ultra smooth motion' },
  { label: 'Macro Fotografia', text: 'macro photography, extreme close-up, rich textures, creamy bokeh' },
];

const NEGATIVE_PRESET = 'borrão, distorção, deformação, baixa resolução, mãos extras, rosto alterado, marca d’água, texto';

// Frases que fazem o modelo "inventar" outra pessoa em vez de animar a da foto.
const SUBJECT_RE =
  /\b(?:a|o|uma|um|the|this|that)\s+(mulher|garota|menina|moça|senhora|homem|rapaz|menino|garoto|senhor|pessoa|criança|personagem|woman|girl|lady|man|boy|guy|person|child|character)\s+(?:da|na|desta|dessa|nesta|nessa|que\s+está\s+na|from\s+the|in\s+the|of\s+the|on\s+the)\s+(?:imagem|foto|fotografia|figura|picture|photo|image)(?:\s+(?:enviada|anexada|acima|uploaded|attached|provided))?/gi;
const LOOSE_RE = /\b(?:da|na)\s+(?:imagem|foto)\s+(?:enviada|anexada)\b|\b(?:in|from)\s+the\s+(?:uploaded|attached)\s+(?:image|photo)\b/gi;

const FEMALE = /mulher|garota|menina|moça|senhora|woman|girl|lady/i;
const MALE = /homem|rapaz|menino|garoto|senhor|man|boy|guy/i;

export function detectSubjectRefs(text) {
  return [...(text.match(SUBJECT_RE) || []), ...(text.match(LOOSE_RE) || [])];
}

export function optimizePrompt(text) {
  let out = text.replace(SUBJECT_RE, (_, noun) => (FEMALE.test(noun) ? 'Ela' : MALE.test(noun) ? 'Ele' : 'O personagem'));
  out = out.replace(LOOSE_RE, '').replace(/\s{2,}/g, ' ').trim();
  // Começa com maiúscula e reforça a trava de identidade.
  out = out.charAt(0).toUpperCase() + out.slice(1);
  const lock = 'Mantém exatamente o mesmo rosto, roupa e cenário do primeiro frame.';
  if (!out.includes(lock)) out = `${out.replace(/[.\s]*$/, '.')} ${lock}`;
  return out;
}

export function PromptEditor({ prompt, setPrompt, negative, setNegative, showNegative, usesImages, promptMax, tagHint }) {
  const [negOpen, setNegOpen] = useState(!!negative);
  const refs = useMemo(() => (usesImages ? detectSubjectRefs(prompt) : []), [prompt, usesImages]);
  const max = promptMax || 5000;

  function addStyle(text) {
    if (prompt.includes(text)) return;
    setPrompt(prompt.trim() ? `${prompt.trim().replace(/[,.]?$/, ',')} ${text}` : text);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label">Prompt</span>
        <span className={`text-xs tabular-nums ${prompt.length > max ? 'text-red-400' : 'text-zinc-500'}`}>
          {prompt.length.toLocaleString('pt-BR')} / {max.toLocaleString('pt-BR')}
        </span>
      </div>
      <textarea
        className="input min-h-[120px] resize-y leading-relaxed"
        placeholder="Descreva a cena: o que acontece, como a câmera se move, a luz, o clima…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
      />
      {tagHint && <p className="text-[11px] text-zinc-500">{tagHint}</p>}

      <div className="flex flex-wrap gap-1.5">
        {STYLES.map((s) => (
          <button key={s.label} className={`chip ${prompt.includes(s.text) ? 'chip-on' : ''}`} onClick={() => addStyle(s.text)}>
            <Sparkles className="mr-1 inline h-3 w-3" />
            {s.label}
          </button>
        ))}
      </div>

      {refs.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="font-medium text-amber-200">Risco de a IA criar outra pessoa</p>
              <p className="mt-0.5 text-amber-100/80">
                Trechos como <em>“{refs[0]}”</em> fazem o modelo descrever alguém novo. Ele já vê a imagem: diga só o que ela faz e como a câmera se
                move.
              </p>
              <button className="btn mt-2 bg-amber-400/90 !px-3 !py-1.5 text-xs text-black hover:bg-amber-300" onClick={() => setPrompt(optimizePrompt(prompt))}>
                <Wand2 className="h-3.5 w-3.5" /> ✨ Otimizar Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {showNegative && (
        <div className="rounded-xl border border-white/5 bg-studio-850">
          <button className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-300" onClick={() => setNegOpen(!negOpen)}>
            Prompt negativo {negative && <span className="text-xs text-zinc-500">({negative.length})</span>}
            <ChevronDown className={`h-4 w-4 transition ${negOpen ? 'rotate-180' : ''}`} />
          </button>
          {negOpen && (
            <div className="space-y-2 px-3 pb-3">
              <textarea className="input min-h-[60px]" placeholder="O que evitar…" value={negative} onChange={(e) => setNegative(e.target.value)} />
              <button className="chip" onClick={() => setNegative(NEGATIVE_PRESET)}>
                Usar lista padrão
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
