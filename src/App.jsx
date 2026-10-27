import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Image,
  Layers3,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'spriteforge-assets-v1';
const PENDING_STORAGE_KEY = 'spriteforge-assets-pending-v1';
const PROJECT_NAME = 'Hollow Vale';

const SEED_ASSETS = [
  {
    id: 'mira',
    type: 'character',
    name: 'Mira',
    subtitle: 'A cartógrafa das marés',
    role: 'PERSONAGEM JOGÁVEL',
    brief: 'Uma cartógrafa gentil que guia viajantes pela névoa usando uma lanterna viva. Silhueta legível em tamanho pequeno, capa curta e equipamento de exploração.',
    prompt: 'Uma cartógrafa de fantasia aconchegante, capa verde-musgo, botas de couro gastas, cabelo castanho curto e uma pequena lanterna bioluminescente. Formas simples, materiais artesanais, silhueta clara para jogo 2D.',
    palette: { coat: '#667354', cloak: '#3e5145', accent: '#c6ed78', skin: '#e6b28d', hair: '#4a3531', leather: '#775a43', metal: '#aab2a0' },
    animations: ['Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death'],
    completed: [false, false, false, false, false],
    target: '48 × 48 px',
    outputPath: 'game/assets/characters/mira',
  },
  {
    id: 'bracken',
    type: 'character',
    name: 'Bracken',
    subtitle: 'Guardião do bosque',
    role: 'NPC · BOSQUE',
    brief: 'Um guardião robusto de uma floresta antiga, coberto por musgo, casca e pequenos fungos luminosos. Deve parecer protetor, não ameaçador.',
    prompt: 'Guardião de bosque de fantasia, corpo largo feito de madeira escura e musgo, pequenos fungos luminosos em verde-lima, olhos âmbar. Silhueta amigável e legível em pixel art.',
    palette: { coat: '#63795b', cloak: '#36483f', accent: '#d1ec7c', skin: '#bd9d72', hair: '#344038', leather: '#70583f', metal: '#a6b08b' },
    animations: ['Idle', 'Walk', 'Wave', 'Hit'],
    completed: [false, false, false, false, false],
    target: '64 × 64 px',
    outputPath: 'game/assets/characters/bracken',
  },
  {
    id: 'wisp',
    type: 'character',
    name: 'Bog wisp',
    subtitle: 'Espírito do pântano',
    role: 'INIMIGO · PÂNTANO',
    brief: 'Uma criatura pequena, flutuante e curiosa feita de névoa, com um núcleo de luz quente. O movimento deve ser fácil de ler em silhueta.',
    prompt: 'Espírito de pântano flutuante, corpo de névoa azul-petróleo e um núcleo de luz âmbar. Formas arredondadas, expressão curiosa, contraste alto e poucos detalhes.',
    palette: { coat: '#527b78', cloak: '#294a50', accent: '#f2c879', skin: '#94c6b5', hair: '#2c454b', leather: '#755946', metal: '#a9d3c2' },
    animations: ['Float', 'Dash', 'Cast', 'Hit', 'Fade'],
    completed: [false, false, false, false, false],
    target: '48 × 48 px',
    outputPath: 'game/assets/characters/bog-wisp',
  },
  {
    id: 'lantern',
    type: 'item',
    itemKind: 'lantern',
    name: 'Lanterna de maré',
    subtitle: 'Ferramenta · luz viva',
    role: 'FERRAMENTA · LUZ',
    brief: 'Uma lanterna portátil, antiga, com vidro verde que pulsa perto de lugares mágicos. O ponto de origem para animações é o gancho superior.',
    prompt: 'Lanterna de mão de cobre envelhecido e vidro verde-água bioluminescente, design artesanal, formato reconhecível em vista frontal e lateral, fundo transparente.',
    palette: { coat: '#9b7048', cloak: '#3d6253', accent: '#c6ed78', skin: '#e6b28d', hair: '#4a3531', leather: '#775a43', metal: '#bd9867' },
    animations: ['Idle glow', 'Sway', 'Pulse'],
    completed: [false, false, false, false, false],
    target: '64 × 64 px',
    outputPath: 'game/assets/items/tide-lantern',
  },
  {
    id: 'moonblade',
    type: 'item',
    itemKind: 'blade',
    name: 'Lâmina da lua',
    subtitle: 'Arma · espada curta',
    role: 'ARMA · MÃO DIREITA',
    brief: 'Uma lâmina curta para Mira, leve o bastante para animações rápidas. Manter a orientação e o ponto de empunhadura consistentes em todos os renders.',
    prompt: 'Espada curta de fantasia com lâmina curva prateada, guarda em forma de lua crescente, cabo envolto em couro verde escuro, pequenos detalhes dourados. Fundo transparente.',
    palette: { coat: '#9aa9a7', cloak: '#506c68', accent: '#d8ef93', skin: '#e6b28d', hair: '#4a3531', leather: '#604c3d', metal: '#d4d9c8' },
    animations: ['Idle', 'Slash', 'Spin'],
    completed: [false, false, false, false, false],
    target: '48 × 48 px',
    outputPath: 'game/assets/items/moonblade',
  },
];

const CHARACTER_STAGES = [
  { id: 'direction', short: 'Brief', title: 'Direção de arte', description: 'Defina a identidade visual, a silhueta e as regras que mantêm o personagem consistente.', icon: FileText, output: 'brief.md' },
  { id: 'references', short: 'Referências', title: 'Prancha de referências', description: 'Frente, ¾, perfil e costas — mesma escala, pose neutra e paleta em todas as vistas.', icon: Image, output: 'references/*.png' },
  { id: 'model', short: 'Modelo 3D', title: 'Modelo 3D', description: 'Crie um modelo otimizado para jogo, alinhado com as referências e pronto para rigging.', icon: Box, output: 'model.glb' },
  { id: 'rig', short: 'Rig & animação', title: 'Rig & animação', description: 'Prepare o esqueleto e os clips solicitados; Mixamo, Blender ou outro adapter.', icon: Activity, output: 'rig/ + animations/' },
  { id: 'spritesheet', short: 'Spritesheet', title: 'Spritesheet 2D', description: 'Renderize animações em câmera e escala fixas, com transparência e metadados.', icon: Layers3, output: 'spritesheet.png + json' },
];

const ITEM_STAGES = [
  { id: 'direction', short: 'Brief', title: 'Direção de arte', description: 'Defina a função, o material, a silhueta e o ponto de pivô do item.', icon: FileText, output: 'brief.md' },
  { id: 'references', short: 'Referências', title: 'Prancha de referências', description: 'Frente, perfil e costas com escala, iluminação e materiais consistentes.', icon: Image, output: 'references/*.png' },
  { id: 'model', short: 'Modelo 3D', title: 'Modelo 3D', description: 'Gere um modelo otimizado, mantendo a forma e o ponto de encaixe do item.', icon: Box, output: 'model.glb' },
  { id: 'motion', short: 'Variações', title: 'Movimento & variações', description: 'Opcional: crie rotação, brilho, recoil ou animações simples para o item.', icon: Activity, output: 'motion/ (opcional)', optional: true },
  { id: 'spritesheet', short: 'Spritesheet', title: 'Spritesheet 2D', description: 'Renderize o item com pivô previsível, transparência e metadados por frame.', icon: Layers3, output: 'spritesheet.png + json' },
];

const CHAR_ANIMATION_OPTIONS = ['Idle', 'Walk', 'Run', 'Jump', 'Attack', 'Hit', 'Death', 'Emote'];
const ITEM_ANIMATION_OPTIONS = ['Idle glow', 'Sway', 'Spin', 'Slash', 'Pulse', 'Pickup'];
const ENTRY_OPTIONS = [
  { id: 'prompt', startStageIndex: 0, sourceStageIndex: null, label: 'Começar pelo prompt / brief', detail: 'A tarefa começa na direção de arte; imagem de referência é opcional.', requiresPath: false },
  { id: 'brief', startStageIndex: 1, sourceStageIndex: 0, label: 'Brief já definido', detail: 'Use o brief atual e comece pela organização das referências.', requiresPath: false },
  { id: 'concept', startStageIndex: 2, sourceStageIndex: 1, label: 'Conceito, vistas ou poses 2D existentes', detail: 'Pule direção e conceito; crie/ajuste o modelo 3D a partir do material existente.', requiresPath: false },
  { id: 'model', startStageIndex: 3, sourceStageIndex: 2, label: 'Modelo 3D existente', detail: 'Pule conceito e modelagem; continue no rig/animação ou movimento do item.', requiresPath: true },
  { id: 'rigged', startStageIndex: 4, sourceStageIndex: 3, label: 'Modelo rigado e animações existentes', detail: 'Pule as etapas anteriores e vá direto ao render do spritesheet.', requiresPath: true },
];

function entryOptionFor(asset) {
  const option = ENTRY_OPTIONS.find((candidate) => candidate.id === asset?.entryPointId)
    || ENTRY_OPTIONS.find((candidate) => candidate.startStageIndex === asset?.startStageIndex)
    || ENTRY_OPTIONS[0];
  if (asset?.type === 'item' && option.id === 'rigged') {
    const movementWasSkipped = asset.stageStatus?.[3]?.status === 'skipped';
    return {
      ...option,
      label: movementWasSkipped ? 'Modelo 3D existente · movimento pulado' : 'Movimento / variação existente',
      detail: movementWasSkipped
        ? 'A etapa opcional de movimento foi pulada; renderize o spritesheet diretamente a partir do modelo 3D e dos demais insumos disponíveis.'
        : 'Use o arquivo de movimento ou variação existente para renderizar o spritesheet; essa etapa é opcional para itens.',
    };
  }
  return option;
}

function compressReferenceImage(file) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(sourceUrl);
      const maxSize = 1000;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Canvas unavailable'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/webp', 0.72);
      if (data.length > 1_200_000) {
        const reduced = document.createElement('canvas');
        reduced.width = Math.max(1, Math.round(canvas.width * 0.7));
        reduced.height = Math.max(1, Math.round(canvas.height * 0.7));
        reduced.getContext('2d')?.drawImage(canvas, 0, 0, reduced.width, reduced.height);
        data = reduced.toDataURL('image/webp', 0.62);
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('Could not read image'));
    };
    image.src = sourceUrl;
  });
}

async function readWorkspaceAssets() {
  if (window.liaForge?.readWorkspaceAssets) return window.liaForge.readWorkspaceAssets();
  const response = await fetch('/api/spriteforge/assets', { cache: 'no-store' });
  if (!response.ok) throw new Error('Workspace store unavailable');
  return response.json();
}

async function writeWorkspaceAssets(assets) {
  if (window.liaForge?.writeWorkspaceAssets) return window.liaForge.writeWorkspaceAssets(assets);
  const response = await fetch('/api/spriteforge/assets', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets }),
  });
  if (!response.ok) throw new Error('Workspace store unavailable');
  return response.json();
}

async function readComfyUiStatus() {
  if (window.liaForge?.getComfyUiStatus) return window.liaForge.getComfyUiStatus();
  const response = await fetch('/api/lia-forge/comfyui/status', { cache: 'no-store' });
  if (!response.ok) throw new Error('ComfyUI status unavailable');
  return response.json();
}

async function readComfyUiWorkflows() {
  if (window.liaForge?.listComfyUiWorkflows) return window.liaForge.listComfyUiWorkflows();
  const response = await fetch('/api/lia-forge/comfyui/workflows', { cache: 'no-store' });
  if (!response.ok) throw new Error('ComfyUI workflow list unavailable');
  return response.json();
}

async function readComfyUiWorkflow(id) {
  if (window.liaForge?.readComfyUiWorkflow) return window.liaForge.readComfyUiWorkflow(id);
  const response = await fetch(`/api/lia-forge/comfyui/workflows/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('ComfyUI workflow unavailable');
  return response.json();
}

function collectWorkspaceActivities(assets) {
  const activities = [];
  for (const asset of assets) {
    const stages = stageListFor(asset.type);
    for (const [index, stageState] of (asset.stageStatus || []).entries()) {
      if (stageState?.status !== 'in_progress') continue;
      activities.push({
        kind: 'external',
        label: `${asset.name} · ${stages[index]?.title || `Etapa ${index + 1}`}`,
        detail: stageState.note || 'Status registrado por um agente no workspace',
        progress: Number.isFinite(stageState.progress) ? stageState.progress : null,
      });
    }
  }
  return activities;
}

function formatVram(bytes) {
  return Number.isFinite(bytes) && bytes > 0 ? `${(bytes / (1024 ** 3)).toFixed(1)} GB` : '—';
}

function resetUnverifiedDemoCompletion(asset) {
  if (!Array.isArray(asset?.stageStatus) && asset?.completed?.some(Boolean)) {
    return { ...asset, completed: asset.completed.map(() => false) };
  }
  return asset;
}

function loadAssets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(resetUnverifiedDemoCompletion);
    }
  } catch {
    // A corrupted or full local storage should never prevent the studio from opening.
  }
  return SEED_ASSETS;
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'new-asset';
}

function stageListFor(type) {
  return type === 'item' ? ITEM_STAGES : CHARACTER_STAGES;
}

function firstPending(completed = [], startAt = 0, stageStatus = []) {
  const startIndex = Math.max(0, Math.min(completed.length, Number.isInteger(startAt) ? startAt : 0));
  for (let index = startIndex; index < completed.length; index += 1) {
    if (!completed[index] && stageStatus[index]?.status !== 'skipped') return index;
  }
  return completed.length;
}

function requiredStageCount(asset) {
  const stages = stageListFor(asset.type);
  const startAt = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const optionalSkipped = stages.reduce((count, stage, index) => (
    count + (index >= startAt && stage.optional && asset.stageStatus?.[index]?.status === 'skipped' ? 1 : 0)
  ), 0);
  return Math.max(1, stages.length - startAt - optionalSkipped);
}

function statusLabel(asset) {
  const progress = asset?.completed?.slice(asset?.startStageIndex || 0).filter(Boolean).length || 0;
  const required = requiredStageCount(asset);
  if (progress >= required) return 'Pronto';
  if (progress === 0 && (asset?.startStageIndex || 0) > 0) {
    return asset.existingInputs?.length || asset.referenceName || asset.references?.length ? 'Entrada existente' : 'Ponto de entrada pendente';
  }
  if (progress === 0) return 'Rascunho';
  return 'Em produção';
}

function makeAgentPrompt(asset, agent, outputPath, animations) {
  const isCharacter = asset.type === 'character';
  const stages = stageListFor(asset.type);
  const startAt = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const animationList = animations.length ? animations.join(', ') : 'nenhuma solicitada';
  const referenceFiles = (asset.references || []).map((reference) => reference.path).filter(Boolean);
  const referenceDescription = referenceFiles.length
    ? referenceFiles.map((file) => `Arquivo local no projeto: ${file}`).join('\n')
    : asset.referenceName
      ? `Arquivo: ${outputPath}/references/${asset.referenceName}. Baixe a imagem anexada no painel e disponibilize-a nesse caminho antes da execução; não presuma acesso ao storage do browser.`
      : 'Nenhum arquivo de referência anexado. Use apenas o brief e o prompt visual.';
  const phaseDescriptions = isCharacter
    ? [
        'Revise o briefing e estabeleça design, silhueta, materiais e regras de consistência.',
        'Produza ou organize vistas ortográficas consistentes (frente, 3/4, perfil e costas).',
        'Construa/ajuste o modelo 3D game-ready e valide proporções, escala e orientação.',
        'Crie ou valide rig humanoide; retargete/anime os clips solicitados.',
        'Renderize os clips em câmera ortográfica fixa, pivô nos pés, alpha e tamanho uniforme; gere atlas e metadados.',
      ]
    : [
        'Revise função, silhueta, materiais e ponto de pivô/encaixe.',
        'Produza ou organize vistas ortográficas consistentes do item.',
        'Construa/ajuste o modelo 3D game-ready mantendo silhueta e pivô.',
        'Opcional: crie rotação, brilho, recoil ou movimentos pedidos; nunca aplique rig humanoide ao item.',
        'Renderize em câmera/escala fixas, alpha e pivô consistente; gere atlas e metadados.',
      ];
  const inputLines = (asset.existingInputs || []).length
    ? asset.existingInputs.map((input) => `- Etapa ${input.stageIndex + 1} · ${stages[input.stageIndex]?.title || 'artefato existente'}: \`${input.path}\``).join('\n')
    : '- Nenhum caminho de arquivo existente informado.';
  const workflowLines = stages.map((stage, index) => {
    const state = index < startAt ? 'FORNECIDA/IGNORADA — não refazer' : 'EXECUTAR';
    return `${index + 1}. ${stage.title} (${state}) — ${stage.output}\n   ${phaseDescriptions[index]}`;
  }).join('\n');
  const requiredOutputs = stages.slice(startAt).map((stage) => `- ${outputPath}/${stage.output} — ${stage.title}${asset.type === 'item' && stage.id === 'motion' ? ' (opcional)' : ''}`).join('\n');

  return `# Tarefa de produção de asset — ${asset.name}\n\nVocê é o agente orquestrador do projeto ${PROJECT_NAME}. Continue do ponto de entrada indicado e transforme o asset em uma saída 2D utilizável no jogo. Delegue etapas delimitadas a subagents quando disponíveis.\n\n## Alvo\n- Tipo: ${isCharacter ? 'personagem 3D rigável' : `item / ${asset.itemKind || 'prop'}`}\n- Nome: ${asset.name}\n- Destino: \`${outputPath}\`\n- Resolução final: ${asset.target || '48 × 48 px'} por frame\n- Agente chamador: ${agent === 'claude' ? 'Claude Code' : agent === 'codex' ? 'Codex' : agent === 'opencode' ? 'OpenCode (com provider local configurado pelo usuário)' : 'qualquer agente local compatível'}\n\n## Brief e prompt visual\n${asset.brief || asset.prompt}\n\n${asset.prompt}\n\n## Referências de imagem\n${referenceDescription}\n\n## Artefatos já existentes\n${inputLines}\n\n## Ponto de entrada\nComece na etapa ${startAt + 1} (${stages[startAt].title}). As etapas anteriores não fazem parte desta tarefa: não as refaça nem marque como concluídas. Inspecione os caminhos fornecidos, confirme que existem e são legíveis; se algum insumo estiver ausente/incompatível, pare e relate o bloqueio antes de gerar.\n\n## Animações / movimentos pedidos\n${animationList}\n\n## Workflow\n${workflowLines}\n\n## Saídas desta execução\n${requiredOutputs}\n- ${outputPath}/README.md — ferramentas, versões, comandos, validações e pendências.\n\n## Regras\n1. Não invente resultados de ferramentas nem simule progresso. Só reporte arquivos que foram realmente criados e verificados.\n2. Preserve design, cores, proporções, pivô e parâmetros da câmera; use câmera ortográfica fixa e alpha transparente quando aplicável.\n3. Valide visualmente o atlas: ordem dos frames, padding, alpha, pivô, escala e nomes de animação.\n4. Mantenha fontes editáveis. Não sobrescreva arquivos existentes sem autorização.\n5. Registre outputs relativos à raiz do projeto; uma etapa só pode ser concluída após os outputs existirem e serem verificados.\n6. Ao final, resuma arquivos reais, comandos executados, limitações e próximos passos.\n`;
}

function taskSpecFor(asset, agent, outputPath, animations) {
  const stages = stageListFor(asset.type);
  const startAt = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  return {
    schemaVersion: '2.0',
    project: PROJECT_NAME,
    createdAt: new Date().toISOString(),
    agent,
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      subtype: asset.itemKind || null,
      brief: asset.brief,
      visualPrompt: asset.prompt,
      referenceFile: asset.references?.[0]?.path || asset.referenceName || null,
      targetFrameSize: asset.target || '48 × 48 px',
      outputPath,
      animations,
      workflowId: '3d_to_2d',
      startStageIndex: startAt,
      existingInputs: asset.existingInputs || [],
    },
    workflow: stages.map((stage, index) => ({
      id: stage.id,
      order: index + 1,
      name: stage.title,
      output: stage.output,
      optional: asset.type === 'item' && index === 3,
      execution: index < startAt ? 'skip' : 'run',
    })),
    constraints: [
      'Consistência de silhueta, paleta, escala e câmera entre vistas e frames.',
      'Câmera ortográfica fixa; PNG com alpha no export final.',
      'Entregar fontes editáveis e relatar honestamente ferramentas indisponíveis.',
      asset.type === 'item' ? 'Usar pivô de encaixe; não aplicar rig humanoide.' : 'Rig humanoide e clips com nomes estáveis.',
      'Etapas anteriores ao ponto de entrada são fornecidas/ignoradas, não concluídas por esta tarefa.',
      'Não simular geração nem marcar etapas concluídas sem outputs reais verificados.',
    ],
  };
}

function assetForNextHandoff(asset) {
  const stages = stageListFor(asset.type);
  const originalStart = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const completed = stages.map((_, index) => asset.stageStatus?.[index]?.status === 'completed');
  const nextStage = Math.min(firstPending(completed, originalStart, asset.stageStatus || []), stages.length - 1);
  const existingInputs = [...(asset.existingInputs || [])];
  for (let index = originalStart; index < nextStage; index += 1) {
    if (asset.stageStatus?.[index]?.status !== 'completed') continue;
    for (const output of asset.stageStatus[index].outputs || []) {
      if (!existingInputs.some((input) => input.path === output && input.stageIndex === index)) {
        existingInputs.push({ path: output, stageIndex: index });
      }
    }
  }
  const entryPointId = ENTRY_OPTIONS.find((option) => option.startStageIndex === nextStage)?.id || ENTRY_OPTIONS[0].id;
  return { ...asset, startStageIndex: nextStage, entryPointId, existingInputs };
}

function App() {
  const [assets, setAssets] = useState(loadAssets);
  const [kind, setKind] = useState('character');
  const [selectedId, setSelectedId] = useState('mira');
  const [activeStage, setActiveStage] = useState(0);
  const [page, setPage] = useState('studio');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [comfyStatus, setComfyStatus] = useState(null);
  const [comfyWorkflows, setComfyWorkflows] = useState([]);
  const [managedProcesses, setManagedProcesses] = useState([]);
  const [comfyLoading, setComfyLoading] = useState(false);
  const [externalToolStatus, setExternalToolStatus] = useState({});
  const [workflowRun, setWorkflowRun] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assetStoreReady, setAssetStoreReady] = useState(false);
  const [assetStoreAvailable, setAssetStoreAvailable] = useState(false);
  const [assetStoreWriteFailed, setAssetStoreWriteFailed] = useState(false);
  const toastTimer = useRef(null);
  const storeSnapshot = useRef('');
  const localStoreDirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function hydrateWorkspace() {
      try {
        const payload = await readWorkspaceAssets();
        const diskAssets = Array.isArray(payload.assets) && payload.assets.length ? payload.assets.map(resetUnverifiedDemoCompletion) : null;
        const hasPendingLocalChanges = localStorage.getItem(PENDING_STORAGE_KEY) === 'true';
        if (cancelled) return;
        if (diskAssets && !hasPendingLocalChanges) {
          storeSnapshot.current = JSON.stringify(diskAssets);
          localStoreDirty.current = false;
          setAssets(diskAssets);
          const firstAsset = diskAssets[0];
          if (firstAsset) {
            setSelectedId(firstAsset.id);
            setKind(firstAsset.type);
          }
        } else {
          // Preserve unsynced browser edits and merge in assets added externally since the last save.
          const initialAssets = diskAssets
            ? [...assets, ...diskAssets.filter((diskAsset) => !assets.some((localAsset) => localAsset.id === diskAsset.id))]
            : assets;
          setAssets(initialAssets);
          const initialSnapshot = JSON.stringify(initialAssets);
          localStoreDirty.current = true;
          try { localStorage.setItem(PENDING_STORAGE_KEY, 'true'); } catch { /* Browser storage is optional. */ }
          await writeWorkspaceAssets(initialAssets);
          storeSnapshot.current = initialSnapshot;
          localStoreDirty.current = false;
          try { localStorage.removeItem(PENDING_STORAGE_KEY); } catch { /* Browser storage is optional. */ }
        }
        if (!cancelled) {
          setAssetStoreAvailable(true);
          setAssetStoreReady(true);
        }
      } catch {
        if (!cancelled) {
          setAssetStoreAvailable(false);
          setAssetStoreReady(true);
        }
      }
    }
    hydrateWorkspace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!window.liaForge?.getExternalToolStatus) return undefined;
    window.liaForge.getExternalToolStatus()
      .then((status) => { if (!cancelled) setExternalToolStatus(status || {}); })
      .catch(() => { if (!cancelled) setExternalToolStatus({}); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!window.liaForge?.onWorkflowEvent) return undefined;
    return window.liaForge.onWorkflowEvent((event) => {
      if (event?.run) setWorkflowRun(event.run);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    } catch {
      // Keep the current session working if browser storage is unavailable.
    }
    if (!assetStoreReady || !assetStoreAvailable) return undefined;
    const snapshot = JSON.stringify(assets);
    if (snapshot === storeSnapshot.current) return undefined;
    localStoreDirty.current = true;
    try { localStorage.setItem(PENDING_STORAGE_KEY, 'true'); } catch { /* Browser storage is optional. */ }
    const timer = window.setTimeout(async () => {
      try {
        await writeWorkspaceAssets(assets);
        storeSnapshot.current = snapshot;
        localStoreDirty.current = false;
        try { localStorage.removeItem(PENDING_STORAGE_KEY); } catch { /* Browser storage is optional. */ }
        setAssetStoreWriteFailed(false);
      } catch {
        setAssetStoreWriteFailed(true);
        // The browser copy remains available; a later edit or reload can retry disk sync.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [assets, assetStoreReady, assetStoreAvailable]);

  useEffect(() => {
    if (!assetStoreReady || !assetStoreAvailable) return undefined;
    async function refreshFromMcp() {
      if (localStoreDirty.current) return;
      try {
        const payload = await readWorkspaceAssets();
        if (!Array.isArray(payload.assets) || payload.assets.length === 0) return;
        const synchronizedAssets = payload.assets.map(resetUnverifiedDemoCompletion);
        const snapshot = JSON.stringify(synchronizedAssets);
        if (snapshot === storeSnapshot.current || localStoreDirty.current) return;
        storeSnapshot.current = snapshot;
        setAssets(synchronizedAssets);
        if (!synchronizedAssets.some((asset) => asset.id === selectedId)) {
          setSelectedId(synchronizedAssets[0].id);
          setKind(synchronizedAssets[0].type);
        }
      } catch {
        // Polling is best-effort; local edits are never blocked by an MCP disconnect.
      }
    }
    const timer = window.setInterval(refreshFromMcp, 2500);
    return () => window.clearInterval(timer);
  }, [assetStoreReady, assetStoreAvailable, selectedId]);

  const refreshComfyUi = useCallback(async () => {
    setComfyLoading(true);
    const [statusResult, workflowsResult, processesResult] = await Promise.allSettled([
      readComfyUiStatus(),
      readComfyUiWorkflows(),
      window.liaForge?.getManagedProcesses?.() || Promise.resolve([]),
    ]);
    if (statusResult.status === 'fulfilled') setComfyStatus(statusResult.value);
    else setComfyStatus({ connected: false, endpoint: 'http://127.0.0.1:8188', queue: { running: 0, pending: 0 }, models: null, devices: [], error: 'Não foi possível consultar o ComfyUI.' });
    if (workflowsResult.status === 'fulfilled') setComfyWorkflows(workflowsResult.value);
    else setComfyWorkflows([]);
    if (processesResult.status === 'fulfilled') setManagedProcesses(Array.isArray(processesResult.value) ? processesResult.value : []);
    else setManagedProcesses([]);
    setComfyLoading(false);
  }, []);

  useEffect(() => {
    void refreshComfyUi();
    const timer = window.setInterval(() => void refreshComfyUi(), 15000);
    return () => window.clearInterval(timer);
  }, [refreshComfyUi]);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
  }, []);

  const selectedAsset = assets.find((asset) => asset.id === selectedId) || assets.find((asset) => asset.type === kind) || assets[0];
  const visibleAssets = useMemo(() => assets.filter((asset) => asset.type === kind), [assets, kind]);
  const filteredAssets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleAssets;
    return visibleAssets.filter((asset) => `${asset.name} ${asset.subtitle} ${asset.role}`.toLowerCase().includes(term));
  }, [visibleAssets, searchTerm]);
  const currentStages = stageListFor(selectedAsset?.type || kind);
  const workspaceActivities = useMemo(() => collectWorkspaceActivities(assets), [assets]);
  useEffect(() => {
    window.liaForge?.reportActivities?.(workspaceActivities);
  }, [workspaceActivities]);
  const completedCount = assets.reduce((total, asset) => total + ((asset.completed || []).slice(asset.startStageIndex || 0).filter(Boolean).length || 0), 0);
  const completedStages = assets.reduce((total, asset) => total + requiredStageCount(asset), 0);

  function notify(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3300);
  }

  async function downloadComfyWorkflow(workflowId) {
    try {
      const result = await readComfyUiWorkflow(workflowId);
      downloadText(result.filename, `${JSON.stringify(result.workflow, null, 2)}\n`, 'application/json');
      notify('Template baixado. Selecione um checkpoint compatível antes de executar.');
    } catch (error) {
      notify(`Não foi possível carregar o template: ${error.message || 'erro desconhecido'}`);
    }
  }

  function chooseKind(nextKind) {
    setKind(nextKind);
    const first = assets.find((asset) => asset.type === nextKind);
    if (first) setSelectedId(first.id);
    setActiveStage(first ? firstPending(first.completed || [], first.startStageIndex || 0, first.stageStatus || []) : 0);
    setPage('studio');
    setSearchTerm('');
  }

  function selectAsset(asset) {
    setSelectedId(asset.id);
    setActiveStage(Math.min(firstPending(asset.completed || [], asset.startStageIndex || 0, asset.stageStatus || []), stageListFor(asset.type).length - 1));
  }

  function saveAsset(nextAsset) {
    setAssets((current) => {
      const exists = current.some((asset) => asset.id === nextAsset.id);
      return exists
        ? current.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset))
        : [nextAsset, ...current];
    });
    setKind(nextAsset.type);
    setSelectedId(nextAsset.id);
    setActiveStage(Math.min(firstPending(nextAsset.completed || [], nextAsset.startStageIndex || 0, nextAsset.stageStatus || []), stageListFor(nextAsset.type).length - 1));
    setPage('studio');
    setModalOpen(false);
    setEditingAsset(null);
    notify(editingAsset ? 'Brief atualizado neste workspace local.' : 'Asset criado. Você pode seguir manualmente; handoff para um agente é opcional.');
  }

  function addAnimationToSelected(name) {
    if (!selectedAsset || selectedAsset.animations?.includes(name)) return;
    setAssets((current) => current.map((asset) => asset.id === selectedAsset.id
      ? { ...asset, animations: [...(asset.animations || []), name] }
      : asset));
    notify(`“${name}” foi adicionado à lista de pedidos.`);
  }

  async function completeManualStage(asset, stageIndex) {
    if (!window.liaForge?.completeAssetStageManually) {
      notify('O registro manual de arquivos está disponível na janela desktop da Lia Forge.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      const result = await window.liaForge.completeAssetStageManually({ assetId: asset.id, stageIndex });
      if (result.cancelled) return;
      const updatedAsset = { ...asset, completed: result.completed, stageStatus: result.stageStatus };
      setAssets((current) => current.map((item) => item.id === asset.id ? updatedAsset : item));
      setActiveStage(Math.min(firstPending(result.completed, asset.startStageIndex || 0, result.stageStatus), stageListFor(asset.type).length - 1));
      notify(`${result.stage}: arquivos reais conferidos e registrados.`);
    } catch (error) {
      notify(`Não foi possível registrar a etapa: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function skipOptionalStage(asset, stageIndex) {
    if (!window.liaForge?.skipOptionalAssetStage) return;
    try {
      await writeWorkspaceAssets(assets);
      const result = await window.liaForge.skipOptionalAssetStage({ assetId: asset.id, stageIndex });
      if (result.cancelled) return;
      const updatedAsset = { ...asset, completed: result.completed, stageStatus: result.stageStatus };
      setAssets((current) => current.map((item) => item.id === asset.id ? updatedAsset : item));
      setActiveStage(Math.min(firstPending(result.completed, asset.startStageIndex || 0, result.stageStatus), stageListFor(asset.type).length - 1));
      notify(`${result.stage} foi pulada como etapa opcional; nenhum arquivo foi inventado.`);
    } catch (error) {
      notify(`Não foi possível pular a etapa: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function openManualStageFolder(asset, stageIndex) {
    if (!window.liaForge?.openAssetStageFolder) {
      notify('Abertura da pasta está disponível na janela desktop da Lia Forge.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      await window.liaForge.openAssetStageFolder({ assetId: asset.id, stageIndex });
    } catch (error) {
      notify(`Não foi possível abrir a pasta: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function openToolInterface(asset, stageIndex, tool) {
    if (!window.liaForge?.openExternalTool) {
      notify('A abertura direta de ferramentas está disponível na janela desktop da Lia Forge.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      if (tool === 'comfyui') {
        const result = await window.liaForge.openComfyUiInterface({ assetId: asset.id, stageIndex });
        notify(`Interface do ComfyUI aberta. Salve seus arquivos em ${result.folder}.`);
      } else {
        const result = await window.liaForge.openExternalTool({ assetId: asset.id, stageIndex, tool });
        notify(`${result.label} aberto na pasta desta etapa. Use a interface do aplicativo e salve seus arquivos nela.`);
      }
    } catch (error) {
      notify(`Não foi possível abrir a ferramenta: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function chooseExternalApplication(asset, stageIndex) {
    if (!window.liaForge?.chooseAndOpenExternalApplication) {
      notify('A escolha de aplicativos externos está disponível na janela desktop da Lia Forge.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      const result = await window.liaForge.chooseAndOpenExternalApplication({ assetId: asset.id, stageIndex });
      if (!result.cancelled) notify(`${result.label} aberto na pasta desta etapa. Salve os arquivos nela e depois verifique os outputs.`);
    } catch (error) {
      notify(`Não foi possível abrir o aplicativo: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function generateSpritesheetAutomatically(asset) {
    if (!window.liaForge?.renderSpritesheetFromExistingModel) {
      notify('A execução automática do Blender está disponível na janela desktop da Lia Forge.');
      return;
    }
    if (workflowRun?.status === 'running') {
      notify('Já existe uma execução em andamento. Aguarde a etapa terminar antes de iniciar outra.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      const result = await window.liaForge.renderSpritesheetFromExistingModel({ assetId: asset.id });
      const updatedAsset = { ...asset, completed: result.completed, stageStatus: result.stageStatus };
      setAssets((current) => current.map((item) => item.id === asset.id ? updatedAsset : item));
      setWorkflowRun(result.run || null);
      notify('Spritesheet e metadados reais foram renderizados pelo Blender. Confira a prévia e os arquivos exportados.');
    } catch (error) {
      if (error.run) setWorkflowRun(error.run);
      notify(`A renderização automática foi bloqueada ou falhou: ${error.message || 'erro desconhecido'}`);
    }
  }

  async function generateConceptAutomatically(asset, checkpoint) {
    if (!window.liaForge?.generateComfyUiConcept) {
      notify('A geração de conceito pelo ComfyUI está disponível na janela desktop da Lia Forge.');
      return;
    }
    if (workflowRun?.status === 'running') {
      notify('Já existe uma execução em andamento. Aguarde a etapa terminar antes de iniciar outra.');
      return;
    }
    try {
      await writeWorkspaceAssets(assets);
      const result = await window.liaForge.generateComfyUiConcept({ assetId: asset.id, checkpoint });
      const updatedAsset = { ...asset, completed: result.completed, stageStatus: result.stageStatus };
      setAssets((current) => current.map((item) => item.id === asset.id ? updatedAsset : item));
      setWorkflowRun(result.run || null);
      notify(`ComfyUI salvou e validou ${result.generatedOutputs?.length || 1} concept PNG(s). Revise a imagem; ela ainda não é um modelo 3D.`);
    } catch (error) {
      if (error.run) setWorkflowRun(error.run);
      notify(`A geração de conceito foi bloqueada ou falhou: ${error.message || 'erro desconhecido'}`);
    }
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  function openCreateModal() {
    setEditingAsset(null);
    setModalOpen(true);
  }

  function openEditModal() {
    setEditingAsset(selectedAsset);
    setModalOpen(true);
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        kind={kind}
        characterCount={assets.filter((asset) => asset.type === 'character').length}
        itemCount={assets.filter((asset) => asset.type === 'item').length}
        activityCount={workspaceActivities.length + managedProcesses.length + (comfyStatus?.connected ? (comfyStatus.queue?.running || 0) + (comfyStatus.queue?.pending || 0) : 0)}
        onNavigate={navigate}
        onChooseKind={chooseKind}
      />
      <div className="main-shell">
        <TopBar storageMode={!assetStoreReady ? 'syncing' : assetStoreWriteFailed ? 'error' : assetStoreAvailable ? 'workspace' : 'browser'} onMenu={() => setMobileMenuOpen((value) => !value)} onHelp={() => notify('Agentes são opcionais. Trabalhe manualmente e registre arquivos reais, ou use o handoff para delegar; a Lia Forge não gera assets sozinha.')} />
        {mobileMenuOpen && (
          <div className="mobile-menu-panel">
            <button onClick={() => navigate('studio')}><Grid2X2 size={17} /> Asset studio</button>
            <button onClick={() => chooseKind('character')}><Sparkles size={17} /> Personagens</button>
            <button onClick={() => chooseKind('item')}><Package size={17} /> Itens & props</button>
            <button onClick={() => navigate('handoff')}><Bot size={17} /> Agent handoff</button>
            <button onClick={() => navigate('exports')}><Layers3 size={17} /> Exports</button>
            <button onClick={() => navigate('activity')}><Activity size={17} /> Atividade & ComfyUI</button>
          </div>
        )}
        {page === 'studio' && selectedAsset && (
          <StudioPage
            assets={assets}
            visibleAssets={filteredAssets}
            kind={kind}
            selectedAsset={selectedAsset}
            activeStage={activeStage}
            currentStages={currentStages}
            searchTerm={searchTerm}
            completedCount={completedCount}
            completedStages={completedStages}
            onSearch={setSearchTerm}
            onSelectAsset={selectAsset}
            onSelectStage={setActiveStage}
            onChooseKind={chooseKind}
            onCreate={openCreateModal}
            onEdit={openEditModal}
            onHandoff={() => navigate('handoff')}
            onAddAnimation={addAnimationToSelected}
            onManualComplete={completeManualStage}
            onSkipOptional={skipOptionalStage}
            onOpenStageFolder={openManualStageFolder}
            onOpenTool={openToolInterface}
            onChooseExternalApplication={chooseExternalApplication}
            onGenerateSpritesheet={generateSpritesheetAutomatically}
            onGenerateConcept={generateConceptAutomatically}
            workflowRun={workflowRun}
            externalToolStatus={externalToolStatus}
            comfyUiConnected={Boolean(comfyStatus?.connected)}
            comfyCheckpoints={Array.isArray(comfyStatus?.models?.checkpoints) ? comfyStatus.models.checkpoints : []}
            manualModeAvailable={Boolean(window.liaForge?.completeAssetStageManually)}
            onNotify={notify}
          />
        )}
        {page === 'handoff' && selectedAsset && (
          <HandoffPage
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={selectAsset}
            onGoToStudio={() => navigate('studio')}
            onNotify={notify}
          />
        )}
        {page === 'exports' && <ExportsPage assets={assets} onBuildTask={() => navigate('handoff')} onOpenAssetFolder={(asset) => openManualStageFolder(asset, 4)} onNotify={notify} />}
        {page === 'activity' && (
          <ActivityPage
            activities={workspaceActivities}
            managedProcesses={managedProcesses}
            comfyStatus={comfyStatus}
            workflows={comfyWorkflows}
            loading={comfyLoading}
            onRefresh={refreshComfyUi}
            onDownloadWorkflow={downloadComfyWorkflow}
            onNotify={notify}
          />
        )}
      </div>
      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Fechar navegação" onClick={() => setMobileMenuOpen(false)} />}
      {toast && <Toast message={toast} />}
      {modalOpen && (
        <NewAssetModal
          initialAsset={editingAsset}
          defaultType={kind}
          storageAvailable={assetStoreAvailable && !assetStoreWriteFailed}
          onClose={() => { setModalOpen(false); setEditingAsset(null); }}
          onSave={saveAsset}
        />
      )}
    </div>
  );
}

function Sidebar({ page, kind, characterCount, itemCount, activityCount, onNavigate, onChooseKind }) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="brand-wordmark"><strong>LIA<span> FORGE</span></strong><small>LOCAL GAME ASSET STUDIO</small></div>
      </div>

      <button className="project-switcher" onClick={() => onNavigate('studio')}>
        <div className="project-emblem">HV</div>
        <div className="project-switch-copy"><span>WORKSPACE</span><strong>Hollow Vale</strong></div>
        <ChevronDown size={15} />
      </button>

      <div className="nav-group-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Navegação principal">
        <button className={`nav-link ${page === 'studio' ? 'is-active' : ''}`} onClick={() => onNavigate('studio')}>
          <Grid2X2 size={17} strokeWidth={1.8} /><span>Asset studio</span><span className="nav-dot" />
        </button>
        <button className={`nav-link sub-link ${page === 'studio' && kind === 'character' ? 'is-current' : ''}`} onClick={() => onChooseKind('character')}>
          <span className="nav-subline" /><span>Personagens</span><span className="nav-count">{String(characterCount).padStart(2, '0')}</span>
        </button>
        <button className={`nav-link sub-link ${page === 'studio' && kind === 'item' ? 'is-current' : ''}`} onClick={() => onChooseKind('item')}>
          <span className="nav-subline" /><span>Itens & props</span><span className="nav-count">{String(itemCount).padStart(2, '0')}</span>
        </button>
        <button className={`nav-link ${page === 'handoff' ? 'is-active' : ''}`} onClick={() => onNavigate('handoff')}>
          <Bot size={17} strokeWidth={1.8} /><span>Agent handoff</span><span className="new-nav-tag">BETA</span>
        </button>
      </nav>

      <div className="nav-group-label nav-group-production">PRODUÇÃO</div>
      <nav className="side-nav">
        <button className={`nav-link ${page === 'exports' ? 'is-active' : ''}`} onClick={() => onNavigate('exports')}>
          <Layers3 size={17} strokeWidth={1.8} /><span>Exports</span><span className="nav-count">—</span>
        </button>
        <button className={`nav-link ${page === 'activity' ? 'is-active' : ''}`} onClick={() => onNavigate('activity')}>
          <Activity size={17} strokeWidth={1.8} /><span>Atividade & ComfyUI</span>{activityCount > 0 ? <span className="nav-count activity-count">{activityCount}</span> : null}
        </button>
        <button className="nav-link" onClick={() => onNavigate('handoff')}>
          <Workflow size={17} strokeWidth={1.8} /><span>Fluxo de trabalho</span><ChevronRight className="nav-trailing" size={14} />
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="connector-card">
          <div className="connector-card-top"><span className="connector-pulse" /><span>AGENTE · OPCIONAL</span><span className="connector-count">MANUAL</span></div>
          <strong>Sem agente? Tudo bem.</strong>
          <p>Crie briefs, use suas próprias ferramentas e registre os arquivos reais. Handoff só é necessário para delegar.</p>
          <button onClick={() => onNavigate('handoff')}>Ver opções de handoff <ArrowUpRight size={13} /></button>
        </div>
        <button className="user-profile" onClick={() => onNavigate('handoff')}>
          <div className="user-avatar">L</div>
          <div><strong>Workspace local</strong><span>Pack de ferramentas · Lia Forge</span></div>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}

function TopBar({ onMenu, onHelp, storageMode }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu-button" aria-label="Abrir menu" onClick={onMenu}><Menu size={18} /></button>
        <div className="breadcrumbs"><span>LIA FORGE</span><ChevronRight size={13} /><strong>Workspace local</strong></div>
      </div>
      <div className="topbar-right">
        <div className="local-mode"><span className="status-led" /> {storageMode === 'workspace' ? 'LOCAL WORKSPACE' : storageMode === 'syncing' ? 'SYNCING' : storageMode === 'error' ? 'SYNC ERROR' : 'LOCAL DEMO'}</div>
        <button className="icon-button help-button" aria-label="Ajuda" onClick={onHelp}><CircleHelp size={17} /></button>
        <button className="icon-button notification-button" aria-label="Notificações" onClick={onHelp}><Bell size={17} /><span /></button>
        <div className="top-avatar">L</div>
      </div>
    </header>
  );
}

function StudioPage({
  assets,
  visibleAssets,
  kind,
  selectedAsset,
  activeStage,
  currentStages,
  searchTerm,
  completedCount,
  completedStages,
  onSearch,
  onSelectAsset,
  onSelectStage,
  onChooseKind,
  onCreate,
  onEdit,
  onHandoff,
  onAddAnimation,
  onManualComplete,
  onSkipOptional,
  onOpenStageFolder,
  onOpenTool,
  onChooseExternalApplication,
  onGenerateSpritesheet,
  onGenerateConcept,
  workflowRun,
  externalToolStatus,
  comfyUiConnected,
  comfyCheckpoints,
  manualModeAvailable,
  onNotify,
}) {
  const progressTotal = Math.round((completedCount / Math.max(completedStages, 1)) * 100);
  const inProduction = assets.filter((asset) => {
    const count = (asset.completed || []).slice(asset.startStageIndex || 0).filter(Boolean).length;
    return count > 0 && count < requiredStageCount(asset);
  }).length;
  const activeStageData = currentStages[activeStage] || currentStages[0];

  return (
    <main className="page-content studio-page">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span>HOLLOW VALE</span><i>/</i><span>PRODUÇÃO DE ASSETS</span></div>
          <h1>Asset studio</h1>
          <p className="page-subtitle">Da ideia ao spritesheet, com um fluxo previsível para personagens e itens.</p>
        </div>
        <div className="heading-actions">
          <div className="asset-type-switch" role="tablist" aria-label="Tipo de asset">
            <button className={kind === 'character' ? 'selected' : ''} role="tab" aria-selected={kind === 'character'} onClick={() => onChooseKind('character')}><Sparkles size={15} /> Personagens</button>
            <button className={kind === 'item' ? 'selected' : ''} role="tab" aria-selected={kind === 'item'} onClick={() => onChooseKind('item')}><Package size={15} /> Itens</button>
          </div>
          <button className="button button-primary new-asset-button" onClick={onCreate}><Plus size={16} /> Novo {kind === 'character' ? 'personagem' : 'item'}</button>
        </div>
      </div>

      <div className="overview-strip">
        <div className="overview-card overview-project-card">
          <div className="overview-icon project-overview-icon"><Grid2X2 size={16} /></div>
          <div><span>ASSETS NO WORKSPACE</span><strong>{String(assets.length).padStart(2, '0')} <small>total</small></strong></div>
          <span className="overview-divider" />
          <div className="overview-meter"><div className="meter-label"><span>Etapas concluídas</span><strong>{progressTotal}%</strong></div><div className="meter-track"><span style={{ width: `${progressTotal}%` }} /></div></div>
        </div>
        <div className="overview-card">
          <div className="overview-icon production-overview-icon"><Activity size={16} /></div>
          <div><span>EM PRODUÇÃO</span><strong>{String(inProduction).padStart(2, '0')} <small>assets</small></strong></div>
        </div>
        <button className="overview-card overview-agent-card" onClick={onHandoff}>
          <div className="overview-icon agent-overview-icon"><Bot size={16} /></div>
          <div><span>HANDOFF · OPCIONAL</span><strong>Delegar uma etapa <ArrowRight size={14} /></strong></div>
          <ArrowUpRight className="overview-card-arrow" size={15} />
        </button>
      </div>

      <div className="workbench-heading">
        <div className="workbench-heading-left"><div className="workbench-live-dot" /><span>{kind === 'character' ? 'CHARACTER PIPELINE' : 'ITEM PIPELINE'}</span><span className="workbench-separator">/</span><span className="workbench-muted">{visibleAssets.length} assets</span></div>
        <div className="workbench-heading-right"><span className="preview-only-label"><Circle size={7} /> GUIA VISUAL · NÃO É OUTPUT</span><button className="icon-button compact-icon" aria-label="Configurações" onClick={() => onNotify('Configurações do projeto estarão disponíveis na próxima etapa.')}><Settings2 size={15} /></button></div>
      </div>

      <div className="workbench-grid">
        <AssetBrowser
          assets={visibleAssets}
          selectedAsset={selectedAsset}
          searchTerm={searchTerm}
          onSearch={onSearch}
          onSelect={onSelectAsset}
          onCreate={onCreate}
        />
        <div className="middle-column">
          <StageNavigator
            stages={currentStages}
            completed={selectedAsset.completed || []}
            activeStage={activeStage}
            onSelect={onSelectStage}
            asset={selectedAsset}
          />
          <StageWorkspace
            asset={selectedAsset}
            stage={activeStageData}
            stageIndex={activeStage}
            completed={selectedAsset.completed || []}
            onHandoff={onHandoff}
            onManualComplete={onManualComplete}
            onSkipOptional={onSkipOptional}
            onOpenStageFolder={onOpenStageFolder}
            onOpenTool={onOpenTool}
            onChooseExternalApplication={onChooseExternalApplication}
            onGenerateSpritesheet={onGenerateSpritesheet}
            onGenerateConcept={onGenerateConcept}
            workflowRun={workflowRun}
            externalToolStatus={externalToolStatus}
            comfyUiConnected={comfyUiConnected}
            comfyCheckpoints={comfyCheckpoints}
            manualModeAvailable={manualModeAvailable}
            onNotify={onNotify}
          />
        </div>
        <InspectorPanel asset={selectedAsset} stage={activeStageData} onEdit={onEdit} onAddAnimation={onAddAnimation} onNotify={onNotify} />
      </div>
      <div className="page-footer"><span><ShieldCheck size={13} /> Briefs salvos no workspace local.</span><span>Lia Forge <b>·</b> pack local de ferramentas</span></div>
    </main>
  );
}

function AssetBrowser({ assets, selectedAsset, searchTerm, onSearch, onSelect, onCreate }) {
  return (
    <section className="panel asset-browser-panel">
      <div className="panel-heading asset-browser-heading">
        <div><span className="panel-kicker">BIBLIOTECA</span><h2>Seus assets <span>{String(assets.length).padStart(2, '0')}</span></h2></div>
        <button className="mini-icon-button" aria-label="Adicionar asset" onClick={onCreate}><Plus size={16} /></button>
      </div>
      <label className="asset-search"><Search size={14} /><input value={searchTerm} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar asset..." /><kbd>/</kbd></label>
      <div className="asset-list">
        {assets.map((asset) => (
          <button key={asset.id} className={`asset-list-row ${selectedAsset.id === asset.id ? 'is-selected' : ''}`} onClick={() => onSelect(asset)}>
            <AssetThumb asset={asset} />
            <span className="asset-list-copy"><strong>{asset.name}</strong><small>{asset.subtitle}</small><span className="asset-row-status"><i className={statusLabel(asset) === 'Pronto' ? 'done' : ''} />{statusLabel(asset)}</span></span>
            <ChevronRight className="asset-row-chevron" size={14} />
          </button>
        ))}
        {!assets.length && <div className="asset-empty-search"><Search size={18} /><span>Nenhum asset encontrado.</span></div>}
      </div>
      <button className="add-asset-row" onClick={onCreate}><span className="add-asset-icon"><Plus size={15} /></span><span>Criar novo asset</span><span className="add-asset-shortcut">⌘ N</span></button>
      <div className="asset-browser-foot"><span><span className="tiny-green-dot" /> Workspace local</span><button onClick={() => onSearch('')} aria-label="Limpar busca"><MoreHorizontal size={16} /></button></div>
    </section>
  );
}

function AssetThumb({ asset, className = '' }) {
  return (
    <div className={`asset-thumb ${asset.type === 'item' ? 'item-thumb' : ''} ${className}`}>
      <AssetArtwork asset={asset} angle="front" />
      <span className="thumb-badge">{asset.type === 'item' ? <Package size={9} /> : <Sparkles size={9} />}</span>
    </div>
  );
}

function inputsForStage(asset, stageIndex) {
  return (asset.existingInputs || []).filter((input) => input.stageIndex === stageIndex);
}

function hasRegistered3dInput(asset) {
  const paths = [
    ...(asset.existingInputs || []).map((input) => input.path),
    ...(asset.stageStatus?.[3]?.outputs || []),
    ...(asset.stageStatus?.[2]?.outputs || []),
  ];
  return paths.some((file) => typeof file === 'string' && /\.(blend|glb|gltf|fbx|obj|stl)$/i.test(file));
}

function StageNavigator({ stages, completed, activeStage, onSelect, asset }) {
  const startAt = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const first = firstPending(completed, startAt, asset.stageStatus || []);
  const required = requiredStageCount(asset);
  const doneCount = completed.slice(startAt).filter(Boolean).length;
  return (
    <section className="panel stage-navigator-panel">
      <div className="stage-navigator-head"><div><span className="panel-kicker">FLUXO 3D → 2D</span><strong>{required} etapas a partir daqui</strong></div><button className="mini-icon-button" aria-label="Ver detalhes do fluxo"><MoreHorizontal size={16} /></button></div>
      <div className="stage-steps">
        {stages.map((step, index) => {
          const Icon = step.icon;
          const done = Boolean(completed[index]);
          const optionalSkipped = asset.stageStatus?.[index]?.status === 'skipped';
          const provided = inputsForStage(asset, index).length > 0 || (index === 1 && Boolean(asset.referenceName || asset.references?.length));
          const skipped = index < startAt;
          const locked = !skipped && !optionalSkipped && index > first && !done;
          const active = activeStage === index;
          const sublabel = done ? 'Output verificado' : optionalSkipped ? 'Opcional · pulada' : provided ? 'Artefato existente' : skipped ? 'Fora do ponto de entrada' : locked ? 'Na fila' : index === startAt ? 'Ponto de entrada' : active ? 'Em foco' : 'Próxima etapa';
          return (
            <button key={step.id || step.short} className={`stage-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''} ${provided ? 'is-provided' : ''} ${skipped || optionalSkipped ? 'is-skipped' : ''} ${locked ? 'is-locked' : ''}`} onClick={() => onSelect(index)}>
              <span className="stage-step-icon">{done ? <Check size={14} /> : optionalSkipped ? <Circle size={13} /> : <Icon size={15} />}</span>
              <span className="stage-step-copy"><span><b>{String(index + 1).padStart(2, '0')}</b>{step.short}</span><small>{sublabel}</small></span>
              {active && <span className="active-step-indicator" />}
            </button>
          );
        })}
      </div>
      <div className="stage-navigator-foot"><div className="stage-progress-copy"><span>PROGRESSO DE {asset.type === 'character' ? 'PERSONAGEM' : 'ITEM'}</span><b>{doneCount}<i>/</i>{required}</b></div><div className="stage-progress-bar"><span style={{ width: `${(doneCount / required) * 100}%` }} /></div><span className="stage-navigator-footnote">Só arquivos reais conferidos contam como concluídos</span></div>
    </section>
  );
}

function StageWorkspace({ asset, stage, stageIndex, completed, onHandoff, onManualComplete, onSkipOptional, onOpenStageFolder, onOpenTool, onChooseExternalApplication, onGenerateSpritesheet, onGenerateConcept, workflowRun, externalToolStatus, comfyUiConnected, comfyCheckpoints = [], manualModeAvailable, onNotify }) {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  useEffect(() => { setSelectedCheckpoint(''); }, [asset.id]);
  useEffect(() => {
    if (selectedCheckpoint && !comfyCheckpoints.includes(selectedCheckpoint)) setSelectedCheckpoint('');
  }, [comfyCheckpoints, selectedCheckpoint]);
  const startAt = Math.max(0, Math.min(4, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const isDone = Boolean(completed[stageIndex]);
  const stageRunStatus = asset.stageStatus?.[stageIndex]?.status;
  const optionalSkipped = stageRunStatus === 'skipped';
  const isProvided = inputsForStage(asset, stageIndex).length > 0 || (stageIndex === 1 && Boolean(asset.referenceName || asset.references?.length));
  const isSkipped = stageIndex < startAt;
  const first = firstPending(completed, startAt, asset.stageStatus || []);
  const isLocked = !isSkipped && !optionalSkipped && stageIndex > first && !isDone;
  const canChangeStage = !isSkipped && !isLocked;
  const providedInputs = inputsForStage(asset, stageIndex);
  const badge = isDone ? 'Output verificado' : optionalSkipped ? 'Opcional ignorada' : stageRunStatus === 'blocked' ? 'Bloqueado' : stageRunStatus === 'failed' ? 'Falha · revisar' : stageRunStatus === 'cancelled' ? 'Cancelado' : stageRunStatus === 'in_progress' ? 'Em andamento' : isProvided ? 'Entrada existente' : isSkipped ? 'Fora do ponto de entrada' : isLocked ? 'Na fila' : stageIndex === startAt ? 'Ponto de entrada' : 'Pendente';
  const primaryTool = stageIndex === 1 ? 'krita' : stageIndex >= 2 ? 'blender' : null;
  const primaryToolLabel = primaryTool === 'krita' ? 'Krita' : 'Blender';
  const primaryToolStatus = primaryTool ? externalToolStatus?.[primaryTool] : null;
  const activeWorkflowRun = workflowRun?.assetId === asset.id ? workflowRun : null;
  const isAutomatedRenderRunning = activeWorkflowRun?.status === 'running' && activeWorkflowRun.workflowId === 'render-spritesheet-from-existing-3d';
  const isConceptWorkflowRunning = activeWorkflowRun?.status === 'running' && activeWorkflowRun.workflowId?.startsWith(`generate-${asset.type}-concept`);
  const isAnotherWorkflowRunning = workflowRun?.status === 'running' && !isAutomatedRenderRunning && !isConceptWorkflowRunning;
  const hasRequestedAnimations = Array.isArray(asset.animations) && asset.animations.some((animation) => typeof animation === 'string' && animation.trim());
  const canRenderWithBlender = asset.type === 'item' || hasRequestedAnimations;
  const currentWorkflowStep = activeWorkflowRun?.steps?.find((step) => step.status === 'in_progress');

  return (
    <section className="panel stage-workspace-panel">
      <div className="stage-workspace-header">
        <div className="stage-workspace-heading-copy">
          <div className="stage-workspace-overline"><span>ETAPA {String(stageIndex + 1).padStart(2, '0')}</span><span className="overline-slash">/</span><span>{stage.output}</span></div>
          <h2>{stage.title}</h2>
          <p>{stage.description}</p>
        </div>
        <div className="stage-workspace-menu"><span className={`stage-result-badge ${isDone ? 'result-ready' : ''}`}><span />{badge}</span><button className="mini-icon-button" onClick={() => onNotify('O handoff é opcional. Você pode trabalhar manualmente e registrar arquivos reais nesta etapa.')} aria-label="Mais opções"><MoreHorizontal size={17} /></button></div>
      </div>

      <StagePreview asset={asset} stageIndex={stageIndex} isDone={isDone} />

      {providedInputs.length > 0 && <div className="existing-input-callout"><FolderOpen size={13} /><span><strong>Insumo informado:</strong> {providedInputs.map((input) => input.path).join(' · ')}</span></div>}
      {manualModeAvailable && stageIndex > 0 && <div className="stage-tool-access">
        <div className="stage-tool-access-copy"><strong>Abra uma ferramenta e trabalhe na interface dela</strong><small>Sem agente: a Lia Forge abre o aplicativo na pasta desta etapa. Salve os arquivos nela e depois verifique os outputs.</small><small>{!primaryToolStatus ? `Verificando ${primaryToolLabel}…` : primaryToolStatus.installed ? `${primaryToolLabel} detectado.` : `${primaryToolLabel} não detectado; escolha outro aplicativo já instalado.`}</small></div>
        <div className="stage-tool-access-actions">
          <button className="button button-quiet" disabled={!primaryToolStatus} onClick={() => (primaryToolStatus?.installed ? onOpenTool(asset, stageIndex, primaryTool) : onChooseExternalApplication(asset, stageIndex))}>
            <ArrowUpRight size={13} />{!primaryToolStatus ? `Detectando ${primaryToolLabel}…` : primaryToolStatus.installed ? `Abrir ${primaryToolLabel}` : `Escolher editor/aplicativo`}
          </button>
          {stageIndex === 4 && externalToolStatus?.krita?.installed && <button className="button button-quiet" onClick={() => onOpenTool(asset, stageIndex, 'krita')}><ArrowUpRight size={13} />Abrir Krita</button>}
          {comfyUiConnected && <button className="button button-quiet" onClick={() => onOpenTool(asset, stageIndex, 'comfyui')}><ArrowUpRight size={13} />Abrir ComfyUI</button>}
          <button className="button button-quiet" onClick={() => onChooseExternalApplication(asset, stageIndex)}><Plus size={13} />Outro aplicativo</button>
        </div>
      </div>}
      {manualModeAvailable && stageIndex === 1 && comfyUiConnected && <div className="automated-stage-card automated-concept-card">
        <div><strong>Gerar referência visual com ComfyUI</strong><small>Usa o brief deste asset e um checkpoint já instalado. Nada é baixado; a geração só começa após escolher o modelo e clicar. O PNG é uma referência para revisão, não cria 3D nem garante vistas ortográficas.</small>
          {isConceptWorkflowRunning && <span className="automated-stage-progress">{currentWorkflowStep?.note || 'Aguardando o ComfyUI…'}{currentWorkflowStep?.progress > 0 ? ` · ${currentWorkflowStep.progress}%` : ''}</span>}
          {comfyCheckpoints.length === 0 && <span className="automated-stage-hint">Nenhum checkpoint foi listado. Adicione um modelo pelo ComfyUI; a Lia Forge não baixa pesos.</span>}
        </div>
        <div className="automated-concept-actions">
          {comfyCheckpoints.length > 0 && <select aria-label="Checkpoint instalado no ComfyUI" value={selectedCheckpoint} onChange={(event) => setSelectedCheckpoint(event.target.value)} disabled={isConceptWorkflowRunning}>
            <option value="">Selecionar checkpoint instalado…</option>
            {comfyCheckpoints.map((checkpoint) => <option key={checkpoint} value={checkpoint}>{checkpoint}</option>)}
          </select>}
          <button className="button button-primary" disabled={!canChangeStage || isConceptWorkflowRunning || isAnotherWorkflowRunning || !selectedCheckpoint} onClick={() => onGenerateConcept(asset, selectedCheckpoint)}>
            {isConceptWorkflowRunning ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}{isConceptWorkflowRunning ? 'Gerando…' : 'Gerar conceito'}
          </button>
        </div>
      </div>}
      {manualModeAvailable && stageIndex === 4 && externalToolStatus?.blender?.installed && hasRegistered3dInput(asset) && <div className="automated-stage-card">
        <div><strong>Gerar spritesheet automaticamente</strong><small>A Lia Forge executa o Blender em background usando um modelo 3D já registrado, cria PNG + JSON e valida os arquivos. Não cria o modelo a partir do prompt; personagens precisam ter ações de animação compatíveis no rig.</small>
          {asset.type === 'character' && !hasRequestedAnimations && <span className="automated-stage-hint">Informe ao menos um nome de animação e confirme que o modelo contém a ação correspondente.</span>}
          {isAutomatedRenderRunning && <span className="automated-stage-progress">{currentWorkflowStep?.note || 'Renderizando no Blender…'}{currentWorkflowStep?.progress > 0 ? ` · ${currentWorkflowStep.progress}%` : ''}</span>}
        </div>
        <button className="button button-primary" disabled={!canChangeStage || isAutomatedRenderRunning || isAnotherWorkflowRunning || !canRenderWithBlender} onClick={() => onGenerateSpritesheet(asset)}>
          {isAutomatedRenderRunning ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}{isAutomatedRenderRunning ? 'Gerando…' : 'Gerar com Blender'}
        </button>
      </div>}
      <div className="stage-workspace-footer">
        <div className="stage-output-summary"><div className="output-icon"><FileImage size={15} /></div><div><span>SAÍDA ESPERADA</span><strong>{stage.output}</strong></div><span className="output-format-tag">{stageIndex === 2 ? '3D' : stageIndex === 4 ? '2D' : 'ASSET'}</span></div>
        <div className="stage-action-buttons">
          <button className="button button-quiet stage-handoff-button" onClick={onHandoff}><Bot size={14} />Handoff <span>opcional</span></button>
          {manualModeAvailable && <>
            <button className="button button-quiet stage-folder-button" onClick={() => onOpenStageFolder(asset, stageIndex)} aria-label="Abrir pasta da etapa"><FolderOpen size={14} /> Pasta</button>
            <button className="button button-primary stage-manual-button" disabled={!canChangeStage} onClick={() => onManualComplete(asset, stageIndex)}>
              {stageIndex === 0 ? <FileText size={14} /> : <CheckCircle2 size={14} />}
              {stageIndex === 0 ? (isDone ? 'Reexportar brief' : 'Exportar brief.md') : (isDone ? 'Rever arquivos' : 'Verificar arquivos')}
            </button>
            {stage.optional && !isDone && !optionalSkipped && <button className="button button-quiet stage-skip-button" disabled={!canChangeStage} onClick={() => onSkipOptional(asset, stageIndex)}><X size={13} />Pular opcional</button>}
          </>}
        </div>
      </div>
      <div className="stage-demo-note"><ShieldCheck size={12} /><span>{manualModeAvailable ? 'Sem agente: produza nas suas ferramentas e salve na pasta da etapa. A Lia Forge confere arquivos/formato, não a qualidade visual.' : 'Handoff opcional: crie os arquivos nas suas ferramentas; só outputs reais verificados podem concluir a etapa.'}</span></div>
    </section>
  );
}

function StagePreview({ asset, stageIndex, isDone }) {
  if (stageIndex === 0) return <BriefPreview asset={asset} isDone={isDone} />;
  if (stageIndex === 1) return <ReferencePreview asset={asset} isDone={isDone} />;
  if (stageIndex === 2) return <ModelPreview asset={asset} isDone={isDone} />;
  if (stageIndex === 3) return <RigPreview asset={asset} isDone={isDone} />;
  return <SpritePreview asset={asset} isDone={isDone} />;
}

function BriefPreview({ asset, isDone }) {
  const paletteKeys = ['coat', 'cloak', 'accent', 'skin', 'hair'];
  return (
    <div className="brief-preview preview-surface">
      <div className="brief-card-main">
        <div className="brief-card-header"><span>VISUAL IDENTITY · 01</span><span className="brief-card-index">{asset.type === 'character' ? 'CHARACTER' : 'PROP'}</span></div>
        <div className="brief-art-wrap"><AssetArtwork asset={asset} angle="front" /></div>
        <div className="brief-card-info"><div><span>ASSET NAME</span><strong>{asset.name}</strong></div><div><span>FRAME TARGET</span><strong>{asset.target || '48 × 48 px'}</strong></div></div>
      </div>
      <div className="brief-preview-side">
        <div className="style-note-card"><span className="preview-label">DIRECTION OF ART</span><h3>{asset.subtitle}</h3><p>{asset.brief}</p><div className="style-token-row"><span>COZY FANTASY</span><span>GAME-READY</span></div></div>
        <div className="palette-card"><div className="palette-card-head"><span>PALETA</span><span>05 TOKENS</span></div><div className="palette-swatches">{paletteKeys.map((key) => <span title={key} key={key} style={{ background: asset.palette?.[key] }} />)}</div><div className="palette-names"><span>Floresta</span><span>Luz viva</span><span>Couro</span></div></div>
        <div className={`brief-completion-note ${isDone ? 'is-ready' : ''}`}><CheckCircle2 size={14} /><span>{isDone ? 'brief.md exportado e conferido' : 'Brief aguardando revisão e exportação'}</span></div>
      </div>
    </div>
  );
}

function ReferencePreview({ asset, isDone }) {
  const views = [
    { key: 'front', label: 'Frente', code: 'FRT · 00°' },
    { key: 'three-quarter', label: '3/4', code: '3Q · 045°' },
    { key: 'side', label: 'Perfil', code: 'SIDE · 090°' },
    { key: 'back', label: 'Costas', code: 'BACK · 180°' },
  ];
  return (
    <div className="reference-sheet preview-surface">
      <div className="reference-canvas-head"><div><span className="canvas-live-dot" /><span>REFERENCE GUIDE</span><b>·</b><span>ORTHOGRAPHIC TARGETS</span></div><div className="canvas-head-right"><span className="transparent-indicator"><span /> BG TARGET</span><span className="canvas-res">ILLUSTRATIVE</span></div></div>
      <div className="reference-view-grid">
        {views.map((view, index) => (
          <div key={view.key} className={`reference-view-card view-${view.key}`}>
            <div className="reference-view-top"><span className="view-number">0{index + 1}</span><span className="view-code">{view.code}</span></div>
            <div className="reference-artwork"><AssetArtwork asset={asset} angle={view.key} /></div>
            <div className="reference-view-bottom"><span>{view.label}</span><span className="view-status">GUIDE</span></div>
          </div>
        ))}
      </div>
      <div className="reference-canvas-foot"><div className="canvas-foot-item"><span className="foot-color-mark" /><span>Silhueta</span><b>consistent</b></div><div className="canvas-foot-item"><span className="foot-color-mark foot-color-mark-2" /><span>Escala</span><b>locked</b></div><div className="canvas-foot-item"><span className="foot-color-mark foot-color-mark-3" /><span>Pose</span><b>neutral</b></div><span className="canvas-foot-note">{asset.referenceData && <img src={asset.referenceData} alt="Miniatura da referência" />}{asset.referenceName ? `REF · ${asset.referenceName}` : asset.references?.length ? `REF · ${asset.references.map((reference) => reference.name || reference.path).join(', ')}` : isDone ? 'REFERENCE FILES REGISTERED' : 'GUIDE ONLY · NO FILES REGISTERED'}</span></div>
    </div>
  );
}

function ModelPreview({ asset, isDone }) {
  return (
    <div className="model-preview preview-surface">
      <div className="model-view-toolbar"><div><span className="viewfinder-mark">+</span><span>MODEL GUIDE</span><b>·</b><span>ORTHOGRAPHIC TARGET</span></div><div><span className="model-toolbar-pill"><Box size={11} /> STATIC ILLUSTRATION</span></div></div>
      <div className="model-viewport-grid"><div className="model-axis-labels"><span>X</span><span>Y</span><span>Z</span></div><div className="model-stage-grid" /><div className="model-art-large"><AssetArtwork asset={asset} angle="three-quarter" /></div><div className="model-shadow" /><div className="model-coordinates"><span>CAMERA TARGET · ORTHO</span><span>GAME ASSET · 3D</span></div><div className="model-metric model-metric-a"><span>FORMAT TARGET</span><strong>.GLB</strong></div><div className="model-metric model-metric-b"><span>VIEW</span><strong>GUIDE</strong></div></div>
      <div className="model-preview-foot"><span><span className="tiny-green-dot" /> {isDone ? 'Arquivo(s) 3D registrado(s) · não visualizado(s) aqui' : 'Guia de modelagem · nenhum arquivo carregado'}</span><span>ILLUSTRATION <i>·</i> NOT A MODEL VIEWER</span></div>
    </div>
  );
}

function RigPreview({ asset, isDone }) {
  const isCharacter = asset.type === 'character';
  return (
    <div className="rig-preview preview-surface">
      <div className="rig-preview-head"><div><span className="rig-head-dot" />{isCharacter ? 'RIG TARGET · STATIC GUIDE' : 'PIVOT / MOTION TARGET'}</div><span>{isCharacter ? 'NO ANIMATION PLAYER' : 'OPTIONAL · NO HUMANOID RIG'}</span></div>
      <div className="rig-canvas"><div className="rig-grid" />
        <div className={`rig-art ${!isCharacter ? 'rig-art-item' : ''}`}><AssetArtwork asset={asset} angle="front" /></div>
        {isCharacter ? <RigSkeleton /> : <div className="pivot-overlay"><span className="pivot-line" /><span className="pivot-dot" /><span className="pivot-label">PIVOT / GRIP TARGET</span></div>}
        <div className="rig-bone-tag">{isDone ? 'FILES REGISTERED' : (isCharacter ? 'RIG TARGET' : 'PIVOT TARGET')}</div>
        <div className="rig-scale">SCALE TARGET <span>│</span> PROJECT UNITS</div>
      </div>
      <div className="rig-controls"><div className="rig-control-info"><span>REQUESTED CLIP / MOVEMENT</span><strong title={(asset.animations || []).join(', ')}>{asset.animations?.[0] || (isCharacter ? 'Idle' : 'Idle glow')}</strong><span className="rig-duration">{isDone ? 'Files registered · inspect in your 3D tool' : 'Static guide · no animation playback'}</span></div></div>
    </div>
  );
}

function RigSkeleton() {
  return (
    <svg className="rig-skeleton" viewBox="0 0 210 300" aria-hidden="true">
      <g fill="none" stroke="#f17cbe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".9">
        <path d="M105 69 L105 117 L105 164 L105 207 M105 117 L75 130 L62 176 M105 117 L134 130 L147 176 M105 164 L83 205 L77 245 M105 164 L126 205 L134 245" />
        <path d="M75 130 L62 176 M134 130 L147 176 M83 205 L77 245 M126 205 L134 245" strokeDasharray="2 3" opacity=".55" />
      </g>
      <g fill="#261925" stroke="#ffb6dc" strokeWidth="1.6">
        <circle cx="105" cy="69" r="6" /><circle cx="105" cy="117" r="5" /><circle cx="75" cy="130" r="4.5" /><circle cx="134" cy="130" r="4.5" /><circle cx="62" cy="176" r="4" /><circle cx="147" cy="176" r="4" /><circle cx="105" cy="164" r="5" /><circle cx="83" cy="205" r="4" /><circle cx="126" cy="205" r="4" /><circle cx="77" cy="245" r="4" /><circle cx="134" cy="245" r="4" />
      </g>
    </svg>
  );
}

function SpritePreview({ asset, isDone }) {
  const exampleCells = Array.from({ length: 8 }, (_, index) => `GUIDE_${String(index + 1).padStart(2, '0')}`);
  return (
    <div className="sprite-preview preview-surface">
      <div className="sprite-preview-toolbar"><div><span className="sprite-grid-icon"><Layers3 size={13} /></span><span>ATLAS LAYOUT GUIDE</span><b>·</b><span>{exampleCells.length} EXAMPLE CELLS</span></div><div className="sprite-toolbar-right"><span className="transparent-indicator"><span /> ALPHA TARGET</span><span>EXAMPLE ONLY</span></div></div>
      <div className="sprite-atlas-area"><div className="sprite-atlas-grid">{exampleCells.map((frame, index) => <div key={frame} className={`sprite-cell sprite-cell-${index}`}><div className="sprite-art"><AssetArtwork asset={asset} angle={index % 2 === 0 ? 'front' : 'three-quarter'} /></div><span>{frame}</span></div>)}</div><div className="sprite-atlas-side-label"><span>LAYOUT</span><strong>EXAMPLE</strong><i /><span>FRAME SIZE</span><strong>TBD</strong><i /><span>ANCHOR TARGET</span><strong>{asset.type === 'character' ? 'FEET' : 'PIVOT'}</strong></div></div>
      <div className="sprite-preview-foot"><span className="sprite-quality"><FileImage size={13} /> {isDone ? 'PNG + JSON registrados · revisar os arquivos' : 'Guia ilustrativo · spritesheet não produzido'}</span><span>GUIDE ONLY <i>·</i> NOT EXPORTED</span></div>
    </div>
  );
}

function InspectorPanel({ asset, stage, onEdit, onAddAnimation, onNotify }) {
  const [showAllAnimations, setShowAllAnimations] = useState(false);
  const shownAnimations = showAllAnimations ? asset.animations : asset.animations.slice(0, 5);
  const progress = (asset.completed || []).slice(asset.startStageIndex || 0).filter(Boolean).length;
  const totalStages = requiredStageCount(asset);
  const directory = asset.outputPath || `game/assets/${asset.type === 'character' ? 'characters' : 'items'}/${slugify(asset.name)}`;

  function addAnimation() {
    const available = asset.type === 'character' ? CHAR_ANIMATION_OPTIONS : ITEM_ANIMATION_OPTIONS;
    const next = available.find((name) => !asset.animations.includes(name));
    if (!next) {
      onNotify('Todas as sugestões de animação já foram adicionadas.');
      return;
    }
    onAddAnimation(next);
  }

  return (
    <aside className="panel inspector-panel">
      <div className="inspector-topline"><span className="panel-kicker">ASSET INSPECTOR</span><button className="mini-icon-button" onClick={onEdit} aria-label="Editar asset"><Settings2 size={15} /></button></div>
      <div className="inspector-asset-head"><AssetThumb asset={asset} className="inspector-thumb" /><div><span className="inspector-role">{asset.role || (asset.type === 'character' ? 'PERSONAGEM' : 'ITEM / PROP')}</span><h2>{asset.name}</h2><span className="inspector-subtitle">{asset.subtitle}</span></div></div>
      <div className="inspector-status-row"><span className={`inspector-status-pill ${progress >= totalStages ? 'done' : ''}`}><span />{statusLabel(asset)}</span><span className="inspector-stage-count">{progress} / {totalStages} etapas</span></div>
      <div className="inspector-divider" />
      <div className="inspector-section-heading"><span>BRIEF VISUAL</span><button onClick={onEdit}>Editar <ArrowUpRight size={11} /></button></div>
      <p className="inspector-brief">{asset.brief}</p>
      <div className="inspector-palette"><span>COLOR TOKENS</span><div>{['coat', 'cloak', 'accent', 'skin', 'hair'].map((key) => <i key={key} title={key} style={{ background: asset.palette?.[key] || '#667354' }} />)}</div></div>
      <div className="inspector-divider" />
      <div className="inspector-section-heading"><span>{asset.type === 'character' ? 'ANIMAÇÕES PEDIDAS' : 'MOVIMENTO / VARIAÇÕES'}</span><button onClick={addAnimation}><Plus size={12} /> ADD</button></div>
      <div className="animation-chip-list">{shownAnimations.map((animation, index) => <span className="animation-chip" key={`${animation}-${index}`}><span className="animation-chip-dot" />{animation}</span>)}{asset.animations.length > 5 && <button className="more-animation-chip" onClick={() => setShowAllAnimations((value) => !value)}>{showAllAnimations ? 'menos' : `+${asset.animations.length - 5}`}</button>}</div>
      <div className="inspector-divider" />
      <div className="inspector-specs"><div><span>FRAME TARGET</span><strong>{asset.target || '48 × 48 px'}</strong></div><div><span>CAMERA</span><strong>Ortográfica · fixa</strong></div></div>
      <button className="output-path-card" onClick={() => onNotify(`Pasta do asset: ${directory}. Produza manualmente nas suas ferramentas ou use o handoff opcional; registre só arquivos reais verificados.`)}><span className="output-path-icon"><FolderOpen size={14} /></span><span><small>PASTA DE SAÍDA</small><strong>{directory}</strong></span><ArrowUpRight size={13} /></button>
      <div className="inspector-note"><ShieldCheck size={13} /><span>Brief e status salvos neste navegador</span></div>
    </aside>
  );
}

function AssetArtwork({ asset, angle = 'front', className = '' }) {
  if (asset.type === 'item') return <ItemArtwork asset={asset} angle={angle} className={className} />;
  return <CharacterArtwork asset={asset} angle={angle} className={className} />;
}

function CharacterArtwork({ asset, angle = 'front', className = '' }) {
  const palette = asset.palette || SEED_ASSETS[0].palette;
  const uid = slugify(asset.id || asset.name).replace(/-/g, '');
  const isBack = angle === 'back';
  const transform = angle === 'side' ? 'translate(48 0) scale(.55 1)' : angle === 'three-quarter' ? 'translate(7 0) scale(.96 1)' : '';
  return (
    <svg className={`character-art ${className}`} viewBox="0 0 210 300" role="img" aria-label={`${asset.name}, ${angle}`}>
      <defs>
        <linearGradient id={`coat-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={palette.coat} /><stop offset="1" stopColor={palette.cloak} /></linearGradient>
        <linearGradient id={`glow-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5f1a5" /><stop offset=".45" stopColor={palette.accent} /><stop offset="1" stopColor="#7dbd77" /></linearGradient>
        <radialGradient id={`light-${uid}`}><stop offset="0" stopColor={palette.accent} stopOpacity=".35" /><stop offset="1" stopColor={palette.accent} stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="106" cy="278" rx="47" ry="8" fill="#0b110d" opacity=".42" />
      <ellipse cx="105" cy="274" rx="27" ry="5" fill="#b4d374" opacity=".08" />
      <g transform={transform}>
        {isBack ? (
          <>
            <path d="M74 111 Q82 98 104 96 Q128 97 139 112 L157 181 Q169 222 160 251 Q130 263 104 260 Q76 263 49 250 Q45 221 55 183Z" fill={`url(#coat-${uid})`} stroke="#263b32" strokeWidth="3" />
            <path d="M68 117 Q104 128 145 116 L153 182 Q140 213 130 249 L103 256 L78 248 Q67 211 54 183Z" fill={palette.cloak} />
            <path d="M76 118 Q103 134 137 118 L128 155 Q106 166 84 154Z" fill="#7d8866" opacity=".7" />
            <path d="M84 53 Q84 33 104 29 Q127 30 128 56 L132 86 Q128 104 105 110 Q82 103 78 85Z" fill={palette.hair} stroke="#2e3029" strokeWidth="3" />
            <path d="M72 65 Q72 35 103 28 Q136 31 139 65 L132 83 Q129 54 104 51 Q83 53 78 83Z" fill={palette.coat} stroke="#34463a" strokeWidth="3" />
            <path d="M90 77 Q105 82 121 75" fill="none" stroke="#aeb68a" strokeWidth="2" opacity=".55" />
            <path d="M83 124 L69 174 M128 124 L142 174" stroke={palette.leather} strokeWidth="5" strokeLinecap="round" />
            <path d="M101 145 L108 215" stroke={palette.accent} strokeWidth="3" opacity=".7" />
            <path d="M85 247 L82 266 Q87 270 103 269 L106 257 M125 248 L128 266 Q121 271 107 269 L106 257" fill={palette.leather} stroke="#302e27" strokeWidth="3" />
            <path d="M80 266 Q94 262 104 268 L104 277 Q91 280 75 277Z M109 268 Q121 263 133 267 L139 277 Q124 281 109 277Z" fill="#453a32" stroke="#282b25" strokeWidth="3" />
            <path d="M68 129 Q58 146 58 168 M141 130 Q151 144 151 166" fill="none" stroke={palette.metal} strokeWidth="2" opacity=".55" />
          </>
        ) : (
          <>
            <path d="M73 113 Q80 99 103 97 Q129 98 139 114 L153 174 Q165 210 157 245 Q135 258 105 256 Q76 259 52 245 Q49 212 60 175Z" fill={palette.cloak} stroke="#29392f" strokeWidth="3" />
            <path d="M72 125 Q105 140 140 124 L147 194 Q130 219 129 247 Q105 256 80 247 Q76 214 59 194Z" fill={`url(#coat-${uid})`} stroke="#394b3a" strokeWidth="2" />
            <path d="M75 127 Q57 149 58 185 L71 202 L82 165Z" fill={palette.coat} stroke="#35473b" strokeWidth="2" />
            <path d="M136 126 Q153 148 151 184 L139 199 L129 163Z" fill={palette.cloak} stroke="#33463b" strokeWidth="2" />
            <path d="M80 53 Q79 32 104 29 Q130 31 130 56 L129 78 Q126 95 105 102 Q84 95 79 79Z" fill={palette.skin} stroke="#503930" strokeWidth="2.5" />
            <path d="M72 65 Q73 32 104 28 Q136 31 139 65 L133 79 Q129 55 104 51 Q84 52 77 82Z" fill={palette.hair} stroke="#342c29" strokeWidth="3" />
            <path d="M79 63 Q88 46 105 48 Q121 48 132 65 L129 82 Q116 69 106 72 Q94 68 81 84Z" fill={palette.hair} />
            <path d="M88 80 Q92 77 96 80 M115 80 Q119 77 123 80" fill="none" stroke="#493930" strokeWidth="2" strokeLinecap="round" />
            <path d="M99 91 Q105 95 111 91" fill="none" stroke="#9e6551" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M85 104 Q105 113 125 103 L134 126 Q106 138 77 126Z" fill={palette.leather} stroke="#46372e" strokeWidth="2" />
            <path d="M83 124 Q106 138 131 124 L127 186 Q107 198 86 184Z" fill={palette.coat} stroke="#3d4a36" strokeWidth="2.5" />
            <path d="M98 136 L106 188 M115 134 L110 187" stroke="#9ca57a" strokeWidth="1.4" opacity=".6" />
            <path d="M78 128 Q67 142 67 177 L75 192 Q82 188 85 180 L91 145Z" fill={palette.skin} stroke="#634539" strokeWidth="2" />
            <path d="M133 126 Q145 139 145 172 L137 188 Q130 187 126 179 L121 144Z" fill={palette.skin} stroke="#634539" strokeWidth="2" />
            <path d="M81 182 Q106 194 132 181 L133 197 Q106 210 78 197Z" fill="#463d32" stroke="#302c27" strokeWidth="2" />
            <path d="M101 189 L111 191 L111 199 L100 198Z" fill={palette.accent} stroke="#3c4633" strokeWidth="1.5" />
            <path d="M86 197 L105 200 L102 246 L97 265 Q87 269 77 264 L81 239Z" fill="#51443a" stroke="#342f2a" strokeWidth="2.5" />
            <path d="M109 199 L129 196 L129 239 L137 263 Q126 270 113 264 L105 243Z" fill="#554638" stroke="#342f2a" strokeWidth="2.5" />
            <path d="M78 258 Q89 253 100 260 L102 271 Q91 277 72 271Z M113 259 Q127 253 137 259 L144 271 Q128 278 113 272Z" fill="#3d3832" stroke="#292a26" strokeWidth="3" />
            <path d="M78 267 L98 267 M115 267 L138 267" stroke={palette.metal} strokeWidth="2" opacity=".75" />
            <path d="M61 180 Q58 187 58 195 L65 201 L73 194 L70 182Z" fill={palette.leather} stroke="#3e332c" strokeWidth="2" />
            <path d="M57 201 L57 222 M51 205 L63 205 M51 211 L63 211 M53 220 L62 220" stroke={palette.metal} strokeWidth="2" strokeLinecap="round" />
            <path d="M58 201 Q48 188 50 176 Q53 170 60 176 L66 192Z" fill={`url(#glow-${uid})`} stroke="#637145" strokeWidth="2" />
            <path d="M53 176 L53 171 Q57 166 62 171 L61 177 M50 185 L65 185 M51 194 L63 194" fill="none" stroke={palette.leather} strokeWidth="2" />
            <ellipse cx="57" cy="188" rx="20" ry="27" fill={`url(#light-${uid})`} />
            <path d="M148 141 L153 175" stroke={palette.metal} strokeWidth="2" opacity=".4" />
            <path d="M77 127 Q106 136 132 125" fill="none" stroke="#d2d5b4" strokeWidth="1.5" opacity=".4" />
          </>
        )}
      </g>
    </svg>
  );
}

function ItemArtwork({ asset, angle = 'front', className = '' }) {
  const uid = slugify(asset.id || asset.name).replace(/-/g, '');
  const palette = asset.palette || SEED_ASSETS[3].palette;
  const isBlade = asset.itemKind === 'blade';
  const tilt = angle === 'side' ? 'rotate(13 105 150)' : angle === 'three-quarter' ? 'rotate(-5 105 150)' : '';
  return (
    <svg className={`item-art ${className}`} viewBox="0 0 210 300" role="img" aria-label={`${asset.name}, ${angle}`}>
      <defs><linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0e4cd" /><stop offset=".42" stopColor={palette.metal || '#bac3ad'} /><stop offset="1" stopColor="#737f77" /></linearGradient><linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eff6a7" /><stop offset=".45" stopColor={palette.accent} /><stop offset="1" stopColor="#64b98b" /></linearGradient><radialGradient id={`itemglow-${uid}`}><stop stopColor={palette.accent} stopOpacity=".35" /><stop offset="1" stopColor={palette.accent} stopOpacity="0" /></radialGradient></defs>
      <ellipse cx="106" cy="270" rx="39" ry="7" fill="#0a110d" opacity=".48" />
      {isBlade ? (
        <g transform={tilt}>
          <path d="M107 35 Q117 52 118 111 L112 186 Q108 197 103 185 L96 109 Q99 50 107 35Z" fill={`url(#metal-${uid})`} stroke="#53615c" strokeWidth="2.5" />
          <path d="M106 49 L106 179" stroke="#faf6da" strokeWidth="2" opacity=".75" />
          <path d="M94 174 Q107 165 122 176 L133 189 Q130 197 122 193 L109 186 L96 195 Q88 198 84 191Z" fill={palette.metal} stroke="#48534d" strokeWidth="3" />
          <path d="M103 190 Q113 190 117 199 L114 241 Q108 253 99 241 L96 200Z" fill={palette.leather} stroke="#40372f" strokeWidth="3" />
          <path d="M98 207 L114 219 M97 220 L114 231 M99 235 L110 243" stroke="#bea478" strokeWidth="3" strokeLinecap="round" />
          <path d="M104 242 L111 242 L116 260 Q108 267 98 260Z" fill={palette.metal} stroke="#48534d" strokeWidth="2.5" />
          <circle cx="106" cy="186" r="5" fill={palette.accent} stroke="#435548" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <ellipse cx="105" cy="156" rx="45" ry="66" fill={`url(#itemglow-${uid})`} />
          <path d="M84 78 Q82 49 105 46 Q129 48 127 78" fill="none" stroke={palette.metal} strokeWidth="6" />
          <path d="M81 78 L129 78 L138 97 L132 221 Q106 237 78 221 L72 97Z" fill={palette.coat} stroke="#4c4737" strokeWidth="3" />
          <path d="M85 99 L125 99 L128 209 Q107 221 83 208Z" fill={`url(#glass-${uid})`} stroke="#51533f" strokeWidth="2.5" />
          <path d="M88 105 L119 105 L116 199 Q102 205 91 198Z" fill="#e2f3aa" opacity=".24" />
          <path d="M73 99 L137 99 M75 119 L135 119 M75 202 L135 202 M78 220 L132 220" stroke={palette.metal} strokeWidth="6" strokeLinecap="round" />
          <path d="M82 81 L75 103 M127 81 L136 103 M79 116 L82 207 M131 117 L128 207" stroke="#664d38" strokeWidth="3" />
          <path d="M96 72 L113 72 M105 66 L105 83" stroke={palette.metal} strokeWidth="2" />
          <path d="M91 226 L91 239 Q105 248 120 238 L120 225" fill="none" stroke={palette.leather} strokeWidth="5" />
          <circle cx="105" cy="148" r="5" fill="#f0f8be" opacity=".9" />
        </g>
      )}
    </svg>
  );
}

function HandoffPage({ assets, selectedAsset, onSelectAsset, onGoToStudio, onNotify }) {
  const [agent, setAgent] = useState('claude');
  const [outputPath, setOutputPath] = useState(selectedAsset.outputPath || `game/assets/${selectedAsset.type === 'character' ? 'characters' : 'items'}/${slugify(selectedAsset.name)}`);
  const [animations, setAnimations] = useState(selectedAsset.animations || []);
  const [copied, setCopied] = useState(false);
  const handoffAsset = useMemo(() => assetForNextHandoff(selectedAsset), [selectedAsset]);
  const prompt = useMemo(() => makeAgentPrompt(handoffAsset, agent, outputPath, animations), [handoffAsset, agent, outputPath, animations]);
  const spec = useMemo(() => taskSpecFor(handoffAsset, agent, outputPath, animations), [handoffAsset, agent, outputPath, animations]);
  const animationOptions = selectedAsset.type === 'character' ? CHAR_ANIMATION_OPTIONS : ITEM_ANIMATION_OPTIONS;

  useEffect(() => {
    setOutputPath(selectedAsset.outputPath || `game/assets/${selectedAsset.type === 'character' ? 'characters' : 'items'}/${slugify(selectedAsset.name)}`);
    setAnimations(selectedAsset.animations || []);
  }, [selectedAsset.id]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      onNotify('Prompt de handoff copiado para a área de transferência.');
    } catch {
      onNotify('Não foi possível acessar a área de transferência. Baixe o arquivo JSON da tarefa.');
    }
  }

  function downloadSpec() {
    downloadText(`${slugify(selectedAsset.name)}-sprite-task.json`, JSON.stringify(spec, null, 2), 'application/json');
    onNotify('Task spec JSON baixado.');
  }

  function downloadReference() {
    if (!selectedAsset.referenceData) return;
    const link = document.createElement('a');
    link.href = selectedAsset.referenceData;
    link.download = `${slugify(selectedAsset.name)}-reference.webp`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    onNotify('Imagem de referência baixada. Coloque-a na pasta references do asset.');
  }

  function toggleAnimation(name) {
    setAnimations((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  return (
    <main className="page-content handoff-page">
      <div className="page-heading-row handoff-heading-row">
        <div><div className="eyebrow"><span>HOLLOW VALE</span><i>/</i><span>ORQUESTRAÇÃO</span></div><h1>Agent handoff</h1><p className="page-subtitle">Handoff opcional para delegar tarefas; o fluxo manual continua disponível no Asset Studio.</p></div>
        <div className="handoff-heading-badge"><span className="handoff-badge-icon"><Bot size={17} /></span><span><strong>Local-first</strong><small>Você controla os agentes e providers</small></span></div>
      </div>

      <div className="handoff-explainer"><div className="explainer-icon"><Workflow size={19} /></div><div><strong>Delegação opcional, entrada explícita.</strong><p>Escolha um agente apenas se quiser delegar. Sem ele, trabalhe nas suas ferramentas e registre os outputs reais pelo Asset Studio.</p></div><span className="handoff-demo-tag"><span /> HANDOFF ONLY</span></div>

      <div className="handoff-layout">
        <section className="panel handoff-config-panel">
          <div className="handoff-panel-heading"><div><span className="panel-kicker">CONFIGURE A TAREFA</span><h2>O que vamos produzir?</h2></div><span className="task-sequence-badge"><span className="tiny-green-dot" /> 01 — 04</span></div>
          <label className="form-field"><span>ASSET DE ORIGEM</span><div className="select-wrap"><select value={selectedAsset.id} onChange={(event) => { const next = assets.find((item) => item.id === event.target.value); if (next) onSelectAsset(next); }} aria-label="Asset de origem">{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.type === 'character' ? 'Personagem' : 'Item'} · {asset.name}</option>)}</select><ChevronDown size={15} /></div></label>
          <div className="handoff-entry-card"><span><Workflow size={13} /></span><div><small>PONTO DE ENTRADA · 3D → 2D</small><strong>Etapa {Math.min((handoffAsset.startStageIndex || 0) + 1, 5)} — {stageListFor(handoffAsset.type)[handoffAsset.startStageIndex || 0]?.title || 'Direção de arte'}</strong><small>{entryOptionFor(handoffAsset).detail}</small></div></div>
          {(handoffAsset.existingInputs || []).length > 0 && <div className="handoff-reference-attachment"><span className="handoff-reference-icon"><FolderOpen size={14} /></span><span><strong>Artefatos existentes</strong><small>{handoffAsset.existingInputs.map((input) => input.path).join(' · ')}</small></span></div>}
          {(selectedAsset.referenceName || selectedAsset.references?.length) && <div className="handoff-reference-attachment"><span className="handoff-reference-icon"><FileImage size={14} /></span><span><strong>{selectedAsset.referenceName || selectedAsset.references.map((reference) => reference.name || reference.path).join(', ')}</strong><small>{selectedAsset.referenceData ? 'Imagem local pronta para baixar; não é incluída no JSON.' : selectedAsset.references?.length ? `Arquivo(s) no projeto: ${selectedAsset.references.map((reference) => reference.path).join(', ')}` : 'Arquivo indicado no brief; adicione-o ao projeto antes da execução.'}</small></span>{selectedAsset.referenceData && <button onClick={downloadReference}><Download size={12} /> Baixar</button>}</div>}
          <label className="form-field"><span>PASTA DE SAÍDA</span><div className="path-input-wrap"><FolderOpen size={15} /><input value={outputPath} onChange={(event) => setOutputPath(event.target.value)} aria-label="Pasta de saída" /></div><small>Relativa à raiz do projeto de jogo.</small></label>
          <div className="form-field agent-target-field"><span>AGENTE ORQUESTRADOR</span><div className="agent-choice-grid">
            <button className={agent === 'claude' ? 'is-selected' : ''} onClick={() => setAgent('claude')}><span className="agent-choice-icon claude-icon">✳</span><span><strong>Claude Code</strong><small>com subagents</small></span>{agent === 'claude' && <CheckCircle2 size={15} />}</button>
            <button className={agent === 'codex' ? 'is-selected' : ''} onClick={() => setAgent('codex')}><span className="agent-choice-icon codex-icon"><Code2 size={16} /></span><span><strong>Codex</strong><small>agentes em paralelo</small></span>{agent === 'codex' && <CheckCircle2 size={15} />}</button>
            <button className={agent === 'opencode' ? 'is-selected' : ''} onClick={() => setAgent('opencode')}><span className="agent-choice-icon opencode-icon"><Bot size={15} /></span><span><strong>OpenCode</strong><small>Ollama / modelo local</small></span>{agent === 'opencode' && <CheckCircle2 size={15} />}</button>
            <button className={`agent-choice-wide ${agent === 'agnostic' ? 'is-selected' : ''}`} onClick={() => setAgent('agnostic')}><Terminal size={15} /><span><strong>Prompt genérico</strong><small>para outro agente local</small></span>{agent === 'agnostic' && <CheckCircle2 size={15} />}</button>
          </div></div>
          <div className="form-field animation-request-field"><div className="form-field-title"><span>{selectedAsset.type === 'character' ? 'ANIMAÇÕES A SOLICITAR' : 'MOVIMENTOS / VARIAÇÕES'}</span><small>{animations.length} selecionadas</small></div><div className="handoff-animation-grid">{animationOptions.map((name) => <button key={name} className={`handoff-animation-option ${animations.includes(name) ? 'checked' : ''}`} onClick={() => toggleAnimation(name)}><span>{animations.includes(name) && <Check size={11} />}</span>{name}</button>)}</div></div>
          <div className="handoff-workflow-mini"><div className="mini-workflow-head"><span>PIPELINE 3D → 2D</span><span>{5 - (handoffAsset.startStageIndex || 0)} etapas neste handoff</span></div><div className="mini-workflow-track">{stageListFor(handoffAsset.type).map((step, index) => { const skipped = index < (handoffAsset.startStageIndex || 0); return <div className={`mini-workflow-step ${skipped ? 'is-skipped' : ''}`} key={step.id || step.short}><span className="mini-workflow-node">{index + 1}</span><span>{step.short}</span>{index < 4 && <i />}</div>; })}</div></div>
        </section>

        <section className="panel handoff-preview-panel">
          <div className="handoff-preview-head"><div><span className="panel-kicker">TASK PREVIEW</span><h2>Brief para o agente</h2></div><span className="preview-file-type"><FileText size={13} /> MARKDOWN</span></div>
          <div className="prompt-preview-topline"><span><i className="prompt-led" /> {agent === 'claude' ? 'CLAUDE CODE' : agent === 'codex' ? 'CODEX' : agent === 'opencode' ? 'OPENCODE · LOCAL' : 'GENÉRICO'} · {selectedAsset.name}</span><button onClick={copyPrompt} className={copied ? 'copied' : ''}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copiado' : 'Copiar prompt'}</button></div>
          <pre className="prompt-preview-text">{prompt}</pre>
          <div className="handoff-preview-footer"><div className="json-file-info"><div className="json-icon"><FileJson size={16} /></div><div><strong>{slugify(selectedAsset.name)}-sprite-task.json</strong><span>Task spec · v2.0 · {Math.max(1, animations.length)} animações</span></div></div><button className="button button-quiet download-spec-button" onClick={downloadSpec}><Download size={14} /> Baixar JSON</button></div>
        </section>
      </div>

      <div className="handoff-bottom-grid"><div className="handoff-next-step-card"><div className="next-step-icon"><Terminal size={16} /></div><div><span>PRÓXIMO PASSO</span><strong>Cole o prompt no seu agente local</strong><small>O agente pode delegar o pipeline, salvar os arquivos e reportar bloqueios no próprio projeto.</small></div><button className="button button-primary" onClick={copyPrompt}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copiado' : 'Copiar prompt'}</button></div><div className="handoff-security-card"><ShieldCheck size={16} /><div><strong>Sem chaves no browser</strong><span>Quando a execução automática entrar, credenciais e providers devem ficar em um runner local/server-side.</span></div></div></div>
      <div className="page-footer"><span><ShieldCheck size={13} /> Exportação local · nenhuma chamada externa</span><button onClick={onGoToStudio}>Voltar ao studio <ArrowRight size={13} /></button></div>
    </main>
  );
}

function ActivityPage({ activities, managedProcesses, comfyStatus, workflows, loading, onRefresh, onDownloadWorkflow, onNotify }) {
  const running = comfyStatus?.queue?.running || 0;
  const pending = comfyStatus?.queue?.pending || 0;
  const devices = comfyStatus?.devices || [];
  const models = comfyStatus?.models;
  const modelCategories = [
    ['checkpoints', 'Checkpoints'],
    ['loras', 'LoRAs'],
    ['vae', 'VAEs'],
    ['controlnet', 'ControlNet'],
  ];
  const activityCount = activities.length + managedProcesses.length + running + pending;

  return (
    <main className="page-content activity-page">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span>LIA FORGE</span><i>/</i><span>RUNTIME LOCAL</span></div>
          <h1>Atividade &amp; ComfyUI</h1>
          <p className="page-subtitle">Acompanhe tarefas, fila externa, dispositivos e templates sem iniciar processos ou baixar pesos.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-quiet" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={14} />{loading ? 'Atualizando...' : 'Atualizar status'}</button>
        </div>
      </div>

      <div className="activity-summary-grid">
        <div className="activity-stat-card"><span className="activity-stat-icon"><Activity size={17} /></span><div><span>ATIVIDADES NO WORKSPACE</span><strong>{String(activities.length).padStart(2, '0')}</strong><small>processos e etapas externas registradas</small></div></div>
        <div className="activity-stat-card"><span className={`activity-stat-icon ${comfyStatus?.connected ? 'is-online' : ''}`}><Server size={17} /></span><div><span>COMFYUI LOCAL</span><strong>{comfyStatus === null ? '…' : comfyStatus.connected ? 'Conectado' : 'Desconectado'}</strong><small>{comfyStatus?.endpoint || 'consultando endpoint padrão'}</small></div></div>
        <div className="activity-stat-card"><span className="activity-stat-icon"><Workflow size={17} /></span><div><span>FILA COMFYUI EXTERNA</span><strong>{String(running + pending).padStart(2, '0')}</strong><small>{running} em execução · {pending} pendentes</small></div></div>
      </div>

      <div className="activity-content-grid">
        <section className="panel activity-feed-panel">
          <div className="panel-heading activity-panel-heading"><div><span className="panel-kicker">TAREFAS &amp; PROCESSOS</span><h2>O que está acontecendo <span>{String(activityCount).padStart(2, '0')}</span></h2></div><span className="activity-live-pill"><i /> ATUALIZAÇÃO LOCAL</span></div>
          {activityCount === 0 ? (
            <div className="activity-empty"><span><CheckCircle2 size={19} /></span><strong>Nenhuma tarefa ativa</strong><p>Nenhum processo iniciado pela Lia Forge, etapa em andamento ou workflow ComfyUI na fila foi encontrado.</p></div>
          ) : (
            <div className="activity-list">
              {managedProcesses.map((process) => (
                <article className="activity-row managed-activity" key={process.id}><span className="activity-row-icon"><Cpu size={15} /></span><div className="activity-row-copy"><strong>{process.label}</strong><small>Processo iniciado pela Lia Forge{process.pid ? ` · PID ${process.pid}` : ''}</small></div><span className="activity-state-pill">ATIVO</span></article>
              ))}
              {activities.map((activity, index) => (
                <article className="activity-row external-activity" key={`${activity.kind}-${activity.label}-${index}`}>
                  <span className="activity-row-icon"><Workflow size={15} /></span>
                  <div className="activity-row-copy"><strong>{activity.label}</strong><small>{activity.detail || 'Status registrado no workspace.'}</small>
                    {activity.progress !== null && activity.progress !== undefined && <div className="activity-row-progress"><span style={{ width: `${Math.max(0, Math.min(100, activity.progress))}%` }} /></div>}
                  </div>
                  <span className="activity-state-pill is-external">REGISTRADO</span>
                </article>
              ))}
              {(running + pending) > 0 && <article className="activity-row external-activity"><span className="activity-row-icon"><Workflow size={15} /></span><div className="activity-row-copy"><strong>Fila do ComfyUI externo</strong><small>{running} workflow(s) executando e {pending} aguardando. A Lia Forge só consulta e não cancela tarefas de outros clientes.</small></div><span className="activity-state-pill is-external">EXTERNO</span></article>}
            </div>
          )}
          <div className="activity-feed-foot"><ShieldCheck size={13} /><span>Ao fechar, a confirmação lista essas atividades. Só processos iniciados pela Lia Forge são encerrados por ela.</span></div>
        </section>

        <section className="panel comfy-runtime-panel">
          <div className="panel-heading activity-panel-heading"><div><span className="panel-kicker">BACKEND DE IMAGEM</span><h2>ComfyUI <span className={`connection-dot ${comfyStatus?.connected ? 'connected' : ''}`} /></h2></div><span className={`comfy-status-badge ${comfyStatus?.connected ? 'connected' : ''}`}>{comfyStatus === null ? 'CONSULTANDO' : comfyStatus.connected ? 'ONLINE' : 'OFFLINE'}</span></div>
          {comfyStatus?.connected ? (
            <>
              <div className="comfy-endpoint-row"><span>ENDPOINT</span><code>{comfyStatus.endpoint}</code></div>
              {comfyStatus.version && <div className="comfy-version-row"><span>ComfyUI {comfyStatus.version}</span><span>{comfyStatus.torchVersion ? `PyTorch ${comfyStatus.torchVersion}` : 'versão do PyTorch não reportada'}</span></div>}
              <div className="comfy-devices-list">
                {devices.length ? devices.map((device, index) => <div className="comfy-device-row" key={`${device.name}-${index}`}><span className="comfy-device-icon"><Cpu size={15} /></span><div><strong>{device.name}</strong><small>{device.type || 'backend não informado'}{device.vramTotalBytes ? ` · ${formatVram(device.vramFreeBytes)} livre de ${formatVram(device.vramTotalBytes)}` : ''}</small></div><span>REPORTADO</span></div>) : <div className="comfy-no-device"><HardDrive size={14} /> O servidor não reportou um dispositivo de aceleração.</div>}
              </div>
              <div className="comfy-model-summary"><div className="comfy-model-heading"><span>PESOS DETECTADOS PELO SERVIDOR</span><strong>{comfyStatus.modelCount ?? '—'}</strong></div><div className="comfy-model-categories">{modelCategories.map(([key, label]) => { const entries = models?.[key]; return <div key={key}><span>{label}</span><strong>{Array.isArray(entries) ? entries.length : entries === null ? '—' : '0'}</strong><small title={Array.isArray(entries) ? entries.join(', ') : undefined}>{Array.isArray(entries) && entries.length ? entries.slice(0, 2).join(', ') : entries === null ? 'Lista indisponível' : 'Nenhum arquivo detectado'}</small></div>; })}</div></div>
              {comfyStatus.warnings?.length > 0 && <p className="comfy-warning-note">{comfyStatus.warnings.join(' ')}</p>}
            </>
          ) : (
            <div className="comfy-offline-state"><span className="comfy-offline-icon"><Server size={17} /></span><strong>{comfyStatus === null ? 'Consultando o servidor local…' : 'Nenhum ComfyUI detectado neste endpoint'}</strong><p>{comfyStatus?.error || 'A Lia Forge não instala nem inicia o ComfyUI. Inicie-o por conta própria e atualize o status.'}</p><small>Endpoint padrão: http://127.0.0.1:8188</small></div>
          )}
          <div className="comfy-readonly-note"><ShieldCheck size={13} /><span>Somente leitura nesta versão. Sem execução automática e sem downloads.</span></div>
        </section>
      </div>

      <section className="panel comfy-workflows-panel">
        <div className="panel-heading activity-panel-heading"><div><span className="panel-kicker">TEMPLATES INCLUÍDOS</span><h2>Workflows de conceito <span>{String(workflows.length).padStart(2, '0')}</span></h2></div><span className="workflow-api-tag"><FileJson size={13} /> COMFYUI API JSON</span></div>
        <div className="comfy-workflow-list">
          {workflows.map((workflow) => <article className="comfy-workflow-card" key={workflow.id}>
            <span className="comfy-workflow-icon">{workflow.subject === 'character' ? <Sparkles size={17} /> : <Package size={17} />}</span>
            <div className="comfy-workflow-copy"><strong>{workflow.title}</strong><p>{workflow.description}</p><small>{workflow.nodeCount ?? '—'} nós · checkpoint compatível escolhido por você</small></div>
            <button className="button button-quiet" disabled={!workflow.available} onClick={() => onDownloadWorkflow(workflow.id)}><Download size={13} /> Baixar JSON</button>
          </article>)}
          {!workflows.length && <div className="activity-empty workflow-empty"><strong>Templates não disponíveis</strong><p>Os arquivos de workflow não foram encontrados no pacote.</p></div>}
        </div>
        <div className="workflow-caveat"><CircleHelp size={14} /><span>Templates de referência visual: não garantem vistas ortográficas e não produzem 3D, rig, animações nem spritesheet. Troque o placeholder do checkpoint antes de executar.</span><button onClick={() => onNotify('Os detalhes de instalação, pesos e backend AMD estão em docs/comfyui.md.')}>Ver limites</button></div>
      </section>
      <div className="page-footer"><span><ShieldCheck size={13} /> Nenhum peso instalado ou workflow enviado pela Lia Forge.</span><span>Lia Forge <b>·</b> monitor local</span></div>
    </main>
  );
}

function ExportsPage({ assets, onBuildTask, onOpenAssetFolder, onNotify }) {
  const completed = assets.filter((asset) => asset.completed?.[4] && asset.stageStatus?.[4]?.status === 'completed');
  return (
    <main className="page-content exports-page">
      <div className="page-heading-row"><div><div className="eyebrow"><span>HOLLOW VALE</span><i>/</i><span>SAÍDAS</span></div><h1>Exports</h1><p className="page-subtitle">Arquivos reais registrados no workspace; a Lia Forge não inventa prévias de spritesheets.</p></div><button className="button button-quiet" onClick={onBuildTask}><Bot size={15} /> Handoff opcional</button></div>
      <div className="export-summary-row"><div><span className="export-summary-icon"><Layers3 size={17} /></span><span><strong>{completed.length}</strong><small>Spritesheets registrados</small></span></div><div><span className="export-summary-icon muted"><FileImage size={17} /></span><span><strong>PNG + JSON</strong><small>Arquivos conferidos no disco</small></span></div><div><span className="export-summary-icon muted"><FolderOpen size={17} /></span><span><strong>Local</strong><small>Outputs dentro da pasta do asset</small></span></div></div>
      {completed.length ? <div className="export-cards-grid">{completed.map((asset) => {
        const outputs = asset.stageStatus[4].outputs || [];
        return <div className="panel export-card" key={asset.id}>
          <div className="export-art"><div className="export-verified-icon"><FileImage size={24} /><CheckCircle2 size={14} /></div></div>
          <div className="export-card-copy"><span>ARTEFATOS REAIS · {asset.type === 'character' ? 'PERSONAGEM' : 'ITEM'}</span><h3>{asset.name}</h3><p>{outputs.length} arquivo(s) registrados. A etapa verificou existência, tamanho e formato; confira visualmente os resultados.</p>
            <ul className="export-file-list">{outputs.map((output) => <li key={output}><FileText size={11} /><code title={output}>{output}</code></li>)}</ul>
            <button className="button button-quiet" disabled={!window.liaForge?.openAssetStageFolder} onClick={() => onOpenAssetFolder(asset)}><FolderOpen size={12} /> Abrir pasta</button>
          </div>
        </div>;
      })}</div> : <div className="panel exports-empty"><div className="empty-export-art"><div className="empty-export-grid"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="empty-export-spark"><Sparkles size={17} /></div></div><span className="panel-kicker">AINDA SEM ARQUIVOS</span><h2>Você pode seguir sem agente.</h2><p>Crie e revise o brief, produza nas suas ferramentas (por exemplo, Blender) e registre os arquivos reais na etapa correspondente. O handoff é só uma alternativa para delegar.</p><button className="button button-primary" onClick={() => onNotify('No Asset Studio, abra a etapa e use “Abrir pasta” e “Verificar arquivos”.')}><FolderOpen size={14} /> Ver fluxo manual</button><button className="exports-handoff-link" onClick={onBuildTask}><Bot size={13} /> Ou preparar um handoff opcional <ArrowRight size={13} /></button><span className="export-empty-note"><ShieldCheck size={13} /> Nenhuma geração simulada: só aparecem outputs reais registrados.</span></div>}
      <div className="page-footer"><span><ShieldCheck size={13} /> A Lia Forge confere arquivos; revisão visual continua com você.</span><span>LIA FORGE <b>·</b> EXPORTS</span></div>
    </main>
  );
}

function NewAssetModal({ initialAsset, defaultType, storageAvailable, onClose, onSave }) {
  const [type, setType] = useState(initialAsset?.type || defaultType);
  const [name, setName] = useState(initialAsset?.name || '');
  const [description, setDescription] = useState(initialAsset?.prompt || '');
  const [itemKind, setItemKind] = useState(initialAsset?.itemKind || 'prop');
  const [animations, setAnimations] = useState(initialAsset?.animations || []);
  const [reference, setReference] = useState(initialAsset?.referenceName || '');
  const [referenceData, setReferenceData] = useState(initialAsset?.referenceData || '');
  const [referencePreview, setReferencePreview] = useState(initialAsset?.referenceData || '');
  const [referenceProcessing, setReferenceProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [entryPointId, setEntryPointId] = useState(entryOptionFor(initialAsset).id);
  const [existingInputPaths, setExistingInputPaths] = useState((initialAsset?.existingInputs || []).map((input) => input.path).join('\n'));
  const fileInput = useRef(null);
  const animationOptions = type === 'character' ? CHAR_ANIMATION_OPTIONS : ITEM_ANIMATION_OPTIONS;
  const entryOptions = type === 'item'
    ? ENTRY_OPTIONS.map((option) => option.id === 'rigged'
      ? (initialAsset?.stageStatus?.[3]?.status === 'skipped'
        ? { ...option, label: 'Modelo 3D existente · movimento pulado', detail: 'A etapa opcional de movimento foi pulada; renderize o spritesheet diretamente a partir do modelo 3D e dos demais insumos disponíveis.' }
        : { ...option, label: 'Movimento / variação existente', detail: 'Use o arquivo de movimento ou variação existente para renderizar o spritesheet; essa etapa é opcional para itens.' })
      : option)
    : ENTRY_OPTIONS;
  const entryOption = entryOptions.find((option) => option.id === entryPointId) || entryOptions[0];
  const existingPaths = existingInputPaths.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const hasImageReference = Boolean(reference || referenceData || initialAsset?.referenceData);
  const canSubmitEntry = entryOption.id === 'concept'
    ? existingPaths.length > 0 || hasImageReference
    : !entryOption.requiresPath || existingPaths.length > 0;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setReference(file.name);
    setReferenceProcessing(true);
    const url = URL.createObjectURL(file);
    setReferencePreview(url);
    compressReferenceImage(file)
      .then((data) => setReferenceData(data))
      .catch(() => setReferenceData(''))
      .finally(() => setReferenceProcessing(false));
  }

  function toggleAnimation(animation) {
    setAnimations((current) => current.includes(animation) ? current.filter((item) => item !== animation) : [...current, animation]);
  }

  function submit(event) {
    event.preventDefault();
    if (!name.trim() || !canSubmitEntry) return;
    const oldAsset = initialAsset || {};
    const nextType = type;
    const id = initialAsset?.id || `${slugify(name)}-${Date.now().toString().slice(-4)}`;
    const defaultPalette = nextType === 'character' ? SEED_ASSETS[0].palette : SEED_ASSETS[3].palette;
    const sameEntryPoint = oldAsset.type === nextType && (oldAsset.startStageIndex || 0) === entryOption.startStageIndex;
    const existingInputs = entryOption.sourceStageIndex === null ? [] : existingPaths.map((path) => ({
      path,
      stageIndex: entryOption.sourceStageIndex,
    }));
    onSave({
      ...oldAsset,
      id,
      type: nextType,
      itemKind: nextType === 'item' ? itemKind : undefined,
      name: name.trim(),
      subtitle: oldAsset.type === nextType ? oldAsset.subtitle || (nextType === 'character' ? 'Novo personagem' : `Item · ${itemKind}`) : (nextType === 'character' ? 'Novo personagem' : `Item · ${itemKind}`),
      role: oldAsset.type === nextType ? oldAsset.role || (nextType === 'character' ? 'PERSONAGEM · NOVO' : `ITEM · ${itemKind.toUpperCase()}`) : (nextType === 'character' ? 'PERSONAGEM · NOVO' : `ITEM · ${itemKind.toUpperCase()}`),
      brief: description.trim() || 'Brief visual ainda não preenchido.',
      prompt: description.trim() || 'Descreva o design, materiais, cores e silhueta deste asset.',
      palette: oldAsset.palette || defaultPalette,
      animations,
      workflowId: '3d_to_2d',
      entryPointId: entryOption.id,
      startStageIndex: entryOption.startStageIndex,
      existingInputs,
      completed: sameEntryPoint ? oldAsset.completed || [false, false, false, false, false] : [false, false, false, false, false],
      stageStatus: sameEntryPoint ? oldAsset.stageStatus : undefined,
      target: oldAsset.target || (nextType === 'character' ? '48 × 48 px' : '64 × 64 px'),
      outputPath: oldAsset.type === nextType ? oldAsset.outputPath || `game/assets/${nextType === 'character' ? 'characters' : 'items'}/${slugify(name)}` : `game/assets/${nextType === 'character' ? 'characters' : 'items'}/${slugify(name)}`,
      referenceName: reference || undefined,
      referenceData: referenceData || oldAsset.referenceData || undefined,
    });
  }

  return (
    <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="new-asset-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><span className="panel-kicker">{initialAsset ? 'EDITAR ASSET' : 'NOVO ASSET'}</span><h2 id="modal-title">{initialAsset ? 'Ajuste o briefing' : 'Comece com uma ideia'}</h2><p>Use o brief no seu fluxo manual ou opcionalmente entregue-o a um agente depois.</p></div><button className="modal-close" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={submit}>
          <div className="modal-type-tabs"><button type="button" onClick={() => { if (type !== 'character') setAnimations([]); setType('character'); }} className={type === 'character' ? 'selected' : ''}><Sparkles size={15} /><span>Personagem</span><small>3D + rig + animações</small></button><button type="button" onClick={() => { if (type !== 'item') setAnimations([]); setType('item'); }} className={type === 'item' ? 'selected' : ''}><Package size={15} /><span>Item / prop</span><small>3D + pivô + variações</small></button></div>
          <label className="form-field workflow-entry-field"><span>PONTO DE ENTRADA DO FLUXO</span><div className="select-wrap"><select value={entryPointId} onChange={(event) => { setEntryPointId(event.target.value); setExistingInputPaths(''); }} aria-label="Ponto de entrada do fluxo">{entryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronDown size={15} /></div><small>{entryOption.detail}</small></label>
          {entryOption.sourceStageIndex !== null && <label className="form-field existing-input-field"><span>ARTEFATOS EXISTENTES <small>{entryOption.requiresPath ? 'OBRIGATÓRIO' : 'OPCIONAL SE HOUVER IMAGEM DE REFERÊNCIA'}</small></span><textarea value={existingInputPaths} onChange={(event) => setExistingInputPaths(event.target.value)} placeholder={entryOption.id === 'model' ? 'game/assets/characters/mira/3d/model.glb' : entryOption.id === 'rigged' ? 'game/assets/characters/mira/rig/character.fbx\ngame/assets/characters/mira/animations/idle.fbx' : 'game/assets/characters/mira/concept/poses.png'} rows={2} /><small>Um caminho relativo à raiz do projeto por linha. Os arquivos não são copiados; a Lia Forge confere que existem no projeto antes de registrar o avanço manual ou via MCP.</small></label>}
          <div className="modal-form-grid"><label className="form-field modal-name-field"><span>NOME DO ASSET *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'character' ? 'Ex.: Guardião do bosque' : 'Ex.: Lanterna de maré'} autoFocus /></label>{type === 'item' && <label className="form-field"><span>TIPO DE ITEM</span><div className="select-wrap"><select value={itemKind} onChange={(event) => setItemKind(event.target.value)}><option value="weapon">Arma</option><option value="tool">Ferramenta</option><option value="prop">Prop / cenário</option><option value="consumable">Consumível</option></select><ChevronDown size={15} /></div></label>}</div>
          <label className="form-field modal-description-field"><span>BRIEF VISUAL</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o personagem ou item: silhueta, materiais, cores, personalidade e como aparece no jogo..." rows={4} /><small>Inclua o que precisa permanecer consistente entre vistas e animações.</small></label>
          <div className="modal-lower-grid"><div className="form-field"><span>IMAGEM DE REFERÊNCIA <small>OPCIONAL</small></span><button type="button" disabled={referenceProcessing} className={`reference-upload ${dragOver ? 'drag-over' : ''} ${referencePreview ? 'has-file' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFile(event.dataTransfer.files[0]); }}>
            {referencePreview ? <img src={referencePreview} alt="Prévia da referência" /> : <span className="upload-icon"><Upload size={16} /></span>}<span><strong>{reference || 'Arraste uma imagem ou clique para escolher'}</strong><small>{referenceProcessing ? 'Preparando imagem...' : reference ? 'Referência anexada ao briefing' : 'PNG, JPG ou WEBP · mantida localmente'}</small></span><Plus size={15} />
          </button><input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /></div>
            <div className="form-field modal-animation-field"><div className="form-field-title"><span>{type === 'character' ? 'ANIMAÇÕES INICIAIS' : 'MOVIMENTOS INICIAIS'}</span><small>Você pode editar depois</small></div><div className="modal-animation-options">{animationOptions.slice(0, 6).map((animation) => <button type="button" key={animation} className={animations.includes(animation) ? 'checked' : ''} onClick={() => toggleAnimation(animation)}><i>{animations.includes(animation) && <Check size={10} />}</i>{animation}</button>)}</div></div></div>
          {!canSubmitEntry && <p className="entry-validation-note">Informe ao menos um caminho existente para este ponto de entrada, ou anexe uma imagem de conceito/poses.</p>}
          <div className="modal-footer"><span><ShieldCheck size={13} /> {storageAvailable ? 'Salvo no workspace local' : 'Salvo neste navegador'}</span><div><button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={!name.trim() || referenceProcessing || !canSubmitEntry}><Sparkles size={14} />{initialAsset ? 'Salvar briefing' : 'Criar asset'}<ArrowRight size={13} /></button></div></div>
        </form>
      </section>
    </div>
  );
}

function Toast({ message }) {
  return <div className="toast-message"><span className="toast-icon"><Check size={13} /></span>{message}</div>;
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default App;
