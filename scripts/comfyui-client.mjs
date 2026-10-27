import fs from 'node:fs/promises';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pngValidation from '../electron/png-validation.cjs';

const { validatePngBuffer } = pngValidation;

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

async function request(endpoint, pathname, { method = 'GET', body, signal, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS, maxResponseBytes = 32 * 1024 * 1024 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(new URL(pathname, `${endpoint}/`), {
      method,
      headers: { Accept: 'application/json', ...headers },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxResponseBytes) throw new Error('Resposta do ComfyUI excede o limite de tamanho permitido.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxResponseBytes) throw new Error('Resposta do ComfyUI excede o limite de tamanho permitido.');
    return { bytes, headers: response.headers };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function getJson(endpoint, pathname, options = {}) {
  const { bytes } = await request(endpoint, pathname, options);
  return JSON.parse(bytes.toString('utf8'));
}

async function postJson(endpoint, pathname, value, options = {}) {
  const { bytes } = await request(endpoint, pathname, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(value),
  });
  return JSON.parse(bytes.toString('utf8'));
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
      note: 'Esta consulta é somente leitura. A Lia Forge só envia um workflow após ação explícita e escolha de checkpoint já instalado; não baixa pesos nem instala o ComfyUI.',
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

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Execução cancelada.'), { code: 'WORKFLOW_CANCELLED' }));
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(Object.assign(new Error('Execução cancelada. O ComfyUI pode continuar o job já enviado.'), { code: 'WORKFLOW_CANCELLED' }));
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function safeWorkflowPrefix(value) {
  const slug = String(value || 'asset').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'asset';
  return `LiaForge/${slug}`;
}

function imagesFromHistory(entry) {
  if (!entry || typeof entry !== 'object' || !entry.outputs || typeof entry.outputs !== 'object') return [];
  return Object.values(entry.outputs).flatMap((output) => Array.isArray(output?.images) ? output.images : [])
    .filter((image) => image && typeof image.filename === 'string' && image.filename.trim());
}

export async function runComfyUiConcept({ workflowId, prompt, checkpoint, outputDirectory, signal, onProgress = async () => {}, timeoutMs = 20 * 60 * 1000 } = {}) {
  if (typeof checkpoint !== 'string' || !checkpoint.trim()) throw Object.assign(new Error('Escolha um checkpoint já instalado no ComfyUI antes de gerar.'), { code: 'WORKFLOW_BLOCKED' });
  if (typeof prompt !== 'string' || prompt.trim().length < 12 || prompt.length > 8000) throw new Error('O prompt precisa ter entre 12 e 8000 caracteres.');
  if (typeof outputDirectory !== 'string' || !path.isAbsolute(outputDirectory)) throw new Error('A pasta de saída precisa ser um caminho absoluto local.');
  const endpoint = getComfyUiEndpoint();
  const workflow = await readComfyUiWorkflow(workflowId);
  const installedCheckpoints = await getJson(endpoint, '/models/checkpoints', { signal });
  if (!Array.isArray(installedCheckpoints) || !installedCheckpoints.includes(checkpoint)) {
    throw Object.assign(new Error('O checkpoint selecionado não aparece na lista de modelos instalados do ComfyUI. Nada foi baixado.'), { code: 'WORKFLOW_BLOCKED' });
  }
  const graph = structuredClone(workflow.workflow);
  if (!graph['1']?.inputs || !graph['2']?.inputs || !graph['5']?.inputs || !graph['7']?.inputs) {
    throw new Error('O template não contém os nós esperados para geração de conceito.');
  }
  graph['1'].inputs.ckpt_name = checkpoint;
  const basePrompt = String(graph['2'].inputs.text || '').trim();
  graph['2'].inputs.text = `${prompt.trim()}\n\n${basePrompt}`.slice(0, 12000);
  graph['5'].inputs.seed = randomInt(1, 2_147_483_647);
  graph['7'].inputs.filename_prefix = `${safeWorkflowPrefix(workflowId)}/${randomUUID()}`;

  await fs.mkdir(outputDirectory, { recursive: true });
  await onProgress({ message: 'Enviando o workflow ao ComfyUI configurado.' });
  const queued = await postJson(endpoint, '/prompt', { prompt: graph, client_id: randomUUID() }, { signal, timeoutMs: 15000 });
  if (queued?.error || queued?.node_errors || typeof queued?.prompt_id !== 'string' || !queued.prompt_id) {
    throw new Error(`O ComfyUI recusou o workflow: ${JSON.stringify(queued?.error || queued?.node_errors || queued).slice(0, 1000)}`);
  }
  const promptId = queued.prompt_id;
  const deadline = Date.now() + timeoutMs;
  let pollCount = 0;
  let historyEntry = null;
  await onProgress({ message: 'Workflow aceito; aguardando o ComfyUI gerar a imagem.' });

  while (Date.now() < deadline) {
    if (signal?.aborted) throw Object.assign(new Error('Execução cancelada. O ComfyUI pode continuar o job já enviado.'), { code: 'WORKFLOW_CANCELLED' });
    await delay(1200, signal);
    pollCount += 1;
    let history;
    try { history = await getJson(endpoint, `/history/${encodeURIComponent(promptId)}`, { signal }); }
    catch (error) {
      if (signal?.aborted) throw Object.assign(new Error('Execução cancelada. O ComfyUI pode continuar o job já enviado.'), { code: 'WORKFLOW_CANCELLED' });
      if (/^HTTP 4\d\d$/.test(error.message || '')) throw new Error(`ComfyUI recusou a consulta do histórico: ${error.message}.`);
      await onProgress({ message: `Aguardando resposta do ComfyUI · consulta ${pollCount}.` });
      continue;
    }
    historyEntry = history?.[promptId] || history;
    const statusText = String(historyEntry?.status?.status_str || '').toLowerCase();
    if (statusText === 'error') {
      const detail = JSON.stringify(historyEntry.status?.messages || historyEntry.status || {}).slice(0, 1000);
      throw new Error(`O ComfyUI reportou falha no workflow.${detail ? ` ${detail}` : ''}`);
    }
    const images = imagesFromHistory(historyEntry);
    if (historyEntry?.status?.completed === true && images.length > 8) throw new Error('O ComfyUI retornou imagens demais para este workflow; nenhum output será registrado.');
    if (historyEntry?.status?.completed === true && images.length) {
      const saved = [];
      for (const [index, image] of images.entries()) {
        const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output' });
        const { bytes } = await request(endpoint, `/view?${query.toString()}`, { signal, headers: { Accept: 'image/png' }, timeoutMs: 30000, maxResponseBytes: 100 * 1024 * 1024 });
        try { validatePngBuffer(bytes); } catch (error) {
          throw new Error(`O ComfyUI retornou um PNG inválido: ${error.message}`);
        }
        const outputPath = path.join(outputDirectory, `concept-${randomUUID()}-${index + 1}.png`);
        await fs.writeFile(outputPath, bytes, { flag: 'wx' });
        saved.push(outputPath);
      }
      await onProgress({ message: `${saved.length} imagem(ns) real(is) salva(s); validando o PNG e registrando o output.` });
      return { promptId, checkpoint, workflowId, outputs: saved };
    }
    if (historyEntry?.status?.completed === true) throw new Error('O ComfyUI concluiu o workflow sem retornar imagens.');
    await onProgress({ message: `Aguardando conclusão no ComfyUI · consulta ${pollCount}.` });
  }
  throw Object.assign(new Error('Tempo limite aguardando o ComfyUI. O workflow pode continuar na fila externa.'), { code: 'WORKFLOW_TIMEOUT', promptId });
}
