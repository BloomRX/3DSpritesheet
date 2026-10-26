const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const TOOL_LABELS = Object.freeze({ blender: 'Blender', krita: 'Krita' });

function pathApiFor(platform) {
  return platform === 'win32' ? path.win32 : path;
}

function uniquePaths(values, pathApi, platform = process.platform) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const normalized = pathApi.normalize(value);
    const key = platformKey(normalized, platform);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function platformKey(value, platform = process.platform) {
  return platform === 'win32' ? value.toLowerCase() : value;
}

function readSteamRegistryPaths(spawnSyncImpl = spawnSync) {
  const keys = [
    ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
    ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
    ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
  ];
  const paths = [];
  for (const [key, valueName] of keys) {
    try {
      const result = spawnSyncImpl('reg.exe', ['query', key, '/v', valueName], {
        encoding: 'utf8',
        timeout: 1200,
        windowsHide: true,
      });
      if (result.status !== 0) continue;
      const match = String(result.stdout || '').match(new RegExp(`${valueName}\\s+REG_SZ\\s+(.+)`, 'i'));
      if (match?.[1]) paths.push(match[1].trim());
    } catch {
      // Registry lookup is best-effort; environment and default install paths still work.
    }
  }
  return paths;
}

function steamInstallRoots({ platform = process.platform, env = process.env, pathApi = pathApiFor(platform), spawnSyncImpl = spawnSync } = {}) {
  if (platform !== 'win32') return [];
  const roots = [];
  for (const variable of ['STEAM_DIR', 'STEAM_PATH', 'STEAMROOT', 'SteamPath']) {
    if (env[variable]) roots.push(env[variable]);
  }
  for (const variable of ['ProgramFiles(x86)', 'ProgramFiles']) {
    if (env[variable]) roots.push(pathApi.join(env[variable], 'Steam'));
  }
  roots.push(...readSteamRegistryPaths(spawnSyncImpl));
  return uniquePaths(roots, pathApi, platform);
}

function steamLibraryPaths({ platform = process.platform, env = process.env, pathApi = pathApiFor(platform), home = os.homedir(), fsApi = fs, spawnSyncImpl = spawnSync } = {}) {
  if (platform !== 'win32') {
    const roots = [
      pathApi.join(home, '.steam', 'steam'),
      pathApi.join(home, '.local', 'share', 'Steam'),
      pathApi.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
    ];
    return uniquePaths(roots, pathApi, platform);
  }

  const libraries = [];
  for (const root of steamInstallRoots({ platform, env, pathApi, spawnSyncImpl })) {
    libraries.push(root);
    const manifest = pathApi.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      const contents = fsApi.readFileSync(manifest, 'utf8');
      const expression = /^\s*"path"\s*"((?:\\.|[^"])*)"\s*$/gm;
      for (const match of contents.matchAll(expression)) {
        const value = match[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"');
        if (value) libraries.push(value);
      }
    } catch {
      // Some Steam roots do not have a library manifest yet.
    }
  }
  return uniquePaths(libraries, pathApi, platform);
}

function pathCommands(name, { platform, env, pathApi }) {
  const pathValue = env.PATH || env.Path || env.path || '';
  const delimiter = platform === 'win32' ? ';' : ':';
  const suffixes = platform === 'win32' ? ['.exe', ''] : [''];
  const candidates = [];
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const commandName = suffix && !name.toLowerCase().endsWith(suffix) ? `${name}${suffix}` : name;
      candidates.push(pathApi.join(directory, commandName));
    }
  }
  return candidates;
}

function versionedBlenderCandidates(base, pathApi, fsApi) {
  const candidates = [pathApi.join(base, 'blender.exe')];
  try {
    const entries = fsApi.readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Blender/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    for (const entry of entries) candidates.push(pathApi.join(base, entry, 'blender.exe'));
  } catch {
    // Fall back to known install paths below.
  }
  return candidates;
}

function externalToolCandidates(tool, {
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
  fsApi = fs,
  spawnSyncImpl = spawnSync,
} = {}) {
  if (!Object.hasOwn(TOOL_LABELS, tool)) throw new Error(`Ferramenta externa inválida: ${tool}`);
  const pathApi = pathApiFor(platform);
  const candidates = pathCommands(tool, { platform, env, pathApi });

  if (tool === 'blender' && platform === 'win32') {
    for (const variable of ['ProgramFiles', 'ProgramFiles(x86)']) {
      const root = env[variable];
      if (root) candidates.push(...versionedBlenderCandidates(pathApi.join(root, 'Blender Foundation'), pathApi, fsApi));
    }
    for (const library of steamLibraryPaths({ platform, env, pathApi, home, fsApi, spawnSyncImpl })) {
      const common = pathApi.join(library, 'steamapps', 'common');
      candidates.push(pathApi.join(common, 'Blender', 'blender.exe'));
      candidates.push(...versionedBlenderCandidates(pathApi.join(common, 'Blender'), pathApi, fsApi));
      candidates.push(...versionedBlenderCandidates(pathApi.join(common, 'Blender Foundation'), pathApi, fsApi));
    }
  } else if (tool === 'krita' && platform === 'win32') {
    const programFiles = env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      pathApi.join(programFiles, 'Krita (x64)', 'bin', 'krita.exe'),
      pathApi.join(programFiles, 'Krita', 'bin', 'krita.exe'),
      pathApi.join(programFilesX86, 'Krita (x64)', 'bin', 'krita.exe'),
      pathApi.join(programFilesX86, 'Krita', 'bin', 'krita.exe'),
    );
  } else if (tool === 'blender' && platform === 'darwin') {
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender', '/opt/homebrew/bin/blender', '/usr/local/bin/blender');
  } else if (tool === 'krita' && platform === 'darwin') {
    candidates.push('/Applications/krita.app/Contents/MacOS/krita', '/Applications/Krita.app/Contents/MacOS/krita', '/opt/homebrew/bin/krita', '/usr/local/bin/krita');
  } else if (tool === 'blender') {
    candidates.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/var/lib/flatpak/exports/bin/org.blender.Blender');
    candidates.push(
      pathApi.join(home, '.steam', 'steam', 'steamapps', 'common', 'Blender', 'blender'),
      pathApi.join(home, '.local', 'share', 'Steam', 'steamapps', 'common', 'Blender', 'blender'),
    );
  } else {
    candidates.push('/usr/bin/krita', '/usr/local/bin/krita', '/snap/bin/krita', '/var/lib/flatpak/exports/bin/org.kde.krita');
  }

  return uniquePaths(candidates, pathApi, platform);
}

function findExternalTool(tool, options = {}) {
  const platform = options.platform || process.platform;
  const fsApi = options.fsApi || fs;
  for (const candidate of externalToolCandidates(tool, options)) {
    try {
      const info = fsApi.statSync(candidate);
      if (!info.isFile()) continue;
      if (platform !== 'win32') fsApi.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep searching in PATH, known install locations, and Steam libraries.
    }
  }
  return null;
}

function getExternalToolStatus(options = {}) {
  return Object.fromEntries(Object.entries(TOOL_LABELS).map(([tool, label]) => {
    const executable = findExternalTool(tool, options);
    return [tool, { label, installed: Boolean(executable) }];
  }));
}

function launchApplication(executable, { cwd, args = [], spawnImpl = spawn, platform = process.platform } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(executable, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve({ pid: child.pid || null, platform });
    });
  });
}

async function launchExternalTool(tool, options = {}) {
  const executable = findExternalTool(tool, options);
  if (!executable) throw new Error(`${TOOL_LABELS[tool] || 'Aplicativo'} não foi detectado. Use “Escolher aplicativo” para abrir outro programa instalado.`);
  const started = await launchApplication(executable, options);
  return { ...started, tool, label: TOOL_LABELS[tool], executable };
}

module.exports = {
  TOOL_LABELS,
  externalToolCandidates,
  findExternalTool,
  getExternalToolStatus,
  launchApplication,
  launchExternalTool,
  steamInstallRoots,
  steamLibraryPaths,
};
