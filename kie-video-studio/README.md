# Kie Video Studio

Estúdio web para gerar vídeos com IA pela API da [KIE](https://kie.ai). Backend Express + frontend Vite/React/Tailwind, servidos juntos em `http://localhost:3001`.

## Como rodar

**Windows:** duplo clique em `start.bat`.

**Qualquer sistema:**
```bash
cp .env.example .env      # coloque sua KIE_API_KEY (ou defina pela interface)
npm install
npm run build
npm start                 # http://localhost:3001
```
Desenvolvimento: `npm run dev:server` + `npm run dev:client` (http://localhost:5173). Testes: `npm test`.

## Como funciona

- **Schemas reais.** `server/schemas.json` foi gerado da documentação oficial (docs.kie.ai). O servidor tenta primeiro o schema ao vivo da KIE, depois o cache (`data/models_cache.json`), depois esse arquivo.
- **Sanitizador** (`server/sanitize.js`): só envia as mídias do modo escolhido, coloca cada uma no campo exato do schema (string ou lista), traduz `@image_1` para a sintaxe do modelo, encaixa duração/resolução/proporção nos valores aceitos e remove qualquer campo fora do schema.
- **Upload:** CDN da KIE → Catbox → Tmpfiles. Cada arquivo também fica em `data/uploads`; se um link da KIE passar de 23h (a KIE apaga em 24h), ele é reenviado sozinho ao gerar.
- **Vídeos prontos** são baixados para `data/videos`, então a galeria não depende do link da KIE expirar.
- **Dados locais:** `data/history.json`, `data/config.json`, `.env`. Nada vai para banco externo.

## Limites conhecidos

- O fallback Catbox/Tmpfiles deixa o arquivo **público** para quem tiver o link (Catbox é permanente). Dá para desligar no modal da chave.
- O custo por segundo na ficha técnica é a média das **suas** gerações; sem histórico, o link leva à tabela oficial.
- O endpoint `/api/v1/models/{model}/schema` não aparece na documentação pública da KIE; se ele não existir, o app usa os schemas da documentação.
