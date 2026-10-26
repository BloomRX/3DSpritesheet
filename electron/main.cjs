const { app, BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ManagedProcessRegistry, buildCloseReport } = require('./task-manager.cjs');
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

async function assertStoreInsideProject(storeFile) {
  const rootReal = await fs.realpath(projectRoot);
  let probe = storeFile;
  while (true) {
    try {
      const realPath = await fs.realpath(probe);
      if (!inside(rootReal, realPath)) throw new Error('O arquivo de workspace aponta para fora da pasta do projeto.');
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(probe);
      if (parent === probe) throw new Error('O arquivo de workspace está fora da pasta do projeto.');
      probe = parent;
    }
  }
}

function getAssetStoreFile() {
  return path.join(projectRoot, '.spriteforge', 'assets.json');
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
