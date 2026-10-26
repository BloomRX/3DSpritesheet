#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getComfyUiStatus, listComfyUiWorkflows } from './comfyui-client.mjs';

const SERVER_FILE = fileURLToPath(import.meta.url);
const SPRITEFORGE_HOME = path.resolve(process.env.SPRITEFORGE_HOME || path.dirname(path.dirname(SERVER_FILE)));
const PROJECT_ROOT = path.resolve(process.env.SPRITEFORGE_PROJECT_ROOT || process.cwd());
const DATA_ROOT = path.join(PROJECT_ROOT, '.spriteforge');
const ASSETS_FILE = path.join(DATA_ROOT, 'assets.json');
const TASKS_ROOT = path.join(DATA_ROOT, 'tasks');
const MCP_SERVER_NAME = 'lia-forge';
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

const CHARACTER_STAGES = [
  { id: 'direction', name: 'Direção de arte', output: 'brief.md', optional: false },
  { id: 'references', name: 'Prancha de referências', output: 'references/', optional: false },
  { id: 'model', name: 'Modelo 3D', output: '3d/model.glb', optional: false },
  { id: 'rig', name: 'Rig & animação', output: 'rig/ + animations/', optional: false },
  { id: 'spritesheet', name: 'Spritesheet 2D', output: 'sprites/ PNG + JSON', optional: false },
];
const ITEM_STAGES = [
  { id: 'direction', name: 'Direção de arte', output: 'brief.md', optional: false },
  { id: 'references', name: 'Prancha de referências', output: 'references/', optional: false },
  { id: 'model', name: 'Modelo 3D', output: '3d/model.glb', optional: false },
  { id: 'motion', name: 'Movimento & variações', output: 'motion/', optional: true },
  { id: 'spritesheet', name: 'Spritesheet 2D', output: 'sprites/ PNG + JSON', optional: false },
];

// These are catalog suggestions only. Lia Forge does not select or download a model for the user.
const FREE_MODELS = [
  {
    id: 'qwen3:4b',
    size: '2.5 GB',
    license: 'Apache-2.0',
    use: 'Opção compacta de propósito geral; confirme se o desempenho atende ao seu agente.',
    url: 'https://ollama.com/library/qwen3:4b',
  },
  {
    id: 'qwen2.5-coder:7b',
    size: '4.7 GB',
    license: 'Apache-2.0',
    use: 'Modelo de código mais leve; conferir memória disponível antes de baixar.',
    url: 'https://ollama.com/library/qwen2.5-coder:7b',
  },
  {
    id: 'qwen3:8b',
    size: '5.2 GB',
    license: 'Apache-2.0',
    use: 'Modelo geral com bom raciocínio e uso de ferramentas; requer mais memória que modelos pequenos.',
    url: 'https://ollama.com/library/qwen3:8b',
  },
  {
    id: 'qwen3-coder:30b',
    size: '19 GB',
    license: 'Apache-2.0',
    use: 'Modelo de código para máquinas com bastante memória; não é a opção padrão.',
    url: 'https://ollama.com/library/qwen3-coder:30b',
  },
];

function fail(message) {
  throw new Error(message);
}

function result(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function registerTool(server, name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      return result(await handler(args));
    } catch (error) {
      return { content: [{ type: 'text', text: `Lia Forge: ${error.message || String(error)}` }], isError: true };
    }
  });
}

function slugify(value) {
  const slug = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'asset';
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveProjectPath(relativePath, label = 'caminho') {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) {
    fail(`${label} precisa ser um caminho relativo à raiz do projeto.`);
  }
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!isInside(PROJECT_ROOT, resolved) || resolved === PROJECT_ROOT) {
    fail(`${label} precisa permanecer dentro da raiz do projeto.`);
  }
  return resolved;
}

async function assertRealProjectPath(candidate, { mustExist = false, label = 'caminho' } = {}) {
  const rootReal = await fs.realpath(PROJECT_ROOT);
  let probe = candidate;
  while (true) {
    try {
      const realProbe = await fs.realpath(probe);
      if (!isInside(rootReal, realProbe)) fail(`${label} aponta para fora do projeto (link simbólico).`);
      if (mustExist && probe === candidate) return realProbe;
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(probe);
      if (parent === probe) {
        if (mustExist) fail(`${label} não existe.`);
        return candidate;
      }
      probe = parent;
    }
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await fs.rename(tempPath, filePath);
}

async function readAssetStore() {
  await assertRealProjectPath(ASSETS_FILE, { label: 'manifesto de assets' });
  try {
    const parsed = JSON.parse(await fs.readFile(ASSETS_FILE, 'utf8'));
    if (!parsed || !Array.isArray(parsed.assets)) fail(`Formato inválido em ${ASSETS_FILE}.`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, assets: [], updatedAt: null };
    throw error;
  }
}

async function writeAssetStore(store) {
  await assertRealProjectPath(ASSETS_FILE, { label: 'manifesto de assets' });
  store.updatedAt = new Date().toISOString();
  await writeJsonAtomic(ASSETS_FILE, store);
}

function stageDefinitions(type) {
  return type === 'item' ? ITEM_STAGES : CHARACTER_STAGES;
}

function assetForNextPendingStage(asset, stages) {
  const originalStart = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  let nextStage = stages.length - 1;
  for (let index = originalStart; index < stages.length; index += 1) {
    const state = asset.stageStatus?.[index];
    if (stages[index].optional && state?.status === 'skipped') continue;
    const hasVerifiedOutputs = Array.isArray(state?.outputs) && state.outputs.length > 0;
    if (state?.status === 'completed' && (hasVerifiedOutputs || stages[index].optional)) continue;
    nextStage = index;
    break;
  }

  const existingInputs = Array.isArray(asset.existingInputs) ? [...asset.existingInputs] : [];
  for (let index = originalStart; index < nextStage; index += 1) {
    const state = asset.stageStatus?.[index];
    if (state?.status !== 'completed') continue;
    const outputs = Array.isArray(state.outputs) ? state.outputs : [];
    for (const output of outputs) {
      if (!existingInputs.some((input) => input.path === output && input.stageIndex === index)) {
        existingInputs.push({ path: output, stageIndex: index });
      }
    }
  }
  const entryPointId = ['prompt', 'brief', 'concept', 'model', 'rigged'][nextStage];
  return { ...asset, startStageIndex: nextStage, entryPointId, existingInputs };
}

function makeAssetId(name, assets) {
  const base = slugify(name);
  if (!assets.some((asset) => asset.id === base)) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function defaultOutputPath(type, id) {
  return path.posix.join('game', 'assets', type === 'character' ? 'characters' : 'items', id);
}

function formatAsset(asset) {
  const { referenceData, ...metadata } = asset;
  return metadata;
}

function makeTaskSpec(asset, agent) {
  const workflow = stageDefinitions(asset.type);
  const startAt = Math.max(0, Math.min(workflow.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  return {
    schemaVersion: '2.0',
    project: path.basename(PROJECT_ROOT),
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
      outputPath: asset.outputPath,
      animations: asset.animations || [],
      workflowId: '3d_to_2d',
      startStageIndex: startAt,
      existingInputs: asset.existingInputs || [],
    },
    workflow: workflow.map((stage, index) => ({
      id: stage.id,
      order: index + 1,
      name: stage.name,
      output: stage.output,
      optional: stage.optional,
      execution: index < startAt ? 'skip' : 'run',
    })),
    constraints: [
      'Preservar silhueta, paleta, escala e câmera entre vistas e frames.',
      'Usar câmera ortográfica fixa e PNG com alpha no export final quando aplicável.',
      'Entregar fontes editáveis e relatar honestamente ferramentas ou providers indisponíveis.',
      asset.type === 'item' ? 'Usar pivô de encaixe; não aplicar rig humanoide.' : 'Modelar, rigar e animar o personagem apenas quando essas etapas fizerem parte do ponto de entrada.',
      'Não repetir etapas anteriores ao ponto de entrada; artefatos fornecidos não são outputs desta tarefa.',
      'Não simular geração nem marcar etapa como concluída sem registrar arquivos reais e verificar que existem.',
    ],
  };
}

function makeAgentPrompt(asset, agent, taskPath) {
  const stages = stageDefinitions(asset.type);
  const startAt = Math.max(0, Math.min(stages.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  const subject = asset.type === 'character' ? 'personagem 3D rigável' : `item/prop (${asset.itemKind || 'prop'})`;
  const animations = asset.animations?.length ? asset.animations.join(', ') : 'nenhuma solicitada';
  const references = asset.references?.length
    ? asset.references.map((reference) => `- Arquivo local no projeto: ${reference.path}`).join('\n')
    : asset.referenceName
      ? `- Imagem anexada: ${asset.referenceName}. O conteúdo do browser não está acessível ao agente; baixe-a pelo painel e copie para ${asset.outputPath}/references/ antes de executar.`
      : '- Nenhuma referência local anexada.';
  const inputs = asset.existingInputs?.length
    ? asset.existingInputs.map((input) => `- Etapa ${input.stageIndex + 1} · ${stages[input.stageIndex]?.name || 'artefato existente'}: \`${input.path}\``).join('\n')
    : '- Nenhum caminho de artefato existente informado.';
  const workflowLines = stages.map((stage, index) => `${index + 1}. ${stage.name}${stage.optional ? ' (opcional)' : ''} — ${stage.output} — ${index < startAt ? 'FORNECIDA/IGNORADA; não refazer' : 'EXECUTAR'}`).join('\n');
  const outputs = stages.slice(startAt).map((stage) => `- ${asset.outputPath}/${stage.output} — ${stage.name}${stage.optional ? ' (opcional)' : ''}`).join('\n');
  return `# Lia Forge — tarefa para ${asset.name}\n\nVocê é o agente orquestrador do projeto ${path.basename(PROJECT_ROOT)}. Leia o contrato completo em \`${taskPath}\` e continue a produção a partir do ponto escolhido.\n\n## Objetivo\n- Asset: ${asset.name} (${subject})\n- Destino: \`${asset.outputPath}\`\n- Brief: ${asset.brief}\n- Prompt visual: ${asset.prompt}\n- Resolução por frame: ${asset.target || '48 × 48 px'}\n- Animações/movimentos pedidos: ${animations}\n- Agente: ${agent}\n\n## Referências\n${references}\n\n## Artefatos existentes que devem ser reutilizados\n${inputs}\n\n## Ponto de entrada\nComece na etapa ${startAt + 1} (${stages[startAt].name}). Não refaça nem marque como concluídas as etapas anteriores. Verifique que cada insumo informado existe e pode ser lido; se faltar ou for incompatível, relate o bloqueio antes de gerar.\n\n## Workflow\n${workflowLines}\n\n## Saídas esperadas nesta execução\n${outputs}\n- ${asset.outputPath}/README.md — ferramentas, versões, comandos, validações e pendências.\n\n## Regras\n- Preserve design, escala, pivô e câmera; prefira câmera ortográfica fixa e alpha transparente quando aplicável.\n- Para itens, mantenha ponto de encaixe e não aplique rig humanoide.\n- Delegue sub-tarefas delimitadas quando o agente/runtime suportar subagents; use Blender/Krita ou outros adapters somente se estiverem instalados.\n- Não invente imagens, modelos, chamadas ou resultados. Se não houver provider/software/GPU adequado, relate o bloqueio e deixe intermediários úteis.\n- Não sobrescreva arquivos existentes sem autorização. Registre apenas outputs que existam dentro de \`${asset.outputPath}\`.\n- Ao concluir uma etapa, valide o arquivo e use MCP \`spriteforge_update_stage\`; só marque concluído depois de verificar outputs reais.\n- Antes de marcar o spritesheet como pronto, valide alpha, dimensões, padding, pivô, ordem dos frames e metadados.\n`;
}

function toolAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 2500, windowsHide: true, shell: process.platform === 'win32' });
  if (result.error?.code === 'ENOENT') return { installed: false, version: null };
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/)[0];
  return { installed: result.status === 0 || !result.error, version: output || null };
}

async function ollamaStatus() {
  const base = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const cli = toolAvailable(process.platform === 'win32' ? 'ollama.exe' : 'ollama', ['--version']);
  const api = await new Promise((resolve) => {
    let request;
    try {
      const target = new URL(`${base}/api/tags`);
      const transport = target.protocol === 'https:' ? https : http;
      request = transport.get(target, { timeout: 1500 }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (part) => { body += part; });
        response.on('end', () => {
          if (response.statusCode !== 200) return resolve({ running: false, models: [] });
          try {
            const parsed = JSON.parse(body);
            resolve({ running: true, models: (parsed.models || []).map((model) => model.name) });
          } catch {
            resolve({ running: false, models: [] });
          }
        });
      });
      request.on('timeout', () => request.destroy());
      request.on('error', () => resolve({ running: false, models: [] }));
    } catch {
      resolve({ running: false, models: [] });
    }
  });
  return { ...cli, endpoint: base, ...api };
}

async function checkPanel(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok || !(await response.text()).includes('<title>Lia Forge')) return false;
    const storeResponse = await fetch(`http://127.0.0.1:${port}/api/spriteforge/assets`, { signal: AbortSignal.timeout(1200) });
    if (!storeResponse.ok) return false;
    const store = await storeResponse.json();
    return path.resolve(store.projectRoot || '') === PROJECT_ROOT;
  } catch {
    return false;
  }
}

async function waitForPanel(port, child, logFd, getSpawnError) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await checkPanel(port)) return true;
    if (child.exitCode !== null || getSpawnError()) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (child.exitCode === null && !getSpawnError()) child.kill('SIGTERM');
  try { fsSync.closeSync(logFd); } catch { /* already closed */ }
  return false;
}

const server = new McpServer({
  name: MCP_SERVER_NAME,
  version: '0.1.0',
});

registerTool(server, 'spriteforge_get_status', {
  title: 'Diagnóstico da Lia Forge',
  description: 'Verifica o workspace, as ferramentas locais e se Ollama está ativo. Não instala nem baixa nada.',
  inputSchema: {},
}, async () => {
  const [ollama, store, comfyui] = await Promise.all([ollamaStatus(), readAssetStore(), getComfyUiStatus()]);
  const tools = Object.fromEntries(['opencode', 'claude', 'codex', 'blender', 'krita', 'comfy', 'comfy-mcp'].map((name) => [name, toolAvailable(name)]));
  return {
    liaForgeHome: SPRITEFORGE_HOME,
    projectRoot: PROJECT_ROOT,
    assetsFile: ASSETS_FILE,
    assetCount: store.assets.length,
    tools: { ...tools, ollama, comfyui },
    note: 'O MCP registra briefs/tarefas e consulta o ComfyUI local. Não instala ComfyUI, não baixa pesos e não inicia workflows; geração 3D, rig, animações e spritesheets ainda dependem de adapters externos.',
  };
});

registerTool(server, 'spriteforge_comfyui_status', {
  title: 'Status local do ComfyUI',
  description: 'Consulta a API local do ComfyUI, a fila, dispositivos reportados e modelos conhecidos. É somente leitura; não inicia nem cancela tarefas e não baixa pesos.',
  inputSchema: {},
}, async () => getComfyUiStatus());

registerTool(server, 'spriteforge_list_comfyui_workflows', {
  title: 'Listar workflows de conceito',
  description: 'Lista os dois templates JSON ComfyUI API incluídos no pack. Os arquivos são rascunhos de conceito e exigem um checkpoint compatível selecionado pelo usuário.',
  inputSchema: {},
}, async () => ({
  workflows: await listComfyUiWorkflows(),
  note: 'Templates de conceito apenas; não geram modelo 3D, rig, animação ou spritesheet. Nenhum peso foi selecionado ou baixado.',
}));

registerTool(server, 'spriteforge_list_free_models', {
  title: 'Opções de modelos locais',
  description: 'Lista exemplos de modelos open-weight disponíveis via Ollama. Apenas informa; não seleciona, instala nem baixa pesos.',
  inputSchema: {},
}, async () => ({
  runtime: 'Ollama (local)',
  agent: 'OpenCode (CLI)',
  models: FREE_MODELS,
  note: 'Os tamanhos são aproximados; memória necessária depende de contexto, quantização e hardware. Revise a licença e a ficha oficial antes de baixar. Nenhum modelo vem selecionado.',
}));

registerTool(server, 'spriteforge_list_assets', {
  title: 'Listar assets do workspace',
  description: 'Lista os briefs de personagens e itens registrados no workspace atual.',
  inputSchema: {},
}, async () => {
  const store = await readAssetStore();
  return { projectRoot: PROJECT_ROOT, assets: store.assets.map(formatAsset) };
});

registerTool(server, 'spriteforge_create_asset', {
  title: 'Criar brief de asset',
  description: 'Registra um personagem ou item para o fluxo 3D→2D. Permite retomar a partir de artefatos existentes; não gera imagens nem modelos.',
  inputSchema: {
    name: z.string().trim().min(1).max(120),
    type: z.enum(['character', 'item']),
    brief: z.string().trim().min(1).max(8000),
    visualPrompt: z.string().trim().min(1).max(8000),
    itemKind: z.enum(['weapon', 'tool', 'prop', 'consumable']).optional(),
    workflowId: z.literal('3d_to_2d').default('3d_to_2d'),
    entryPointId: z.enum(['prompt', 'brief', 'concept', 'model', 'rigged']).optional(),
    startStageIndex: z.number().int().min(0).max(4).default(0),
    existingInputs: z.array(z.object({
      path: z.string().trim().min(1).max(500),
      stageIndex: z.number().int().min(0).max(4),
    }).strict()).max(20).default([]),
    animations: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    targetFrameSize: z.string().trim().min(1).max(40).default('48 × 48 px'),
    outputPath: z.string().trim().min(1).max(240).optional(),
  },
}, async (input) => {
  if (input.type === 'item' && !input.itemKind) fail('Para um item, informe itemKind: weapon, tool, prop ou consumable.');
  const entryPointByStage = ['prompt', 'brief', 'concept', 'model', 'rigged'];
  const entryPointId = input.entryPointId || entryPointByStage[input.startStageIndex];
  if (entryPointByStage[input.startStageIndex] !== entryPointId) fail('entryPointId não corresponde ao startStageIndex informado.');
  if (input.existingInputs.some((source) => source.stageIndex >= input.startStageIndex)) {
    fail('Cada artefato existente precisa pertencer a uma etapa anterior ao ponto de entrada.');
  }
  const store = await readAssetStore();
  const id = makeAssetId(input.name, store.assets);
  const outputPath = input.outputPath || defaultOutputPath(input.type, id);
  resolveProjectPath(outputPath, 'outputPath');
  const stageStatus = stageDefinitions(input.type).map(() => ({ status: 'pending', outputs: [], note: '' }));
  const asset = {
    id,
    type: input.type,
    itemKind: input.type === 'item' ? input.itemKind : undefined,
    name: input.name,
    subtitle: input.type === 'character' ? 'Novo personagem' : `Item · ${input.itemKind}`,
    role: input.type === 'character' ? 'PERSONAGEM · NOVO' : `ITEM · ${input.itemKind.toUpperCase()}`,
    brief: input.brief,
    prompt: input.visualPrompt,
    workflowId: input.workflowId,
    entryPointId,
    startStageIndex: input.startStageIndex,
    existingInputs: input.existingInputs,
    animations: [...new Set(input.animations)],
    completed: [false, false, false, false, false],
    stageStatus,
    target: input.targetFrameSize,
    outputPath,
    references: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.assets.unshift(asset);
  await writeAssetStore(store);
  return { asset: formatAsset(asset), savedTo: ASSETS_FILE };
});

registerTool(server, 'spriteforge_add_reference', {
  title: 'Anexar referência local',
  description: 'Copia uma imagem existente dentro do workspace para a pasta de referências do asset; nunca busca ou baixa imagens da internet.',
  inputSchema: {
    assetId: z.string().trim().min(1).max(120),
    sourcePath: z.string().trim().min(1).max(500),
  },
}, async ({ assetId, sourcePath }) => {
  const source = resolveProjectPath(sourcePath, 'sourcePath');
  await assertRealProjectPath(source, { mustExist: true, label: 'sourcePath' });
  const stat = await fs.stat(source);
  if (!stat.isFile()) fail('A referência precisa ser um arquivo.');
  if (stat.size > MAX_REFERENCE_BYTES) fail(`A referência excede o limite de ${MAX_REFERENCE_BYTES / 1024 / 1024} MB.`);
  const extension = path.extname(source).toLowerCase();
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  if (!allowed.has(extension)) fail('Formato não aceito. Use PNG, JPG ou WEBP.');
  const store = await readAssetStore();
  const asset = store.assets.find((candidate) => candidate.id === assetId);
  if (!asset) fail(`Asset não encontrado: ${assetId}`);
  const referenceDirectory = resolveProjectPath(path.posix.join('.spriteforge', 'assets', asset.id, 'references'));
  await assertRealProjectPath(referenceDirectory, { label: 'pasta de referências' });
  await fs.mkdir(referenceDirectory, { recursive: true });
  const safeName = `${slugify(path.basename(source, extension))}${extension}`;
  const destination = path.join(referenceDirectory, safeName);
  try {
    await fs.copyFile(source, destination, fsSync.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === 'EEXIST') fail(`A referência já existe: ${path.relative(PROJECT_ROOT, destination)}.`);
    throw error;
  }
  const relativeDestination = path.relative(PROJECT_ROOT, destination).split(path.sep).join('/');
  asset.references = [...(asset.references || []), { name: path.basename(source), path: relativeDestination }];
  asset.updatedAt = new Date().toISOString();
  await writeAssetStore(store);
  return { assetId, reference: relativeDestination, savedTo: ASSETS_FILE };
});

registerTool(server, 'spriteforge_prepare_task', {
  title: 'Preparar handoff para agente',
  description: 'Escreve task JSON v2 e prompt Markdown no workspace atual; valida artefatos existentes antes do handoff e só cria brief.md quando a tarefa começa pela direção de arte.',
  inputSchema: {
    assetId: z.string().trim().min(1).max(120),
    agent: z.enum(['claude', 'codex', 'opencode', 'agnostic']).default('agnostic'),
  },
}, async ({ assetId, agent }) => {
  const store = await readAssetStore();
  const storedAsset = store.assets.find((candidate) => candidate.id === assetId);
  if (!storedAsset) fail(`Asset não encontrado: ${assetId}`);
  const stages = stageDefinitions(storedAsset.type);
  const asset = assetForNextPendingStage(storedAsset, stages);
  const startStageIndex = asset.startStageIndex;
  for (const [index, source] of (Array.isArray(asset.existingInputs) ? asset.existingInputs : []).entries()) {
    if (!source || typeof source.path !== 'string' || !Number.isInteger(source.stageIndex) || source.stageIndex < 0 || source.stageIndex >= startStageIndex || source.stageIndex >= stages.length) {
      fail(`Artefato existente #${index + 1} tem etapa/caminho inválido ou não é anterior ao ponto de entrada.`);
    }
    const sourcePath = resolveProjectPath(source.path, `existingInputs[${index}].path`);
    const realSource = await assertRealProjectPath(sourcePath, { mustExist: true, label: `existingInputs[${index}].path` });
    const sourceStat = await fs.stat(realSource);
    if (!sourceStat.isFile() && !sourceStat.isDirectory()) fail(`Artefato existente não é arquivo ou pasta: ${source.path}`);
  }
  const assetOutput = resolveProjectPath(asset.outputPath, 'outputPath');
  await assertRealProjectPath(assetOutput, { label: 'outputPath' });
  const taskDirectory = resolveProjectPath(path.posix.join('.spriteforge', 'tasks', asset.id));
  await assertRealProjectPath(taskDirectory, { label: 'pasta da tarefa' });
  await fs.mkdir(taskDirectory, { recursive: true });
  await fs.mkdir(assetOutput, { recursive: true });
  const taskFile = path.join(taskDirectory, 'sprite-task.json');
  const promptFile = path.join(taskDirectory, 'agent-prompt.md');
  const taskRelative = path.relative(PROJECT_ROOT, taskFile).split(path.sep).join('/');
  const prompt = makeAgentPrompt(asset, agent, taskRelative);
  const spec = makeTaskSpec(asset, agent);
  await writeJsonAtomic(taskFile, spec);
  await fs.writeFile(promptFile, `${prompt}\n`, 'utf8');
  let briefRelative = null;
  if (startStageIndex === 0) {
    const briefFile = path.join(assetOutput, 'brief.md');
    try {
      await fs.writeFile(briefFile, `# ${asset.name}\n\n${asset.brief}\n\n## Prompt visual\n\n${asset.prompt}\n\n## Animações / movimentos pedidos\n\n${asset.animations?.length ? asset.animations.map((animation) => `- ${animation}`).join('\n') : '- Nenhum solicitado.'}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    briefRelative = path.relative(PROJECT_ROOT, briefFile).split(path.sep).join('/');
  }
  return {
    assetId,
    task: path.relative(PROJECT_ROOT, taskFile).split(path.sep).join('/'),
    prompt: path.relative(PROJECT_ROOT, promptFile).split(path.sep).join('/'),
    outputPath: asset.outputPath,
    brief: briefRelative,
    schema: path.join(SPRITEFORGE_HOME, 'docs', 'asset-task.schema.json'),
    note: 'Handoff criado; nenhum agente foi iniciado e nenhum artefato 3D/2D foi gerado.',
  };
});

registerTool(server, 'spriteforge_update_stage', {
  title: 'Atualizar etapa e outputs',
  description: 'Registra status de etapa do pipeline. Ao concluir, exige caminhos de arquivos que existam dentro da pasta do asset.',
  inputSchema: {
    assetId: z.string().trim().min(1).max(120),
    stageIndex: z.number().int().min(0).max(4),
    status: z.enum(['pending', 'in_progress', 'blocked', 'completed']),
    outputs: z.array(z.string().trim().min(1).max(500)).max(40).default([]),
    note: z.string().max(2000).default(''),
  },
}, async ({ assetId, stageIndex, status, outputs, note }) => {
  const store = await readAssetStore();
  const asset = store.assets.find((candidate) => candidate.id === assetId);
  if (!asset) fail(`Asset não encontrado: ${assetId}`);
  const definitions = stageDefinitions(asset.type);
  if (stageIndex >= definitions.length) fail(`Etapa inválida para ${asset.type}.`);
  const startStageIndex = Math.max(0, Math.min(definitions.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  if (stageIndex < startStageIndex && status !== 'pending') {
    fail(`A etapa ${stageIndex + 1} fica antes do ponto de entrada. Não a marque como ativa/concluída nesta tarefa.`);
  }
  if (status === 'completed') {
    for (let previous = startStageIndex; previous < stageIndex; previous += 1) {
      if (definitions[previous].optional) continue;
      if (asset.stageStatus?.[previous]?.status !== 'completed') {
        fail(`Registre outputs reais e conclua a etapa ${previous + 1} (${definitions[previous].name}) antes de marcar esta etapa.`);
      }
    }
    if (outputs.length === 0 && !(asset.type === 'item' && stageIndex === 3)) {
      fail('Informe ao menos um output existente para concluir a etapa.');
    }
  }
  const assetDirectory = resolveProjectPath(asset.outputPath, 'outputPath');
  const verifiedOutputs = [];
  for (const relativePath of outputs) {
    const output = resolveProjectPath(relativePath, 'output');
    const referenceDirectory = resolveProjectPath(path.posix.join('.spriteforge', 'assets', asset.id, 'references'));
    const insideAsset = isInside(assetDirectory, output) && output !== assetDirectory;
    const insideReferences = stageIndex === 1 && isInside(referenceDirectory, output) && output !== referenceDirectory;
    if (!insideAsset && !insideReferences) {
      fail(`Output fora da pasta do asset/referências: ${relativePath}`);
    }
    const realOutput = await assertRealProjectPath(output, { mustExist: status === 'completed', label: `output ${relativePath}` });
    if (status === 'completed') {
      const stat = await fs.stat(realOutput);
      if (!stat.isFile() && !stat.isDirectory()) fail(`Output não é arquivo ou pasta: ${relativePath}`);
    }
    verifiedOutputs.push(path.relative(PROJECT_ROOT, output).split(path.sep).join('/'));
  }
  asset.stageStatus ||= definitions.map(() => ({ status: 'pending', outputs: [], note: '' }));
  asset.stageStatus[stageIndex] = { status, outputs: verifiedOutputs, note };
  asset.completed ||= [false, false, false, false, false];
  asset.completed[stageIndex] = status === 'completed';
  if (status !== 'completed') {
    for (let later = stageIndex + 1; later < asset.completed.length; later += 1) {
      asset.completed[later] = false;
      if (asset.stageStatus[later]) asset.stageStatus[later] = { status: 'pending', outputs: [], note: '' };
    }
  }
  asset.updatedAt = new Date().toISOString();
  await writeAssetStore(store);
  return { assetId, stage: definitions[stageIndex].name, status, outputs: verifiedOutputs, savedTo: ASSETS_FILE };
});

registerTool(server, 'spriteforge_open_panel', {
  title: 'Abrir o painel local',
  description: 'Inicia o painel Vite local se ainda não estiver rodando e devolve sua URL. Não instala dependências nem abre uma janela do navegador.',
  inputSchema: {
    port: z.number().int().min(1024).max(65535).default(5173),
  },
}, async ({ port }) => {
  if (await checkPanel(port)) return { url: `http://localhost:${port}`, alreadyRunning: true, projectRoot: PROJECT_ROOT };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmStatus = spawnSync(npm, ['--version'], { encoding: 'utf8', timeout: 3000, shell: process.platform === 'win32', windowsHide: true });
  if (npmStatus.error || npmStatus.status !== 0) fail(`npm não está disponível: ${npmStatus.error?.message || 'comando falhou'}`);
  const logDirectory = path.join(DATA_ROOT, 'logs');
  await assertRealProjectPath(logDirectory, { label: 'pasta de logs' });
  await fs.mkdir(logDirectory, { recursive: true });
  const logPath = path.join(logDirectory, 'panel.log');
  const logFd = fsSync.openSync(logPath, 'a');
  const child = spawn(npm, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
    cwd: SPRITEFORGE_HOME,
    env: { ...process.env, SPRITEFORGE_PROJECT_ROOT: PROJECT_ROOT },
    stdio: ['ignore', logFd, logFd],
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  let spawnError = null;
  child.on('error', (error) => { spawnError = error; });
  child.unref();
  const ready = await waitForPanel(port, child, logFd, () => spawnError);
  if (!ready) {
    const logTail = await fs.readFile(logPath, 'utf8').catch(() => '');
    fail(`Não foi possível iniciar Lia Forge na porta ${port}. ${spawnError ? spawnError.message : `Consulte ${logPath}. ${logTail.slice(-1200)}`}`);
  }
  try { fsSync.closeSync(logFd); } catch { /* already closed */ }
  return { url: `http://localhost:${port}`, alreadyRunning: false, projectRoot: PROJECT_ROOT, log: path.relative(PROJECT_ROOT, logPath).split(path.sep).join('/') };
});

const transport = new StdioServerTransport();
await server.connect(transport);
