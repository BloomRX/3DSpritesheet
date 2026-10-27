const { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { ManagedProcessRegistry, buildCloseReport } = require('./task-manager.cjs');
const {
  isInside: isPathInside,
  resolveAssetDirectory,
  stageDirectory,
  stageFilters,
  stageLabel,
  validateStageOutputs,
} = require('./manual-artifacts.cjs');
const { getExternalToolStatus, findExternalTool, launchApplication, launchExternalTool } = require('./external-tools.cjs');
const { WorkflowRunner } = require('./workflow-runner.cjs');
const { validatePngBuffer } = require('./png-validation.cjs');
const {
  buildBlenderSpritesheetArgs,
  findModelInput,
  parseFrameSize,
  runProcess,
  spawnBlender,
  validateSpritesheetFiles,
} = require('./blender-adapter.cjs');
const { isTrustedNavigation: matchesTrustedNavigation } = require('./navigation-guard.cjs');

const APP_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
const ASSET_STORE_MAX_BYTES = 24 * 1024 * 1024;
const taskRegistry = new ManagedProcessRegistry();
let mainWindow = null;
let viteServer = null;
let devOrigin = null;
let projectRoot = null;
let reportedActivities = [];
let approvedClose = false;
let closePromptOpen = false;
let comfyClientPromise = null;
const workflowRunner = new WorkflowRunner({
  adapters: {
    'blender-spritesheet': async ({ asset, inputPath, outputDirectory, scriptPath, frameSize, projectRoot: runProjectRoot, signal, reportProgress }) => {
      const executable = findExternalTool('blender');
      if (!executable) throw Object.assign(new Error('Blender não foi detectado. Instale/adicione o aplicativo por conta própria ou escolha um adapter compatível.'), { code: 'WORKFLOW_BLOCKED' });
      const args = buildBlenderSpritesheetArgs({ scriptPath, inputPath, outputDirectory, asset, frameSize });
      const { child } = taskRegistry.start(`Lia Forge · spritesheet · ${asset.name}`, executable, args, {
        cwd: outputDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await runProcess(child, { signal, onProgress: reportProgress });
      const pngPath = path.join(outputDirectory, 'spritesheet.png');
      const metadataPath = path.join(outputDirectory, 'spritesheet.json');
      const realPngPath = await assertPathInsideProject(pngPath, { mustExist: true, label: 'Spritesheet PNG' });
      const realMetadataPath = await assertPathInsideProject(metadataPath, { mustExist: true, label: 'Metadados JSON' });
      const [pngBuffer, metadataContents] = await Promise.all([fs.readFile(realPngPath), fs.readFile(realMetadataPath, 'utf8')]);
      let metadata;
      try { metadata = JSON.parse(metadataContents); } catch { throw new Error('O Blender gerou um JSON de metadados inválido.'); }
      const checked = validateSpritesheetFiles({ pngBuffer, metadata, frameSize });
      const outputs = [realPngPath, realMetadataPath].map((output) => path.relative(runProjectRoot, output).split(path.sep).join('/'));
      validateStageOutputs(asset.type, 4, outputs);
      return {
        outputs,
        note: `Blender renderizou ${checked.frameCount} frames reais em ${checked.sheetWidth}×${checked.sheetHeight}px; revise visualmente a consistência e o pivô.`,
      };
    },
    'comfyui-concept': async ({ asset, outputDirectory, projectRoot: runProjectRoot, prompt, checkpoint, workflowId, signal, reportProgress }) => {
      const client = await getWorkflowClient();
      const result = await client.runComfyUiConcept({ workflowId, prompt, checkpoint, outputDirectory, signal, onProgress: reportProgress });
      const outputs = [];
      for (const outputPath of result.outputs) {
        const realPath = await assertPathInsideProject(outputPath, { mustExist: true, label: 'Concept PNG do ComfyUI' });
        const bytes = await fs.readFile(realPath);
        validatePngBuffer(bytes);
        outputs.push(path.relative(runProjectRoot, realPath).split(path.sep).join('/'));
      }
      validateStageOutputs(asset.type, 1, outputs);
      return {
        outputs,
        promptId: result.promptId,
        checkpoint: result.checkpoint,
        note: `ComfyUI gerou e validou ${outputs.length} imagem(ns) usando o checkpoint já instalado “${result.checkpoint}”. Revise a arte; ela não é um modelo 3D nem garante vistas ortográficas.`,
      };
    },
  },
  persist: persistWorkflowRun,
  onEvent: (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lia-forge:workflow:event', event);
  },
});

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isTrustedNavigation(destination) {
  return matchesTrustedNavigation(destination, { isPackaged: app.isPackaged, appRoot: APP_ROOT, devOrigin });
}

function blockUntrustedNavigation(event, destination) {
  if (!isTrustedNavigation(destination)) event.preventDefault();
}

function getWorkflowClient() {
  if (!comfyClientPromise) {
    const clientPath = path.join(APP_ROOT, 'scripts', 'comfyui-client.mjs');
    comfyClientPromise = import(pathToFileURL(clientPath).href);
  }
  return comfyClientPromise;
}

async function assertPathInsideProject(candidate, { mustExist = false, label = 'caminho' } = {}) {
  const rootReal = await fs.realpath(projectRoot);
  let probe = candidate;
  while (true) {
    try {
      const realPath = await fs.realpath(probe);
      if (!inside(rootReal, realPath)) throw new Error(`${label} aponta para fora da pasta do projeto.`);
      if (mustExist && probe === candidate) return realPath;
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(probe);
      if (parent === probe) {
        if (mustExist) throw new Error(`${label} não existe.`);
        throw new Error(`${label} está fora da pasta do projeto.`);
      }
      probe = parent;
    }
  }
}

async function assertStoreInsideProject(storeFile) {
  await assertPathInsideProject(storeFile, { label: 'Arquivo de workspace' });
}

function getAssetStoreFile() {
  return path.join(projectRoot, '.spriteforge', 'assets.json');
}

async function persistWorkflowRun(run) {
  if (!projectRoot || !/^[0-9a-f-]{36}$/i.test(run?.id || '')) throw new Error('ID da execução inválido.');
  const directory = path.join(projectRoot, '.spriteforge', 'runs');
  const file = path.join(directory, `${run.id}.json`);
  await fs.mkdir(directory, { recursive: true });
  await assertPathInsideProject(directory, { label: 'Pasta de execuções' });
  await assertPathInsideProject(file, { label: 'Estado da execução' });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  try { await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

async function readWorkspaceAssets() {
  const file = getAssetStoreFile();
  try {
    await assertStoreInsideProject(file);
    const contents = await fs.readFile(file, 'utf8');
    if (Buffer.byteLength(contents, 'utf8') > ASSET_STORE_MAX_BYTES) throw new Error('O workspace de assets excede o limite de leitura.');
    const store = JSON.parse(contents);
    if (!Array.isArray(store.assets)) throw new Error('O arquivo de assets não tem o formato esperado.');
    return { assets: store.assets, updatedAt: store.updatedAt || null, projectRoot };
  } catch (error) {
    if (error.code === 'ENOENT') return { assets: null, updatedAt: null, projectRoot };
    throw error;
  }
}

async function writeWorkspaceAssets(assets) {
  if (!Array.isArray(assets)) throw new Error('A lista de assets precisa ser um array.');
  const ids = new Set();
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object' || !['character', 'item'].includes(asset.type) || typeof asset.id !== 'string' || !asset.id.trim()) {
      throw new Error('Cada asset precisa ter id e tipo character ou item.');
    }
    if (ids.has(asset.id)) throw new Error(`ID de asset duplicado: ${asset.id}`);
    ids.add(asset.id);
  }
  const store = { schemaVersion: 1, assets, updatedAt: new Date().toISOString() };
  const contents = `${JSON.stringify(store, null, 2)}\n`;
  if (Buffer.byteLength(contents, 'utf8') > ASSET_STORE_MAX_BYTES) throw new Error('O workspace de assets excede o limite de 24 MB.');
  const file = getAssetStoreFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await assertStoreInsideProject(file);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
  try {
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  return { ok: true, updatedAt: store.updatedAt };
}

function stageDefinitionsForAsset(asset) {
  return asset.type === 'item'
    ? [{ optional: false }, { optional: false }, { optional: false }, { optional: true }, { optional: false }]
    : [{ optional: false }, { optional: false }, { optional: false }, { optional: false }, { optional: false }];
}

function normalizeStageTracking(asset, definitions) {
  if (!Array.isArray(asset.stageStatus)) {
    asset.stageStatus = definitions.map(() => ({ status: 'pending', outputs: [], note: '' }));
    asset.completed = definitions.map(() => false);
    return;
  }
  asset.stageStatus = definitions.map((_, index) => asset.stageStatus[index] || { status: 'pending', outputs: [], note: '' });
  asset.completed = definitions.map((_, index) => asset.stageStatus[index]?.status === 'completed');
}

function assertManualPrerequisites(asset, stageIndex, definitions) {
  const startAt = Math.max(0, Math.min(definitions.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
  if (stageIndex < startAt) throw new Error('Essa etapa fica antes do ponto de entrada selecionado.');
  for (let previous = startAt; previous < stageIndex; previous += 1) {
    const status = asset.stageStatus?.[previous]?.status;
    if (definitions[previous].optional && (status === 'completed' || status === 'skipped')) continue;
    if (status !== 'completed') {
      const action = definitions[previous].optional ? 'conclua ou pule a etapa opcional' : 'conclua a etapa anterior';
      throw new Error(`Para avançar, ${action} ${previous + 1} primeiro.`);
    }
  }
}

async function verifyExistingManualInputs(asset) {
  for (const input of asset.existingInputs || []) {
    if (!input || typeof input.path !== 'string' || !input.path.trim() || path.isAbsolute(input.path)) {
      throw new Error('Um artefato de entrada não tem um caminho relativo válido.');
    }
    const candidate = path.resolve(projectRoot, input.path);
    if (!inside(projectRoot, candidate) || candidate === projectRoot) {
      throw new Error(`Artefato de entrada fora do projeto: ${input.path}`);
    }
    const realPath = await assertPathInsideProject(candidate, { mustExist: true, label: `Insumo ${input.path}` });
    const info = await fs.stat(realPath);
    if (!info.isFile() || info.size === 0) throw new Error(`Insumo ausente, vazio ou não é arquivo: ${input.path}`);
  }
}

async function getManualStageContext(assetId, stageIndex, { checkPrerequisites = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('A janela desktop não está disponível.');
  if (typeof assetId !== 'string' || !assetId.trim() || !Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 4) {
    throw new Error('Asset ou etapa inválidos.');
  }
  const store = await readWorkspaceAssets();
  const asset = (store.assets || []).find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Asset não encontrado: ${assetId}`);
  if (!['character', 'item'].includes(asset.type)) throw new Error('Tipo de asset inválido para o fluxo manual.');
  const definitions = stageDefinitionsForAsset(asset);
  normalizeStageTracking(asset, definitions);
  if (checkPrerequisites) {
    assertManualPrerequisites(asset, stageIndex, definitions);
    const startAt = Math.max(0, Math.min(definitions.length - 1, Number.isInteger(asset.startStageIndex) ? asset.startStageIndex : 0));
    if (stageIndex === startAt) await verifyExistingManualInputs(asset);
  }

  const assetDirectory = resolveAssetDirectory(projectRoot, asset.outputPath);
  const folder = stageDirectory(projectRoot, asset.outputPath, asset.type, stageIndex);
  await assertPathInsideProject(assetDirectory, { label: 'Pasta do asset' });
  await fs.mkdir(assetDirectory, { recursive: true });
  const realAssetDirectory = await assertPathInsideProject(assetDirectory, { mustExist: true, label: 'Pasta do asset' });
  await assertPathInsideProject(folder, { label: 'Pasta da etapa' });
  await fs.mkdir(folder, { recursive: true });
  const realFolder = await assertPathInsideProject(folder, { mustExist: true, label: 'Pasta da etapa' });
  if (!isPathInside(realAssetDirectory, realFolder)) throw new Error('A pasta da etapa aponta para fora da pasta do asset.');

  return { store, asset, definitions, stageIndex, assetDirectory, realAssetDirectory, folder: realFolder };
}

function briefMarkdownForAsset(asset) {
  const brief = String(asset.brief || '').trim();
  const prompt = String(asset.prompt || '').trim();
  if (brief.length < 12 || brief === 'Brief visual ainda não preenchido.' || prompt.length < 12 || prompt.startsWith('Descreva o design')) {
    throw new Error('Revise e preencha o brief visual e o prompt antes de exportar brief.md.');
  }
  const animationList = Array.isArray(asset.animations) && asset.animations.length ? asset.animations.join(', ') : 'Nenhuma especificada';
  return [
    `# ${asset.name}`,
    '',
    `- Tipo: ${asset.type === 'character' ? 'Personagem' : `Item (${asset.itemKind || 'prop'})`}`,
    `- Resolução alvo: ${asset.target || '48 × 48 px'}`,
    `- Animações/movimentos: ${animationList}`,
    '',
    '## Brief visual',
    brief,
    '',
    '## Prompt visual',
    prompt,
    '',
  ].join('\n');
}

function resetLaterStages(asset, stageIndex) {
  for (let later = stageIndex + 1; later < asset.stageStatus.length; later += 1) {
    asset.completed[later] = false;
    asset.stageStatus[later] = { status: 'pending', outputs: [], note: '' };
  }
}

async function persistManualStageResult(context, { status, outputs, note }) {
  const { store, asset, stageIndex, definitions } = context;
  normalizeStageTracking(asset, definitions);
  asset.stageStatus[stageIndex] = { status, outputs, note };
  asset.completed[stageIndex] = status === 'completed';
  resetLaterStages(asset, stageIndex);
  asset.updatedAt = new Date().toISOString();
  await writeWorkspaceAssets(store.assets);
  return {
    assetId: asset.id,
    stage: stageLabel(asset.type, stageIndex),
    status,
    outputs,
    completed: asset.completed,
    stageStatus: asset.stageStatus,
  };
}

async function openManualStageFolder(event, { assetId, stageIndex }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex, { checkPrerequisites: false });
  const error = await shell.openPath(context.folder);
  if (error) throw new Error(`Não consegui abrir a pasta da etapa: ${error}`);
  return { folder: context.folder };
}

async function completeManualStage(event, { assetId, stageIndex }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex);
  let outputs;

  if (stageIndex === 0) {
    const briefPath = path.join(context.assetDirectory, 'brief.md');
    const briefContent = briefMarkdownForAsset(context.asset);
    await assertPathInsideProject(briefPath, { label: 'brief.md' });
    let currentContent = null;
    try {
      const info = await fs.lstat(briefPath);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error('brief.md existente não é um arquivo simples; não o alterei.');
      currentContent = await fs.readFile(briefPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (currentContent !== null && currentContent !== briefContent) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'brief.md já existe',
        message: 'Substituir o brief existente por uma exportação dos dados atuais do asset?',
        detail: 'A Lia Forge não sobrescreve arquivos sem confirmação.',
        buttons: ['Cancelar', 'Substituir brief.md'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (choice.response !== 1) return { cancelled: true };
    }
    if (currentContent !== briefContent) await fs.writeFile(briefPath, briefContent, { encoding: 'utf8' });
    const realBriefPath = await assertPathInsideProject(briefPath, { mustExist: true, label: 'brief.md' });
    const briefStat = await fs.stat(realBriefPath);
    if (!briefStat.isFile() || briefStat.size === 0) throw new Error('O brief exportado não passou na verificação de arquivo.');
    outputs = [path.relative(projectRoot, realBriefPath).split(path.sep).join('/')];
  } else {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: `Selecione os outputs reais · ${stageLabel(context.asset.type, stageIndex)}`,
      defaultPath: context.folder,
      properties: ['openFile', 'multiSelections'],
      filters: stageFilters(context.asset.type, stageIndex),
    });
    if (selection.canceled) return { cancelled: true };
    if (!selection.filePaths.length) throw new Error('Nenhum arquivo foi selecionado.');

    const uniquePaths = [...new Set(selection.filePaths)];
    const realOutputs = [];
    for (const selectedPath of uniquePaths) {
      const realPath = await assertPathInsideProject(path.resolve(selectedPath), { mustExist: true, label: 'Arquivo selecionado' });
      if (!isPathInside(context.realAssetDirectory, realPath) || realPath === context.realAssetDirectory) {
        throw new Error('Selecione arquivos dentro da pasta deste asset. Use “Abrir pasta da etapa” para localizar o destino correto.');
      }
      const info = await fs.stat(realPath);
      if (!info.isFile() || info.size <= 0) throw new Error(`O arquivo está vazio ou não é um arquivo: ${path.basename(realPath)}`);
      realOutputs.push(path.relative(projectRoot, realPath).split(path.sep).join('/'));
    }
    validateStageOutputs(context.asset.type, stageIndex, realOutputs);
    outputs = realOutputs;
  }

  const result = await persistManualStageResult(context, {
    status: 'completed',
    outputs,
    note: 'Registrado manualmente no desktop; arquivo(s) existente(s), não vazio(s) e dentro da pasta do asset verificado(s).',
  });
  return { ...result, cancelled: false };
}

async function skipOptionalManualStage(event, { assetId, stageIndex }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex);
  if (!context.definitions[stageIndex].optional) throw new Error('Esta etapa não é opcional.');
  const result = await persistManualStageResult(context, {
    status: 'skipped',
    outputs: [],
    note: 'Etapa opcional ignorada manualmente pelo usuário.',
  });
  return { ...result, cancelled: false };
}

async function generateSpritesheetFromExistingModel(event, { assetId }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  if (workflowRunner.activeRunId) throw new Error('Já existe uma execução da Lia Forge em andamento. Aguarde antes de iniciar outra.');
  const context = await getManualStageContext(assetId, 4);
  const sourceRelative = findModelInput(context.asset);
  if (!sourceRelative) throw Object.assign(new Error('Não encontrei um modelo 3D registrado. Informe um modelo existente ou conclua a etapa de modelo/rig antes de gerar a spritesheet.'), { code: 'WORKFLOW_BLOCKED' });
  const sourcePath = path.resolve(projectRoot, sourceRelative);
  const realInputPath = await assertPathInsideProject(sourcePath, { mustExist: true, label: 'Modelo 3D de entrada' });
  const sourceInfo = await fs.stat(realInputPath);
  if (!sourceInfo.isFile() || sourceInfo.size <= 0) throw new Error('O modelo 3D de entrada está vazio ou não é um arquivo.');
  if (context.asset.type === 'character' && !(context.asset.animations || []).length) {
    throw Object.assign(new Error('Para renderizar um personagem, informe animações e tenha ações compatíveis no modelo/rig.'), { code: 'WORKFLOW_BLOCKED' });
  }
  const blenderExecutable = findExternalTool('blender');
  if (!blenderExecutable) throw Object.assign(new Error('Blender não foi detectado. Nenhuma ferramenta foi instalada; verifique a instalação ou selecione um adapter compatível.'), { code: 'WORKFLOW_BLOCKED' });
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'blender_spritesheet.py')
    : path.join(APP_ROOT, 'scripts', 'blender_spritesheet.py');
  try { await fs.access(scriptPath); } catch { throw new Error('O adapter Blender de spritesheet não está presente neste pacote.'); }
  const runId = randomUUID();
  const outputDirectory = path.join(context.folder, `run-${runId}`);
  await assertPathInsideProject(outputDirectory, { label: 'Pasta de outputs da execução' });
  await fs.mkdir(outputDirectory, { recursive: true });
  const frameSize = parseFrameSize(context.asset.target);
  const oldOutputs = context.asset.stageStatus?.[4]?.outputs || [];
  const plan = {
    id: runId,
    workflowId: 'render-spritesheet-from-existing-3d',
    assetId: context.asset.id,
    steps: [{
      id: 'render-and-pack',
      title: 'Renderizar e empacotar spritesheet no Blender',
      adapter: 'blender-spritesheet',
      dependsOn: [],
    }],
  };
  await persistManualStageResult(context, {
    status: 'in_progress',
    outputs: oldOutputs,
    note: 'Executando adapter Blender em background; os outputs só serão registrados depois da validação.',
  });

  try {
    const run = await workflowRunner.run(plan, {
      asset: context.asset,
      projectRoot,
      inputPath: realInputPath,
      sourceRelative,
      outputDirectory,
      scriptPath,
      frameSize,
    });
    const outputs = run.result.outputs;
    const result = await persistManualStageResult(context, {
      status: 'completed',
      outputs,
      note: run.steps[0]?.note || 'Blender produziu e validou o PNG e JSON de metadados.',
    });
    return { ...result, runId, run, cancelled: false };
  } catch (error) {
    const run = error.run || workflowRunner.get(runId);
    await persistManualStageResult(context, {
      status: run?.status === 'blocked' ? 'blocked' : run?.status === 'cancelled' ? 'cancelled' : 'failed',
      outputs: oldOutputs,
      note: `Execução automática interrompida: ${error.message || 'erro desconhecido'}`,
    }).catch(() => {});
    throw Object.assign(new Error(error.message || 'A execução do Blender falhou.'), { code: error.code || 'WORKFLOW_FAILED', runId, run });
  }
}

async function generateComfyUiConcept(event, { assetId, checkpoint }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  if (workflowRunner.activeRunId) throw new Error('Já existe uma execução da Lia Forge em andamento. Aguarde antes de iniciar outra.');
  const context = await getManualStageContext(assetId, 1);
  const workflowId = context.asset.type === 'character' ? 'character-concept' : 'item-concept';
  const prompt = [context.asset.brief, context.asset.prompt].filter((part) => typeof part === 'string' && part.trim()).join('\n\n');
  if (prompt.trim().length < 12) throw Object.assign(new Error('Preencha o brief e o prompt antes de gerar um conceito.'), { code: 'WORKFLOW_BLOCKED' });
  if (typeof checkpoint !== 'string' || !checkpoint.trim()) throw Object.assign(new Error('Selecione um checkpoint já instalado no ComfyUI. A Lia Forge não baixa pesos.'), { code: 'WORKFLOW_BLOCKED' });
  const runId = randomUUID();
  const outputDirectory = path.join(context.folder, `run-${runId}`);
  await assertPathInsideProject(outputDirectory, { label: 'Pasta de outputs da execução ComfyUI' });
  await fs.mkdir(outputDirectory, { recursive: true });
  const oldOutputs = context.asset.stageStatus?.[1]?.outputs || [];
  const plan = {
    id: runId,
    workflowId: `generate-${workflowId}`,
    assetId: context.asset.id,
    steps: [{
      id: 'generate-concept',
      title: 'Gerar e validar conceito no ComfyUI',
      adapter: 'comfyui-concept',
      dependsOn: [],
    }],
  };
  await persistManualStageResult(context, {
    status: 'in_progress',
    outputs: oldOutputs,
    note: 'ComfyUI foi acionado explicitamente com checkpoint instalado; aguardando imagem real e validação.',
  });

  try {
    const run = await workflowRunner.run(plan, {
      asset: context.asset,
      projectRoot,
      prompt,
      checkpoint,
      workflowId,
      outputDirectory,
    });
    const generatedOutputs = run.result.outputs;
    const outputs = [...new Set([...oldOutputs, ...generatedOutputs])];
    const result = await persistManualStageResult(context, {
      status: 'completed',
      outputs,
      note: run.steps[0]?.note || 'ComfyUI gerou um PNG real e o arquivo foi validado.',
    });
    return { ...result, runId, run, generatedOutputs, cancelled: false };
  } catch (error) {
    const run = error.run || workflowRunner.get(runId);
    await persistManualStageResult(context, {
      status: run?.status === 'blocked' ? 'blocked' : run?.status === 'cancelled' ? 'cancelled' : 'failed',
      outputs: oldOutputs,
      note: `Geração de conceito interrompida: ${error.message || 'erro desconhecido'}`,
    }).catch(() => {});
    throw Object.assign(new Error(error.message || 'A geração ComfyUI falhou.'), { code: error.code || 'WORKFLOW_FAILED', runId, run });
  }
}

async function openInstalledExternalTool(event, { assetId, stageIndex, tool }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex, { checkPrerequisites: false });
  const launched = await launchExternalTool(tool, { cwd: context.folder });
  return { ...launched, folder: context.folder };
}

async function chooseExternalApplication(event, { assetId, stageIndex }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex, { checkPrerequisites: false });
  const isMac = process.platform === 'darwin';
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha um aplicativo instalado para esta etapa',
    defaultPath: context.folder,
    properties: isMac ? ['openFile', 'openDirectory'] : ['openFile'],
    filters: process.platform === 'win32' ? [{ name: 'Aplicativo Windows', extensions: ['exe'] }] : [{ name: 'Aplicativos', extensions: ['*'] }],
  });
  if (selection.canceled || !selection.filePaths.length) return { cancelled: true };

  const selectedPath = path.resolve(selection.filePaths[0]);
  const info = await fs.stat(selectedPath);
  let executable = selectedPath;
  let args = [];
  if (isMac && info.isDirectory() && selectedPath.toLowerCase().endsWith('.app')) {
    executable = '/usr/bin/open';
    args = ['-a', selectedPath];
  } else {
    if (!info.isFile()) throw new Error('Selecione o executável do aplicativo.');
    if (process.platform === 'win32' && path.extname(selectedPath).toLowerCase() !== '.exe') {
      throw new Error('Selecione um executável .exe.');
    }
    if (process.platform !== 'win32') fsSync.accessSync(selectedPath, fsSync.constants.X_OK);
  }

  const launched = await launchApplication(executable, { args, cwd: context.folder });
  return {
    ...launched,
    cancelled: false,
    label: isMac && executable === '/usr/bin/open' ? path.basename(selectedPath) : path.basename(executable),
    folder: context.folder,
  };
}

async function openComfyUiInterface(event, { assetId, stageIndex }) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
  const context = await getManualStageContext(assetId, stageIndex, { checkPrerequisites: false });
  const status = await getComfyStatus({ includeModels: false });
  if (!status.connected) throw new Error('ComfyUI não está disponível. Inicie-o por conta própria; a Lia Forge não o instala nem inicia.');
  await shell.openExternal(status.endpoint);
  return { opened: true, endpoint: status.endpoint, folder: context.folder };
}

function cleanActivities(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((activity) => {
    if (!activity || typeof activity !== 'object') return null;
    return {
      label: String(activity.label || activity.name || 'Tarefa ativa').replace(/[\r\n]/g, ' ').slice(0, 150),
      detail: String(activity.detail || '').replace(/[\r\n]/g, ' ').slice(0, 200),
      progress: Number.isFinite(activity.progress) ? Math.max(0, Math.min(100, Math.round(activity.progress))) : null,
      kind: String(activity.kind || 'external').slice(0, 32),
    };
  }).filter(Boolean);
}

async function getComfyStatus(options = {}) {
  const client = await getWorkflowClient();
  return client.getComfyUiStatus(options);
}

async function readTrackedWorkspaceActivities() {
  try {
    const store = await readWorkspaceAssets();
    const activityNames = {
      character: ['Brief visual', 'Referências', 'Modelo 3D', 'Rig & animação', 'Spritesheet'],
      item: ['Brief visual', 'Referências', 'Modelo 3D', 'Movimento & variações', 'Spritesheet'],
    };
    return (store.assets || []).flatMap((asset) => (asset.stageStatus || [])
      .map((stage, index) => stage?.status === 'in_progress' ? {
        kind: 'external',
        label: `${asset.name || 'Asset'} · ${(activityNames[asset.type] || [])[index] || `Etapa ${index + 1}`}`,
        detail: stage.note || 'Status registrado no workspace por um agente.',
        progress: Number.isFinite(stage.progress) ? stage.progress : null,
      } : null)
      .filter(Boolean));
  } catch {
    return [];
  }
}

function openWindow() {
  mainWindow = new BrowserWindow({
    title: 'Lia Forge',
    width: 1500,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b080d',
    icon: path.join(APP_ROOT, 'assets', 'lia-forge.ico'),
    webPreferences: {
      preload: path.join(APP_ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', blockUntrustedNavigation);
  mainWindow.webContents.on('will-redirect', blockUntrustedNavigation);
  mainWindow.webContents.on('will-frame-navigate', (event, destination, _inPlace, isMainFrame) => {
    if (!isMainFrame || !isTrustedNavigation(destination)) event.preventDefault();
  });

  mainWindow.on('close', (event) => {
    if (approvedClose) return;
    event.preventDefault();
    void requestCloseConfirmation();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

async function startRenderer() {
  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(APP_ROOT, 'dist', 'index.html'));
    return;
  }

  process.env.SPRITEFORGE_PROJECT_ROOT ||= projectRoot;
  const { createServer } = await import('vite');
  viteServer = await createServer({
    configFile: path.join(APP_ROOT, 'vite.config.js'),
    server: {
      host: '127.0.0.1',
      port: Number(process.env.LIA_FORGE_DEV_PORT) || 5173,
      strictPort: false,
      open: false,
    },
  });
  await viteServer.listen();
  const url = viteServer.resolvedUrls?.local?.[0];
  if (!url) throw new Error('O servidor de desenvolvimento não informou uma URL local.');
  devOrigin = new URL(url).origin;
  await mainWindow.loadURL(url);
}

async function stopManagedProcesses() {
  const result = await taskRegistry.stopAll();
  if (result.remaining.length) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Não foi possível encerrar todas as tarefas',
      message: 'A Lia Forge ainda detecta processo(s) iniciado(s) por ela.',
      detail: result.remaining.map((task) => `${task.label}${task.pid ? ` · PID ${task.pid}` : ''}`).join('\n'),
      buttons: ['Manter o app aberto', 'Sair mesmo assim'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response.response === 0) return false;
  }
  return true;
}

async function requestCloseConfirmation() {
  if (closePromptOpen || !mainWindow || mainWindow.isDestroyed()) return;
  closePromptOpen = true;
  try {
    const [comfyStatus, workspaceActivities] = await Promise.all([
      getComfyStatus({ includeModels: false }).catch(() => null),
      readTrackedWorkspaceActivities(),
    ]);
    const managedProcesses = taskRegistry.list();
    const activities = [...reportedActivities, ...workspaceActivities].filter((activity, index, all) =>
      all.findIndex((candidate) => candidate.label === activity.label && candidate.detail === activity.detail) === index,
    );
    const report = buildCloseReport({
      activities,
      managedProcesses,
      comfyStatus,
    });
    if (!report.hasActivity) {
      approvedClose = true;
      app.quit();
      return;
    }

    const detail = [
      report.details,
      managedProcesses.length ? '' : 'Não há processos filhos da Lia Forge para encerrar.',
      'Tarefas de agentes e serviços externos não iniciados pela Lia Forge continuarão em execução.',
    ].filter(Boolean).join('\n\n');
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Ainda há atividade em andamento',
      message: 'Deseja fechar a Lia Forge mesmo assim?',
      detail,
      buttons: ['Cancelar', 'Encerrar tarefas da Lia Forge e sair'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response.response === 0) return;
    const stopped = await stopManagedProcesses();
    if (!stopped) return;
    approvedClose = true;
    app.quit();
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Não foi possível verificar as tarefas',
      message: 'A Lia Forge continuará aberta para evitar encerrar atividades sem confirmação.',
      detail: error?.message || String(error),
      buttons: ['Voltar ao app'],
      defaultId: 0,
      noLink: true,
    });
  } finally {
    closePromptOpen = false;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('lia-forge:assets:read', () => readWorkspaceAssets());
  ipcMain.handle('lia-forge:assets:write', (_event, assets) => writeWorkspaceAssets(assets));
  ipcMain.handle('lia-forge:assets:manual:open-folder', (event, payload) => openManualStageFolder(event, payload || {}));
  ipcMain.handle('lia-forge:assets:manual:complete-stage', (event, payload) => completeManualStage(event, payload || {}));
  ipcMain.handle('lia-forge:assets:manual:skip-stage', (event, payload) => skipOptionalManualStage(event, payload || {}));
  ipcMain.handle('lia-forge:assets:auto:render-spritesheet', (event, payload) => generateSpritesheetFromExistingModel(event, payload || {}));
  ipcMain.handle('lia-forge:assets:auto:generate-concept', (event, payload) => generateComfyUiConcept(event, payload || {}));
  ipcMain.handle('lia-forge:tools:status', (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Solicitação inválida.');
    return getExternalToolStatus();
  });
  ipcMain.handle('lia-forge:tools:open', (event, payload) => openInstalledExternalTool(event, payload || {}));
  ipcMain.handle('lia-forge:tools:choose-and-open', (event, payload) => chooseExternalApplication(event, payload || {}));
  ipcMain.handle('lia-forge:tools:open-comfyui', (event, payload) => openComfyUiInterface(event, payload || {}));
  ipcMain.handle('lia-forge:comfyui:status', () => getComfyStatus());
  ipcMain.handle('lia-forge:comfyui:workflows:list', async () => (await getWorkflowClient()).listComfyUiWorkflows());
  ipcMain.handle('lia-forge:comfyui:workflows:read', async (_event, workflowId) => {
    if (typeof workflowId !== 'string' || workflowId.length > 80) throw new Error('ID de workflow inválido.');
    return (await getWorkflowClient()).readComfyUiWorkflow(workflowId);
  });
  ipcMain.handle('lia-forge:processes:list', () => taskRegistry.list());
  ipcMain.on('lia-forge:activities:report', (event, activities) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    reportedActivities = cleanActivities(activities);
  });
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  projectRoot = process.env.SPRITEFORGE_PROJECT_ROOT
    ? path.resolve(process.env.SPRITEFORGE_PROJECT_ROOT)
    : app.isPackaged
      ? path.join(app.getPath('documents'), 'Lia Forge')
      : process.cwd();
  await fs.mkdir(projectRoot, { recursive: true });
  registerIpcHandlers();
  openWindow();
  try {
    await startRenderer();
  } catch (error) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Lia Forge não conseguiu iniciar',
      message: 'Não foi possível abrir a janela da Lia Forge.',
      detail: error?.message || String(error),
      buttons: ['Fechar'],
      noLink: true,
    });
    approvedClose = true;
    app.quit();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindow();
      void startRenderer().catch(() => app.quit());
    }
  });
});

app.on('before-quit', (event) => {
  if (approvedClose || !mainWindow || mainWindow.isDestroyed()) return;
  event.preventDefault();
  mainWindow.close();
});

app.on('will-quit', async () => {
  try { await taskRegistry.stopAll(); } catch { /* best effort after the user has confirmed exit */ }
  if (viteServer) {
    try { await viteServer.close(); } catch { /* Vite may already be closed */ }
    viteServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
