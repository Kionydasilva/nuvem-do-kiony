async function request(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json', ...opts.headers } : opts.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erro HTTP ${res.status}`);
    err.status = res.status;
    err.hint = data.hint;
    throw err;
  }
  return data;
}

export const api = {
  config: () => request('/api/config'),
  setKey: (apiKey) => request('/api/config/key', { method: 'POST', body: JSON.stringify({ apiKey }) }),
  setConfig: (patch) => request('/api/config', { method: 'POST', body: JSON.stringify(patch) }),
  credits: () => request('/api/credits'),
  models: () => request('/api/models'),
  schema: (id) => request(`/api/models/${encodeURIComponent(id)}/schema`),
  generate: (body) => request('/api/generate', { method: 'POST', body: JSON.stringify(body) }),
  task: (id) => request(`/api/tasks/${encodeURIComponent(id)}`),
  history: () => request('/api/history'),
  deleteHistory: (id) => request(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/upload', { method: 'POST', body: fd });
  },
};
