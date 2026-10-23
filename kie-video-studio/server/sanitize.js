// Monta o payload de createTask a partir do pedido do estúdio.
// Regras:
//  1. Só entram as mídias do modo escolhido (o resto é descartado, mesmo se veio do cache de outra aba).
//  2. Cada mídia vai para o campo exato do schema do modelo, no tipo certo (string ou lista).
//  3. Menções no prompt (@image_1 etc.) são traduzidas para a sintaxe do modelo.
//  4. Ajustes (duração, resolução, proporção...) são encaixados nos valores aceitos pelo schema.
//  5. Qualquer campo que não exista no schema é removido antes do envio.
import { findModel, MODES } from './catalog.js';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const SLOTS = ['firstFrame', 'lastFrame', 'refImages', 'refVideos', 'sourceFile', 'link'];

function asList(v) {
  if (v == null || v === '') return [];
  return (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
}

export function translatePrompt(prompt, tagStyle, counts = {}) {
  let p = String(prompt || '');
  const warnings = [];
  if (tagStyle === 'wan3') {
    p = p.replace(/@(image|video|audio)_?(\d+)/gi, (_, k, n) => k[0].toUpperCase() + k.slice(1).toLowerCase() + n);
  } else if (tagStyle === 'kling4') {
    p = p.replace(/\b(Image|Video)(\d+)\b/g, (_, k, n) => `@${k.toLowerCase()}_${n}`);
    p = p.replace(/@(image|video)(\d+)/gi, (_, k, n) => `@${k.toLowerCase()}_${n}`);
    for (const m of p.matchAll(/@(image|video)_(\d+)/gi)) {
      const kind = m[1].toLowerCase();
      const n = Number(m[2]);
      const have = kind === 'image' ? counts.images || 0 : counts.videos || 0;
      if (n < 1 || n > have) {
        throw new ValidationError(
          `O prompt cita ${m[0]}, mas só há ${have} ${kind === 'image' ? 'imagem(ns)' : 'vídeo(s)'} anexado(s). A Kling rejeita menções sem arquivo.`,
        );
      }
    }
  } else if (tagStyle === 'keyframe') {
    p = p.replace(/@image_?1\b|\bImage1\b/gi, '@first_frame').replace(/@image_?2\b|\bImage2\b/gi, '@last_frame');
    if (/@last_frame/.test(p) && !counts.lastFrame) {
      warnings.push('O prompt cita @last_frame, mas não há último frame. A menção foi trocada por texto.');
      p = p.replace(/@last_frame/g, 'the final frame');
    }
  } else {
    p = p.replace(/@(image|video|audio)_?(\d+)/gi, (_, k, n) => `${k.toLowerCase()} ${n}`);
  }
  return { prompt: p, warnings };
}

// Encaixa um valor no enum do schema ignorando maiúsculas e equivalências (auto = adaptive).
function matchEnum(value, enumList) {
  if (value == null || !enumList) return undefined;
  const norm = (s) => String(s).toLowerCase().replace(/^auto$/, 'adaptive');
  return enumList.find((e) => norm(e) === norm(value));
}

function pickKey(props, keys) {
  return keys.find((k) => k in props);
}

function fitDuration(value, prop, entry) {
  if (value == null || value === '') return undefined;
  let n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n === -1 && entry.autoDuration) return prop.type === 'string' ? '-1' : -1;
  if (prop.enum) {
    // escolhe o valor aceito mais próximo
    const best = prop.enum
      .map((e) => ({ e, d: Math.abs(Number(e) - n) }))
      .sort((a, b) => a.d - b.d)[0].e;
    return best;
  }
  const [min, max] = entry.durationRange || [prop.minimum ?? 1, prop.maximum ?? 60];
  n = Math.min(max, Math.max(min, Math.round(n)));
  return prop.type === 'string' ? String(n) : n;
}

/**
 * @param {object} req   pedido do estúdio
 * @param {object} schema schema do input do modelo ({ properties, required })
 */
export function buildPayload(req, schema) {
  const entry = findModel(req.model);
  if (!entry) throw new ValidationError(`Modelo desconhecido: ${req.model}`);
  const mode = req.mode || 'text_to_video';
  if (!MODES.includes(mode)) throw new ValidationError(`Modo inválido: ${mode}`);
  const slotMap = entry.modes[mode];
  if (!slotMap) {
    throw new ValidationError(`${entry.name} não suporta o modo "${mode}". Modos aceitos: ${Object.keys(entry.modes).join(', ')}.`);
  }

  const props = schema?.properties || {};
  const input = {};
  const warnings = [];
  const ignored = [];

  // 1+2. mídias: só as do modo atual
  const media = {};
  for (const slot of SLOTS) {
    const values = asList(req[slot]);
    if (!values.length) continue;
    if (!slotMap[slot]) {
      ignored.push(slot);
      continue;
    }
    media[slot] = values;
  }
  for (const [slot, field] of Object.entries(slotMap)) {
    const values = media[slot];
    if (!values) continue;
    const prop = props[field] || { type: field.endsWith('s') ? 'array' : 'string' };
    if (prop.type === 'array') {
      input[field] = prop.maxItems ? values.slice(0, prop.maxItems) : values;
      if (prop.maxItems && values.length > prop.maxItems) warnings.push(`${field}: só ${prop.maxItems} arquivo(s) aceitos; o resto foi ignorado.`);
    } else {
      input[field] = values[0];
      if (values.length > 1) warnings.push(`${field}: aceita só 1 arquivo; usei o primeiro.`);
    }
  }
  if (ignored.length) warnings.push(`Mídias de outros modos foram descartadas: ${ignored.join(', ')}.`);

  // checa mídias obrigatórias do modo
  const need = {
    first_frame: ['firstFrame'],
    first_and_last_frame: ['firstFrame', 'lastFrame'],
    file_to_video: ['sourceFile'],
    link_to_video: ['link'],
  }[mode] || [];
  for (const slot of need) {
    if (!media[slot]) throw new ValidationError(`O modo "${mode}" precisa de: ${slot}.`);
  }
  if (mode === 'reference_to_video' && !media.refImages && !media.refVideos) {
    throw new ValidationError('O modo Referência precisa de pelo menos 1 imagem ou 1 vídeo.');
  }
  if (media.link && !/^https?:\/\//i.test(media.link[0])) {
    throw new ValidationError('O link precisa começar com http:// ou https://');
  }

  // 3. prompt
  const t = translatePrompt(req.prompt, entry.tagStyle, {
    images: media.refImages?.length || 0,
    videos: media.refVideos?.length || 0,
    lastFrame: !!media.lastFrame,
  });
  warnings.push(...t.warnings);
  const prompt = t.prompt.trim();
  if (prompt) input.prompt = prompt;
  if (props.prompt?.maxLength && prompt.length > props.prompt.maxLength) {
    throw new ValidationError(`Prompt longo demais: ${prompt.length}/${props.prompt.maxLength} caracteres.`);
  }
  if (!prompt && (mode === 'text_to_video' || (schema?.required || []).includes('prompt'))) {
    throw new ValidationError('Escreva um prompt.');
  }

  // 4. ajustes
  if (props.negative_prompt && req.negativePrompt?.trim()) input.negative_prompt = req.negativePrompt.trim();

  if (props.resolution?.enum) {
    const r = matchEnum(req.resolution, props.resolution.enum);
    if (r) input.resolution = r;
    else if (req.resolution) warnings.push(`Resolução ${req.resolution} não existe neste modelo; usei o padrão.`);
  }

  const arKey = pickKey(props, ['aspect_ratio', 'ratio']);
  if (arKey && req.aspectRatio) {
    const a = matchEnum(req.aspectRatio, props[arKey].enum);
    if (a) input[arKey] = a;
    else warnings.push(`Proporção ${req.aspectRatio} não existe neste modelo; usei o padrão.`);
  }

  if (props.duration) {
    const d = fitDuration(req.duration, props.duration, entry);
    if (d !== undefined) {
      if (Number(d) !== Number(req.duration)) warnings.push(`Duração ajustada para ${d}s (limite do modelo).`);
      input.duration = d;
    }
  }

  const audioKey = pickKey(props, ['audio', 'generate_audio']);
  if (audioKey && typeof req.audio === 'boolean') input[audioKey] = req.audio;

  if (props.seed && req.seed !== '' && req.seed != null && Number.isFinite(Number(req.seed))) {
    input.seed = Math.max(0, Math.min(2147483647, Math.floor(Number(req.seed))));
  }

  // regra específica conhecida: Hailuo 2.3 não faz 10s em 1080P
  if (entry.vendor === 'Hailuo' && input.resolution === '1080P' && String(input.duration) === '10') {
    input.duration = '6';
    warnings.push('Hailuo não faz 10s em 1080P; duração ajustada para 6s.');
  }

  // completa obrigatórios com valor padrão do schema
  for (const key of schema?.required || []) {
    if (input[key] !== undefined) continue;
    const p = props[key] || {};
    if (p.default !== undefined) input[key] = p.default;
    else if (p.enum) input[key] = p.enum[0];
    else if (key === 'duration') input[key] = p.type === 'string' ? '5' : 5;
    else throw new ValidationError(`Campo obrigatório ausente para ${entry.name}: ${key}`);
  }

  // 5. remove o que o schema não conhece
  const dropped = [];
  if (Object.keys(props).length) {
    for (const k of Object.keys(input)) {
      if (!(k in props)) {
        dropped.push(k);
        delete input[k];
      }
    }
  }
  if (dropped.length) warnings.push(`Campos fora do schema removidos: ${dropped.join(', ')}.`);

  return { payload: { model: entry.id, input }, warnings };
}
