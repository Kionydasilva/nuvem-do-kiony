// Upload com fallback: KIE CDN -> Catbox -> Tmpfiles.
// O arquivo também fica salvo em data/uploads, para ser reenviado se o link expirar
// (links do CDN da KIE são apagados após 24h).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getApiKey, getConfig, saveUpload, getUploadByUrl, UPLOAD_DIR } from './store.js';

const KIE_UPLOAD = process.env.KIE_UPLOAD_URL || 'https://kieai.redpandaai.co/api/file-stream-upload';
const KIE_TTL_MS = 23 * 60 * 60 * 1000; // margem antes das 24h

async function toKie(buf, name, mime) {
  const key = getApiKey();
  if (!key) throw new Error('sem chave');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), name);
  form.append('uploadPath', 'kie-video-studio');
  form.append('fileName', name);
  const res = await fetch(KIE_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  const url = json?.data?.downloadUrl || json?.data?.fileUrl;
  if (!res.ok || !url || (json.code && json.code !== 200)) {
    throw new Error(`KIE ${json.code || res.status}: ${json.msg || 'falha'}`);
  }
  return url;
}

async function toCatbox(buf, name, mime) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buf], { type: mime }), name);
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
  const text = (await res.text()).trim();
  if (!res.ok || !/^https:\/\//.test(text)) throw new Error(`Catbox ${res.status}: ${text.slice(0, 100)}`);
  return text;
}

async function toTmpfiles(buf, name, mime) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), name);
  const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
  const json = await res.json().catch(() => ({}));
  const url = json?.data?.url;
  if (!res.ok || !url) throw new Error(`Tmpfiles ${res.status}`);
  // a página vira link direto trocando /123/ por /dl/123/
  return url.replace(/^http:/, 'https:').replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

const HOSTS = [
  { name: 'kie', fn: toKie, public: false },
  { name: 'catbox', fn: toCatbox, public: true },
  { name: 'tmpfiles', fn: toTmpfiles, public: true },
];

async function pushToHosts(buf, name, mime) {
  const errors = [];
  const allowPublic = getConfig().uploadFallback !== false;
  for (const host of HOSTS) {
    if (host.public && !allowPublic) continue;
    try {
      const url = await host.fn(buf, name, mime);
      return { url, host: host.name, errors };
    } catch (e) {
      errors.push(`${host.name}: ${e.message}`);
    }
  }
  const err = new Error(
    allowPublic
      ? `Nenhum serviço de upload respondeu. ${errors.join(' | ')}`
      : `Upload na KIE falhou e o fallback público está desligado. ${errors.join(' | ')}`,
  );
  err.status = 502;
  throw err;
}

export async function uploadFile({ buffer, originalname, mimetype }) {
  const ext = path.extname(originalname || '').toLowerCase() || '';
  const id = crypto.randomUUID();
  const safeName = `${id}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buffer);
  const { url, host, errors } = await pushToHosts(buffer, safeName, mimetype || 'application/octet-stream');
  const record = {
    id,
    url,
    host,
    localName: safeName,
    originalName: originalname,
    mime: mimetype,
    size: buffer.length,
    uploadedAt: Date.now(),
  };
  saveUpload(record);
  return { ...record, fallbackErrors: errors };
}

// Garante que a URL ainda vale. Se for um upload nosso na KIE com mais de 23h, reenvia.
export async function ensureFresh(url) {
  const rec = getUploadByUrl(url);
  if (!rec || rec.host !== 'kie' || Date.now() - rec.uploadedAt < KIE_TTL_MS) return url;
  const file = path.join(UPLOAD_DIR, rec.localName);
  if (!fs.existsSync(file)) return url;
  const { url: fresh, host } = await pushToHosts(fs.readFileSync(file), rec.localName, rec.mime);
  saveUpload({ ...rec, url: fresh, host, uploadedAt: Date.now() });
  return fresh;
}
