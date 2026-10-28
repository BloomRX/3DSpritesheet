const os = require('node:os');
const path = require('node:path');

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveUserPath(value, homeDirectory) {
  const input = nonEmpty(value);
  if (!input) return null;
  const expanded = input === '~' ? homeDirectory : input.startsWith(`~${path.sep}`)
    ? path.join(homeDirectory, input.slice(2))
    : input;
  return path.resolve(expanded);
}

function resolveLiaForgePaths({
  env = process.env,
  homeDirectory = os.homedir(),
  documentsDirectory = null,
  platform = process.platform,
  isPackaged = false,
  cwd = process.cwd(),
} = {}) {
  const home = path.resolve(homeDirectory);
  const configuredLiaHome = resolveUserPath(env.LIA_HOME, home);
  const liaHome = configuredLiaHome || path.join(home, 'Lia');
  const explicitWorkspace = resolveUserPath(env.SPRITEFORGE_PROJECT_ROOT, home);

  let workspaceRoot;
  let workspaceRootSource;
  if (explicitWorkspace) {
    workspaceRoot = explicitWorkspace;
    workspaceRootSource = 'SPRITEFORGE_PROJECT_ROOT';
  } else if (configuredLiaHome) {
    workspaceRoot = path.join(liaHome, 'Forge');
    workspaceRootSource = 'LIA_HOME';
  } else if (isPackaged) {
    workspaceRoot = path.join(liaHome, 'Forge');
    workspaceRootSource = 'padrão Lia';
  } else {
    workspaceRoot = path.resolve(cwd);
    workspaceRootSource = 'diretório atual (desenvolvimento)';
  }

  const isWindows = platform === 'win32' || platform === 'windows';
  const roamingBase = isWindows
    ? (resolveUserPath(env.APPDATA, home) || path.join(home, 'AppData', 'Roaming'))
    : (resolveUserPath(env.XDG_CONFIG_HOME, home) || path.join(home, '.config'));
  const localBase = isWindows
    ? (resolveUserPath(env.LOCALAPPDATA, home) || path.join(home, 'AppData', 'Local'))
    : (resolveUserPath(env.XDG_CACHE_HOME, home) || path.join(home, '.cache'));
  const modelBase = isWindows
    ? (resolveUserPath(env.LOCALAPPDATA, home) || path.join(home, 'AppData', 'Local'))
    : (resolveUserPath(env.XDG_DATA_HOME, home) || path.join(home, '.local', 'share'));
  const dataDirectory = resolveUserPath(env.LIA_DATA, home) || path.join(localBase, 'Lia', 'Forge');
  const modelDirectory = resolveUserPath(env.LIA_MODELOS, home) || path.join(modelBase, 'Lia', 'Modelos');
  const configDirectory = path.join(roamingBase, 'Lia', 'Forge', 'config');

  let legacyWorkspaceRoot = null;
  if (isPackaged && !explicitWorkspace && !configuredLiaHome) {
    const documents = documentsDirectory ? path.resolve(documentsDirectory) : path.join(home, 'Documents');
    legacyWorkspaceRoot = path.join(documents, 'Lia Forge');
  }

  return {
    homeDirectory: home,
    liaHome,
    workspaceRoot: path.resolve(workspaceRoot),
    workspaceRootSource,
    legacyWorkspaceRoot,
    configDirectory,
    dataDirectory,
    cacheDirectory: path.join(dataDirectory, 'cache'),
    logsDirectory: path.join(dataDirectory, 'logs'),
    modelDirectory,
  };
}

module.exports = { resolveLiaForgePaths };
