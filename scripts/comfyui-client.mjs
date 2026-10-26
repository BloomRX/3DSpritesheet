import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_ROOT = path.resolve(SCRIPT_DIR, '..', 'workflows', 'comfyui');
const MODEL_FOLDERS = ['checkpoints', 'loras', 'vae', 'controlnet'];
const REQUEST_TIMEOUT_MS = 1400;

const WORKFLOW_DEFINITIONS = [
  {
    id: 'character-concept',
    file: 'lia-forge-character-concept-api.json',
    title: 'Concept sheet · personagem',
    subject: 'character',
    description: 'Uma imagem de exploração visual com vistas de referência; não cria um modelo 3D nem garante consistência ortográfica.',
  },
  {
    id: 'item-concept',
    file: 'lia-forge-item-concept-api.json',
    title: 'Concept sheet · item',
    subject: 'item',
    description: 'Uma imagem de exploração visual para arma, ferramenta ou prop; não cria um modelo 3D nem exporta sprites.',
  },
];

export function getComfyUiEndpoint() {
  const configured = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('COMFYUI_URL precisa ser uma URL HTTP ou HTTPS válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('COMFYUI_URL precisa ser uma URL HTTP ou HTTPS sem credenciais, query ou fragmento.');
  }
  return url.origin;
}

async function getJson(endpoint, pathname) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL(pathname, `${endpoint}/`), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function queueEntries(queue, key) {
  return Array.isArray(queue?.[key]) ? queue[key] : [];
}

function summarizeDevices(stats) {
  return (Array.isArray(stats?.devices) ? stats.devices : []).map((device) => ({
    name: typeof device?.name === 'string' ? device.name : 'Dispositivo sem nome',
    type: typeof device?.type === 'string' ? device.type : null,
    index: Number.isInteger(device?.index) ? device.index : null,
    vramTotalBytes: Number.isFinite(device?.vram_total) ? device.vram_total : null,
    vramFreeBytes: Number.isFinite(device?.vram_free) ? device.vram_free : null,
  }));
}

function modelNames(response) {
  return Array.isArray(response) ? response.filter((item) => typeof item === 'string') : [];
}

function friendlyConnectionError(error) {
  if (error?.name === 'AbortError') return 'Tempo limite ao consultar o ComfyUI.';
  if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(error?.cause?.code) || error?.message === 'fetch failed') {
    return 'Não foi possível conectar. Confira se o ComfyUI está em execução e se COMFYUI_URL está correto.';
  }
  return error?.message || 'ComfyUI indisponível.';
}

export async function getComfyUiStatus({ includeModels = true } = {}) {
  let endpoint;
  try {
    endpoint = getComfyUiEndpoint();
    const [statsResult, queueResult, ...modelResults] = await Promise.allSettled([
      getJson(endpoint, '/system_stats'),
      getJson(endpoint, '/queue'),
      ...(includeModels ? MODEL_FOLDERS.map((folder) => getJson(endpoint, `/models/${folder}`)) : []),
    ]);

    if (statsResult.status !== 'fulfilled' && queueResult.status !== 'fulfilled') {
      throw statsResult.reason || queueResult.reason || new Error('ComfyUI não respondeu.');
    }

    const stats = statsResult.status === 'fulfilled' ? statsResult.value : {};
    const queue = queueResult.status === 'fulfilled' ? queueResult.value : {};
    const runningEntries = queueEntries(queue, 'queue_running');
    const pendingEntries = queueEntries(queue, 'queue_pending');
    const models = {};
    const warnings = [];

    if (includeModels) {
      MODEL_FOLDERS.forEach((folder, index) => {
        const result = modelResults[index];
        if (result?.status === 'fulfilled') models[folder] = modelNames(result.value);
        else {
          models[folder] = null;
          warnings.push(`Não foi possível listar ${folder}.`);
        }
      });
    }

    const system = stats.system || {};
    return {
      connected: true,
      endpoint,
      version: system.comfyui_version || stats.comfyui_version || null,
      pythonVersion: system.python_version || stats.python_version || null,
      torchVersion: system.torch_version || stats.torch_version || null,
      devices: summarizeDevices(stats),
      queue: { running: runningEntries.length, pending: pendingEntries.length },
      models: includeModels ? models : null,
      modelCount: includeModels
        ? Object.values(models).reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0)
        : null,
      warnings,
      note: 'Leitura somente. A Lia Forge não inicia workflows, não baixa pesos e não altera a fila do ComfyUI.',
    };
  } catch (error) {
    return {
      connected: false,
      endpoint: endpoint || process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
      version: null,
      pythonVersion: null,
      torchVersion: null,
      devices: [],
      queue: { running: 0, pending: 0 },
      models: includeModels ? null : null,
      modelCount: null,
      warnings: [],
      error: friendlyConnectionError(error),
      note: 'Nenhuma instalação ou execução foi iniciada. Configure o ComfyUI localmente e atualize para consultar novamente.',
    };
  }
}

export async function listComfyUiWorkflows() {
  const entries = await Promise.all(WORKFLOW_DEFINITIONS.map(async (workflow) => {
    try {
      const filename = path.join(WORKFLOW_ROOT, workflow.file);
      const contents = await fs.readFile(filename, 'utf8');
      const parsed = JSON.parse(contents);
      return {
        ...workflow,
        available: true,
        format: 'ComfyUI API JSON',
        filename: workflow.file,
        nodeCount: Object.keys(parsed).length,
        requiresModelSelection: true,
      };
    } catch {
      return { ...workflow, available: false, format: 'ComfyUI API JSON', filename: workflow.file, nodeCount: null, requiresModelSelection: true };
    }
  }));
  return entries;
}

export async function readComfyUiWorkflow(workflowId) {
  const definition = WORKFLOW_DEFINITIONS.find((workflow) => workflow.id === workflowId);
  if (!definition) throw new Error('Template ComfyUI desconhecido.');
  const filePath = path.join(WORKFLOW_ROOT, definition.file);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${WORKFLOW_ROOT}${path.sep}`)) throw new Error('Caminho do template inválido.');
  const contents = await fs.readFile(resolved, 'utf8');
  const workflow = JSON.parse(contents);
  if (!workflow || Array.isArray(workflow) || typeof workflow !== 'object') throw new Error('JSON de workflow inválido.');
  return { id: definition.id, filename: definition.file, workflow };
}
