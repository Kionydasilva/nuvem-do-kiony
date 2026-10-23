import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import multer from 'multer';

import {
  ROOT, VIDEO_DIR, UPLOAD_DIR, loadEnvFile, getApiKey, setApiKey, maskKey, getConfig, setConfig,
  listHistory, getHistoryItem, addHistory, updateHistory, deleteHistory, getCachedSchema, setCachedSchema,
} from './store.js';
import { kieFetch, KieError } from './kie.js';
import { CATALOG, findModel } from './catalog.js';
import { buildPayload, ValidationError } from './sanitize.js';
import { uploadFile, ensureFresh } from './upload.js';

loadEnvFile();

const EMBEDDED = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'schemas.json'), 'utf8'));
const PORT = Number(process.env.PORT) || 3001;
const app = express();
app.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------- schemas ----------------
const liveTried = new Set(); // evita bater na KIE a cada geração

// A resposta do endpoint de schema pode vir em formatos diferentes; procuramos o objeto com "properties.prompt".
function normalizeSchema(json) {
  const seen = new Set();
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || seen.has(o) || depth > 8) return null;
    seen.add(o);
    if (o.properties && typeof o.properties === 'object') {
      if (o.properties.input?.properties) return { properties: o.properties.input.properties, required: o.properties.input.required || [] };
      if ('prompt' in o.properties) return { properties: o.properties, required: o.required || [] };
    }
    for (const v of Object.values(o)) {
      const r = walk(typeof v === 'string' && v.startsWith('{') ? safeParse(v) : v, depth + 1);
      if (r) return r;
    }
    return null;
  };
  return walk(json);
}
const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

async function resolveSchema(model, { forceLive = false } = {}) {
  if (forceLive || !liveTried.has(model)) {
    liveTried.add(model);
    try {
      const json = await kieFetch(`/api/v1/models/${model}/schema`, { timeout: 8000 });
      const schema = normalizeSchema(json);
      if (schema) {
        setCachedSchema(model, schema);
        return { schema, source: 'live' };
      }
    } catch (e) {
      // 429 (limite), 404 ou sem chave: segue para o cache
      if (e.status === 429) console.warn(`[schema] rate-limit da KIE para ${model}; usando cache`);
    }
  }
  const cached = getCachedSchema(model);
  if (cached) return { schema: cached, source: 'cache' };
  if (EMBEDDED[model]) return { schema: EMBEDDED[model], source: 'docs' };
  return { schema: null, source: 'none' };
}

// Resume o schema em opções que a interface entende.
function describeSettings(entry, schema) {
  const p = schema?.properties || {};
  const arKey = ['aspect_ratio', 'ratio'].find((k) => k in p);
  const d = p.duration;
  let duration = null;
  if (d) {
    if (d.enum) duration = { options: d.enum.map(Number), default: Number(d.default ?? d.enum[0]) };
    else {
      const [min, max] = entry.durationRange || [d.minimum ?? 1, d.maximum ?? 15];
      duration = { min, max, default: Number(d.default ?? Math.min(5, max)) };
    }
    duration.auto = !!entry.autoDuration;
  }
  return {
    resolutions: p.resolution?.enum || [],
    defaultResolution: p.resolution?.default || p.resolution?.enum?.[0] || null,
    aspectRatios: arKey ? p[arKey].enum || [] : [],
    defaultAspect: arKey ? p[arKey].default || null : null,
    duration,
    audio: 'audio' in p || 'generate_audio' in p,
    seed: 'seed' in p,
    negativePrompt: 'negative_prompt' in p,
    promptMax: p.prompt?.maxLength || null,
  };
}

function observedCost(modelId) {
  const done = listHistory().filter((h) => h.model === modelId && h.state === 'success' && h.creditsConsumed && h.durationSec > 0);
  if (!done.length) return null;
  const perSec = done.reduce((s, h) => s + h.creditsConsumed / h.durationSec, 0) / done.length;
  return { perSec: Math.round(perSec * 100) / 100, samples: done.length };
}

// ---------------- config / créditos ----------------
app.get('/api/config', (req, res) => {
  const key = getApiKey();
  res.json({ hasKey: !!key, maskedKey: maskKey(key), uploadFallback: getConfig().uploadFallback !== false });
});

app.post('/api/config/key', wrap(async (req, res) => {
  const key = String(req.body?.apiKey || '').trim();
  if (key.length < 16 || /\s/.test(key)) throw new ValidationError('Chave inválida.');
  setApiKey(key);
  liveTried.clear();
  let credits = null;
  let warning = null;
  try {
    credits = (await kieFetch('/api/v1/chat/credit')).data;
  } catch (e) {
    warning = `Chave salva, mas a KIE respondeu: ${e.message}`;
  }
  res.json({ ok: true, maskedKey: maskKey(key), credits, warning });
}));

app.post('/api/config', (req, res) => {
  if (typeof req.body?.uploadFallback === 'boolean') setConfig({ uploadFallback: req.body.uploadFallback });
  res.json({ ok: true, uploadFallback: getConfig().uploadFallback !== false });
});

app.get('/api/credits', wrap(async (req, res) => {
  const json = await kieFetch('/api/v1/chat/credit');
  res.json({ credits: Number(json.data) });
}));

// ---------------- modelos ----------------
app.get('/api/models', wrap(async (req, res) => {
  const models = CATALOG.map((entry) => {
    const schema = getCachedSchema(entry.id) || EMBEDDED[entry.id];
    return {
      id: entry.id,
      name: entry.name,
      vendor: entry.vendor,
      modes: Object.keys(entry.modes),
      tagStyle: entry.tagStyle,
      notes: entry.notes || null,
      fileAccept: entry.fileAccept || null,
      settings: describeSettings(entry, schema),
      observedCost: observedCost(entry.id),
    };
  });
  res.json({ models, vendors: [...new Set(models.map((m) => m.vendor))] });
}));

app.get('/api/models/:model/schema', wrap(async (req, res) => {
  const model = req.params.model;
  const entry = findModel(model);
  const { schema, source } = await resolveSchema(model, { forceLive: req.query.refresh === '1' });
  if (!schema) return res.status(404).json({ error: `Schema não encontrado para ${model}` });
  res.json({ model, source, schema, settings: entry ? describeSettings(entry, schema) : null });
}));

// ---------------- upload ----------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
app.post('/api/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError('Nenhum arquivo enviado (campo "file").');
  res.json(await uploadFile(req.file));
}));

// ---------------- geração ----------------
const MEDIA_SLOTS = ['firstFrame', 'lastFrame', 'refImages', 'refVideos', 'sourceFile'];

app.post('/api/generate', wrap(async (req, res) => {
  const body = req.body || {};
  const entry = findModel(body.model);
  if (!entry) throw new ValidationError(`Modelo desconhecido: ${body.model}`);
  const { schema, source } = await resolveSchema(entry.id);

  // mídias do modo atual: renova links do CDN da KIE que já expiraram
  const slotMap = entry.modes[body.mode] || {};
  const request = { ...body };
  for (const slot of MEDIA_SLOTS) {
    if (!slotMap[slot] || !request[slot]) continue;
    const list = Array.isArray(request[slot]) ? request[slot] : [request[slot]];
    const fresh = await Promise.all(list.map((u) => ensureFresh(u)));
    request[slot] = Array.isArray(request[slot]) ? fresh : fresh[0];
  }

  const { payload, warnings } = buildPayload(request, schema);
  const json = await kieFetch('/api/v1/jobs/createTask', { method: 'POST', body: payload });
  const taskId = json.data?.taskId;
  if (!taskId) throw new KieError('A KIE não devolveu taskId.', 502, json);

  const item = addHistory({
    id: crypto.randomUUID(),
    taskId,
    model: entry.id,
    modelName: entry.name,
    mode: body.mode,
    prompt: body.prompt || '',
    request: body, // o pedido original do estúdio (para o botão Reutilizar)
    assets: body.assets || {},
    payload,
    schemaSource: source,
    warnings,
    state: 'submitted',
    durationSec: Number(payload.input.duration) > 0 ? Number(payload.input.duration) : null,
    resolution: payload.input.resolution || null,
    aspectRatio: payload.input.aspect_ratio || payload.input.ratio || null,
    createdAt: Date.now(),
  });
  res.json({ taskId, historyId: item.id, warnings, payload, schemaSource: source });
}));

// ---------------- tarefas ----------------
const downloading = new Set();

async function downloadVideo(item, url) {
  if (downloading.has(item.id) || item.localVideo) return;
  downloading.add(item.id);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const ext = path.extname(new URL(url).pathname) || '.mp4';
    const name = `${item.id}${ext}`;
    const tmp = path.join(VIDEO_DIR, `${name}.part`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, path.join(VIDEO_DIR, name));
    updateHistory(item.id, { localVideo: `/media/videos/${name}` });
  } catch (e) {
    console.warn(`[video] não consegui salvar cópia local de ${item.id}: ${e.message}`);
  } finally {
    downloading.delete(item.id);
  }
}

async function refreshTask(taskId) {
  const json = await kieFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
  const d = json.data || {};
  const result = d.resultJson ? safeParse(d.resultJson) || {} : {};
  const resultUrls = result.resultUrls || result.resultUrl || [];
  const info = {
    state: d.state || 'waiting',
    progress: d.progress ?? null,
    resultUrls: Array.isArray(resultUrls) ? resultUrls : [resultUrls],
    lastFrameUrl: result.lastFrameUrl || null,
    creditsConsumed: d.creditsConsumed ?? null,
    failCode: d.failCode || null,
    failMsg: d.failMsg || null,
    costTime: d.costTime ?? null,
    completeTime: d.completeTime ?? null,
  };
  const item = getHistoryItem(taskId);
  if (item) {
    updateHistory(item.id, {
      state: info.state,
      progress: info.progress,
      resultUrls: info.resultUrls,
      creditsConsumed: info.creditsConsumed,
      failMsg: info.failMsg,
      costTime: info.costTime,
      completeTime: info.completeTime,
    });
    if (info.state === 'success' && info.resultUrls[0]) downloadVideo(item, info.resultUrls[0]);
  }
  return { ...info, item: getHistoryItem(taskId) };
}

app.get('/api/tasks/:taskId', wrap(async (req, res) => {
  res.json(await refreshTask(req.params.taskId));
}));

// Verifica em segundo plano as tarefas pendentes, para o histórico ficar certo mesmo com o navegador fechado.
const PENDING = new Set(['submitted', 'waiting', 'queuing', 'generating']);
setInterval(async () => {
  if (!getApiKey()) return;
  const recent = listHistory().filter((h) => PENDING.has(h.state) && Date.now() - h.createdAt < 12 * 3600 * 1000);
  for (const h of recent) {
    try {
      await refreshTask(h.taskId);
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }
}, 20000).unref();

// ---------------- histórico ----------------
app.get('/api/history', (req, res) => res.json({ items: listHistory() }));
app.delete('/api/history/:id', (req, res) => {
  if (!deleteHistory(req.params.id)) return res.status(404).json({ error: 'Item não encontrado' });
  res.json({ ok: true });
});

// ---------------- arquivos estáticos ----------------
app.use('/media/videos', express.static(VIDEO_DIR, { maxAge: '7d' }));
app.use('/media/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

const DIST = path.join(ROOT, 'dist');
app.use(express.static(DIST));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/media')) return next();
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(503).send('Frontend não compilado. Rode "npm run build".');
});

// ---------------- erros ----------------
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = Number(err.status) || 500;
  if (status < 400 || status > 599) status = 502;
  if (err.code === 'LIMIT_FILE_SIZE') status = 413;
  const out = { error: err.message || 'Erro interno' };
  if (status === 401 || status === 402) out.hint = 'Verifique a chave de API e o saldo de créditos na KIE.';
  if (status === 429) out.hint = 'Limite de requisições da KIE. Aguarde alguns segundos.';
  if (err.body && typeof err.body === 'object') out.kie = err.body;
  if (status >= 500) console.error('[erro]', err.message);
  res.status(status).json(out);
});

app.listen(PORT, () => {
  console.log(`\n  Kie Video Studio rodando em http://localhost:${PORT}`);
  if (!getApiKey()) console.log('  Atenção: nenhuma chave KIE configurada. Defina no .env ou pela interface.\n');
});
