// Catálogo de modelos de vídeo da KIE.
// `modes` diz, para cada modo do estúdio, em qual campo do schema cada mídia entra.
// Os nomes dos campos foram conferidos nos schemas oficiais (server/schemas.json, gerado de docs.kie.ai).
//
// Slots canônicos usados pelo estúdio:
//   firstFrame (1 imagem), lastFrame (1 imagem), refImages (lista), refVideos (lista),
//   sourceFile (1 arquivo: documento ou vídeo), link (1 URL)
//
// tagStyle define como as menções no prompt são traduzidas:
//   'wan3'     -> @image_1 vira Image1, @video_1 vira Video1
//   'kling4'   -> mantém @image_1 / @video_1 (e valida se o arquivo existe)
//   'keyframe' -> @image_1 vira @first_frame, @image_2 vira @last_frame
//   'plain'    -> menções viram texto simples ("image 1")

export const MODES = [
  'text_to_video',
  'first_frame',
  'first_and_last_frame',
  'reference_to_video',
  'file_to_video',
  'link_to_video',
];

const WAN3_MODES = {
  text_to_video: {},
  first_frame: { firstFrame: 'first_frame_url' },
  first_and_last_frame: { firstFrame: 'first_frame_url', lastFrame: 'last_frame_url' },
  reference_to_video: { refImages: 'reference_image_urls', refVideos: 'reference_video_urls' },
  file_to_video: { sourceFile: 'reference_file_urls' },
  link_to_video: { link: 'reference_link_urls' },
};

const SEEDANCE_MODES = {
  text_to_video: {},
  first_frame: { firstFrame: 'first_frame_url' },
  first_and_last_frame: { firstFrame: 'first_frame_url', lastFrame: 'last_frame_url' },
  reference_to_video: { refImages: 'reference_image_urls', refVideos: 'reference_video_urls' },
};

const DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.key,.pages,.numbers';

export const CATALOG = [
  // ---------------- Wan ----------------
  {
    id: 'wan/3-0-video', name: 'Wan 3.0', vendor: 'Wan', tagStyle: 'wan3',
    durationRange: [2, 30], autoDuration: true, modes: WAN3_MODES, fileAccept: DOC_ACCEPT,
    notes: 'Modo Arquivo aceita documentos (PDF, DOCX, PPTX...), não vídeo. Modos de frame e de referência não podem ser misturados.',
  },
  {
    id: 'wan/3-0-video-prime', name: 'Wan 3.0 Prime', vendor: 'Wan', tagStyle: 'wan3',
    durationRange: [2, 30], autoDuration: true, modes: WAN3_MODES, fileAccept: DOC_ACCEPT,
    notes: 'Versão de maior qualidade do Wan 3.0.',
  },
  {
    id: 'wan/2-7-text-to-video', name: 'Wan 2.7 Texto', vendor: 'Wan', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
  {
    id: 'wan/2-7-image-to-video', name: 'Wan 2.7 Imagem', vendor: 'Wan', tagStyle: 'plain',
    modes: {
      first_frame: { firstFrame: 'first_frame_url' },
      first_and_last_frame: { firstFrame: 'first_frame_url', lastFrame: 'last_frame_url' },
    },
  },
  {
    id: 'wan/2-7-r2v', name: 'Wan 2.7 Referência', vendor: 'Wan', tagStyle: 'plain',
    modes: { reference_to_video: { refImages: 'reference_image', refVideos: 'reference_video' } },
  },
  {
    id: 'wan/2-6-text-to-video', name: 'Wan 2.6 Texto', vendor: 'Wan', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
  {
    id: 'wan/2-6-image-to-video', name: 'Wan 2.6 Imagem', vendor: 'Wan', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_urls' } },
  },
  {
    id: 'wan/2-6-video-to-video', name: 'Wan 2.6 Vídeo→Vídeo', vendor: 'Wan', tagStyle: 'plain',
    modes: { file_to_video: { sourceFile: 'video_urls' } }, fileAccept: 'video/*',
    notes: 'Transforma um vídeo existente seguindo o prompt.',
  },
  {
    id: 'wan/2-2-a14b-text-to-video-turbo', name: 'Wan 2.2 Turbo Texto', vendor: 'Wan', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
  {
    id: 'wan/2-2-a14b-image-to-video-turbo', name: 'Wan 2.2 Turbo Imagem', vendor: 'Wan', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_url' } },
  },

  // ---------------- Kling ----------------
  {
    id: 'kling-4.0/reference-to-video', name: 'Kling 4.0 Referência', vendor: 'Kling', tagStyle: 'kling4',
    modes: { text_to_video: {}, reference_to_video: { refImages: 'image_urls', refVideos: 'video_urls' } },
    notes: 'Cite as mídias no prompt com @image_1, @video_1. Toda menção precisa ter o arquivo correspondente.',
  },
  {
    id: 'kling-4.0/keyframe-to-video', name: 'Kling 4.0 Keyframes', vendor: 'Kling', tagStyle: 'keyframe',
    modes: {
      first_frame: { firstFrame: 'first_frame_url' },
      first_and_last_frame: { firstFrame: 'first_frame_url', lastFrame: 'last_frame_url' },
    },
    notes: 'Cite os frames no prompt com @first_frame e @last_frame.',
  },
  {
    id: 'kling/v3-turbo-text-to-video', name: 'Kling 3 Turbo Texto', vendor: 'Kling', tagStyle: 'plain',
    durationRange: [3, 15], modes: { text_to_video: {} },
  },
  {
    id: 'kling/v3-turbo-image-to-video', name: 'Kling 3 Turbo Imagem', vendor: 'Kling', tagStyle: 'plain',
    durationRange: [3, 15], modes: { first_frame: { firstFrame: 'image_urls' } },
  },
  {
    id: 'kling/v2-1-master-text-to-video', name: 'Kling 2.1 Master Texto', vendor: 'Kling', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
  {
    id: 'kling/v2-1-master-image-to-video', name: 'Kling 2.1 Master Imagem', vendor: 'Kling', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_url' } },
  },
  {
    id: 'kling/v2-1-pro', name: 'Kling 2.1 Pro', vendor: 'Kling', tagStyle: 'plain',
    modes: {
      first_frame: { firstFrame: 'image_url' },
      first_and_last_frame: { firstFrame: 'image_url', lastFrame: 'tail_image_url' },
    },
  },
  {
    id: 'kling/v2-1-standard', name: 'Kling 2.1 Standard', vendor: 'Kling', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_url' } },
  },

  // ---------------- Seedance ----------------
  {
    id: 'bytedance/seedance-2', name: 'Seedance 2.0', vendor: 'Seedance', tagStyle: 'plain',
    durationRange: [4, 15], autoDuration: true, modes: SEEDANCE_MODES,
  },
  {
    id: 'bytedance/seedance-2-fast', name: 'Seedance 2.0 Fast', vendor: 'Seedance', tagStyle: 'plain',
    durationRange: [4, 15], autoDuration: true, modes: SEEDANCE_MODES,
  },
  {
    id: 'bytedance/seedance-2-5', name: 'Seedance 2.5', vendor: 'Seedance', tagStyle: 'plain',
    durationRange: [4, 30], autoDuration: true, modes: SEEDANCE_MODES,
  },

  // ---------------- Hailuo ----------------
  {
    id: 'hailuo/2-3-image-to-video-pro', name: 'Hailuo 2.3 Pro', vendor: 'Hailuo', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_url' } },
    notes: '10s não é suportado em 1080P.',
  },
  {
    id: 'hailuo/2-3-image-to-video-standard', name: 'Hailuo 2.3 Standard', vendor: 'Hailuo', tagStyle: 'plain',
    modes: { first_frame: { firstFrame: 'image_url' } },
    notes: '10s não é suportado em 1080P.',
  },
  {
    id: 'hailuo/02-image-to-video-pro', name: 'Hailuo 02 Pro Imagem', vendor: 'Hailuo', tagStyle: 'plain',
    modes: {
      first_frame: { firstFrame: 'image_url' },
      first_and_last_frame: { firstFrame: 'image_url', lastFrame: 'end_image_url' },
    },
  },
  {
    id: 'hailuo/02-text-to-video-pro', name: 'Hailuo 02 Pro Texto', vendor: 'Hailuo', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
  {
    id: 'hailuo/02-text-to-video-standard', name: 'Hailuo 02 Standard Texto', vendor: 'Hailuo', tagStyle: 'plain',
    modes: { text_to_video: {} },
  },
];

export function findModel(id) {
  return CATALOG.find((m) => m.id === id);
}
