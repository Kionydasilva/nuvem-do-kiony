// Cliente da API da KIE (api.kie.ai).
import { getApiKey } from './store.js';

export const KIE_BASE = process.env.KIE_BASE_URL || 'https://api.kie.ai';

export class KieError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function kieFetch(pathname, { method = 'GET', body, timeout = 30000 } = {}) {
  const key = getApiKey();
  if (!key) throw new KieError('Chave de API da KIE não configurada. Clique no botão da chave no topo.', 401);
  let res;
  try {
    res = await fetch(KIE_BASE + pathname, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw new KieError(`Sem resposta da KIE (${e.name === 'TimeoutError' ? 'tempo esgotado' : e.message}).`, 504);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new KieError(`Resposta inválida da KIE (HTTP ${res.status}).`, res.status >= 400 ? res.status : 502, text.slice(0, 300));
  }
  // A KIE às vezes responde HTTP 200 com { code: 4xx } no corpo.
  const code = Number(json.code ?? res.status);
  if (!res.ok || (code && code !== 200)) {
    throw new KieError(json.msg || json.message || `Erro da KIE (${code})`, code || res.status, json);
  }
  return json;
}
