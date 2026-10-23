import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPayload, ValidationError } from './sanitize.js';
import { CATALOG } from './catalog.js';

const S = JSON.parse(fs.readFileSync(new URL('./schemas.json', import.meta.url)));
const run = (req) => buildPayload(req, S[req.model]);
const IMG = 'https://x.test/a.png';
const IMG2 = 'https://x.test/b.png';
const VID = 'https://x.test/v.mp4';

test('todo modelo do catálogo tem schema e campos de mídia que existem no schema', () => {
  for (const m of CATALOG) {
    assert.ok(S[m.id], `sem schema: ${m.id}`);
    for (const [mode, slots] of Object.entries(m.modes)) {
      for (const field of Object.values(slots)) {
        assert.ok(field in S[m.id].properties, `${m.id} ${mode}: campo ${field} não existe no schema`);
      }
    }
  }
});

test('Wan 3.0 primeiro frame: só first_frame_url, sem vídeo de outra aba', () => {
  const { payload, warnings } = run({
    model: 'wan/3-0-video', mode: 'first_frame', prompt: 'ela sorri',
    firstFrame: IMG, refVideos: [VID], refImages: [IMG2], duration: 5,
  });
  assert.deepEqual(Object.keys(payload.input).sort(), ['duration', 'first_frame_url', 'prompt']);
  assert.equal(payload.input.first_frame_url, IMG);
  assert.ok(warnings.some((w) => w.includes('descartadas')));
});

test('Wan 3.0 referência: arrays e tags Image1/Video1', () => {
  const { payload } = run({
    model: 'wan/3-0-video', mode: 'reference_to_video', prompt: '@image_1 dança como @video_1',
    refImages: [IMG], refVideos: [VID], firstFrame: IMG2,
  });
  assert.deepEqual(payload.input.reference_image_urls, [IMG]);
  assert.deepEqual(payload.input.reference_video_urls, [VID]);
  assert.equal(payload.input.first_frame_url, undefined);
  assert.equal(payload.input.prompt, 'Image1 dança como Video1');
});

test('texto puro remove qualquer mídia', () => {
  const { payload } = run({ model: 'wan/3-0-video', mode: 'text_to_video', prompt: 'gato', firstFrame: IMG, refVideos: [VID] });
  assert.deepEqual(Object.keys(payload.input), ['prompt']);
});

test('Kling 4.0 referência: image_urls/video_urls e valida menções', () => {
  const { payload } = run({ model: 'kling-4.0/reference-to-video', mode: 'reference_to_video', prompt: 'Image1 anda', refImages: [IMG], duration: 40 });
  assert.deepEqual(payload.input.image_urls, [IMG]);
  assert.equal(payload.input.prompt, '@image_1 anda');
  assert.equal(payload.input.duration, 30);
  assert.throws(() => run({ model: 'kling-4.0/reference-to-video', mode: 'reference_to_video', prompt: '@video_1', refImages: [IMG] }), ValidationError);
});

test('Kling 4.0 keyframes: tags @first_frame / @last_frame', () => {
  const { payload } = run({ model: 'kling-4.0/keyframe-to-video', mode: 'first_and_last_frame', prompt: 'de @image_1 para @image_2', firstFrame: IMG, lastFrame: IMG2 });
  assert.equal(payload.input.prompt, 'de @first_frame para @last_frame');
  assert.equal(payload.input.last_frame_url, IMG2);
});

test('Kling 2.1 Pro: image_url + tail_image_url, duração em string do enum', () => {
  const { payload } = run({ model: 'kling/v2-1-pro', mode: 'first_and_last_frame', prompt: 'x', firstFrame: IMG, lastFrame: IMG2, duration: 7, negativePrompt: 'borrão' });
  assert.equal(payload.input.image_url, IMG);
  assert.equal(payload.input.tail_image_url, IMG2);
  assert.equal(payload.input.duration, '5');
  assert.equal(payload.input.negative_prompt, 'borrão');
});

test('Wan 2.6 i2v usa image_urls (lista); Wan 2.2 usa image_url (string)', () => {
  assert.deepEqual(run({ model: 'wan/2-6-image-to-video', mode: 'first_frame', prompt: 'xx', firstFrame: IMG }).payload.input.image_urls, [IMG]);
  assert.equal(run({ model: 'wan/2-2-a14b-image-to-video-turbo', mode: 'first_frame', prompt: 'xx', firstFrame: IMG }).payload.input.image_url, IMG);
});

test('resolução respeita a caixa do enum e campos fora do schema somem', () => {
  const { payload } = run({ model: 'bytedance/seedance-2', mode: 'text_to_video', prompt: 'abc', resolution: '1080P', audio: false, seed: 42 });
  assert.equal(payload.input.resolution, '1080p');
  assert.equal(payload.input.generate_audio, false);
  assert.equal(payload.input.seed, undefined); // seedance não tem seed no schema
});

test('Hailuo: 1080P + 10s vira 6s e obrigatórios são preenchidos', () => {
  const { payload } = run({ model: 'hailuo/2-3-image-to-video-pro', mode: 'first_frame', prompt: 'x', firstFrame: IMG, resolution: '1080P', duration: 10 });
  assert.equal(payload.input.duration, '6');
  const r = run({ model: 'hailuo/2-3-image-to-video-pro', mode: 'first_frame', prompt: 'x', firstFrame: IMG });
  assert.ok(r.payload.input.duration && r.payload.input.resolution);
});

test('modo não suportado e mídia faltando geram erro claro', () => {
  assert.throws(() => run({ model: 'kling/v2-1-standard', mode: 'text_to_video', prompt: 'x' }), /não suporta/);
  assert.throws(() => run({ model: 'wan/3-0-video', mode: 'first_frame', prompt: 'x' }), /precisa/);
  assert.throws(() => run({ model: 'wan/3-0-video', mode: 'link_to_video', prompt: 'x', link: 'ftp://a' }), /http/);
});
