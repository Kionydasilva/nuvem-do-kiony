// Persistência em arquivos JSON locais (sem banco de dados).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const VIDEO_DIR = path.join(DATA_DIR, 'videos');
const ENV_FILE = path.join(ROOT, '.env');

for (const d of [DATA_DIR, UPLOAD_DIR, VIDEO_DIR]) fs.mkdirSync(d, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

// escrita atômica: grava num arquivo temporário e renomeia
function writeJson(file, value) {
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

// ---------- .env ----------
export function loadEnvFile() {
  try {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sem .env */
  }
}

function writeEnvVar(name, value) {
  let lines = [];
  try {
    lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  } catch {
    /* novo arquivo */
  }
  const re = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  const idx = lines.findIndex((l) => re.test(l));
  const entry = `${name}=${value}`;
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
  fs.writeFileSync(ENV_FILE, lines.filter((l, i) => l !== '' || i < lines.length - 1).join('\n') + '\n');
}

// ---------- config ----------
let config = { uploadFallback: true, ...readJson('config.json', {}) };

export function getApiKey() {
  return config.apiKey || process.env.KIE_API_KEY || '';
}

export function setApiKey(key) {
  config.apiKey = key;
  process.env.KIE_API_KEY = key;
  writeJson('config.json', config);
  writeEnvVar('KIE_API_KEY', key);
}

export function getConfig() {
  return config;
}

export function setConfig(patch) {
  config = { ...config, ...patch };
  writeJson('config.json', config);
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

// ---------- histórico ----------
let history = readJson('history.json', []);

export function listHistory() {
  return history;
}

export function getHistoryItem(id) {
  return history.find((h) => h.id === id || h.taskId === id);
}

export function addHistory(item) {
  history.unshift(item);
  writeJson('history.json', history);
  return item;
}

export function updateHistory(id, patch) {
  const item = getHistoryItem(id);
  if (!item) return undefined;
  Object.assign(item, patch, { updatedAt: Date.now() });
  writeJson('history.json', history);
  return item;
}

export function deleteHistory(id) {
  const item = getHistoryItem(id);
  if (!item) return false;
  history = history.filter((h) => h !== item);
  writeJson('history.json', history);
  if (item.localVideo) fs.rm(path.join(VIDEO_DIR, path.basename(item.localVideo)), { force: true }, () => {});
  return true;
}

// ---------- cache de modelos/schemas ----------
let modelsCache = readJson('models_cache.json', { schemas: {} });

export function getCachedSchema(model) {
  return modelsCache.schemas?.[model];
}

export function setCachedSchema(model, schema) {
  modelsCache.schemas = { ...(modelsCache.schemas || {}), [model]: { ...schema, cachedAt: Date.now() } };
  writeJson('models_cache.json', modelsCache);
}

// ---------- registro de uploads (para reenviar quando o link expirar) ----------
let uploads = readJson('uploads.json', {});

export function saveUpload(record) {
  uploads[record.url] = record;
  writeJson('uploads.json', uploads);
}

export function getUploadByUrl(url) {
  return uploads[url];
}
