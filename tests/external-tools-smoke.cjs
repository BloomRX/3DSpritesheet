const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  externalToolCandidates,
  findExternalTool,
  getExternalToolStatus,
} = require('../electron/external-tools.cjs');

const windowsRoot = 'C:\\Program Files (x86)\\Steam';
const externalLibrary = 'D:\\SteamLibrary';
const win32 = path.win32;
const windowsFs = {
  readFileSync(filePath) {
    if (win32.basename(filePath).toLowerCase() === 'libraryfolders.vdf') {
      return `"0"\n{\n  "path" "${externalLibrary.replace(/\\/g, '\\\\')}"\n}`;
    }
    throw new Error('not found');
  },
  readdirSync() { throw new Error('not found'); },
};
const windowsCandidates = externalToolCandidates('blender', {
  platform: 'win32',
  env: { 'ProgramFiles(x86)': 'C:\\Program Files (x86)', STEAM_DIR: windowsRoot },
  home: 'C:\\Users\\Lia',
  fsApi: windowsFs,
  spawnSyncImpl: () => ({ status: 1, stdout: '' }),
});
assert.ok(windowsCandidates.includes(win32.join(externalLibrary, 'steamapps', 'common', 'Blender', 'blender.exe')),
  'Steam Blender installations in an external library are discoverable');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lia-forge-external-tools-'));
try {
  const binaryName = process.platform === 'win32' ? 'blender.exe' : 'blender';
  const executable = path.join(temporaryRoot, binaryName);
  fs.writeFileSync(executable, 'test executable');
  if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
  const found = findExternalTool('blender', {
    platform: process.platform,
    env: { PATH: temporaryRoot, PATHEXT: '.EXE;.CMD' },
    home: temporaryRoot,
  });
  assert.equal(found, executable, 'installed executables on PATH are discoverable');
  const status = getExternalToolStatus({
    platform: process.platform,
    env: { PATH: temporaryRoot, PATHEXT: '.EXE;.CMD' },
    home: temporaryRoot,
  });
  assert.equal(status.blender.installed, true);
  assert.equal(status.krita.installed, false);
  assert.throws(() => externalToolCandidates('unknown-tool'), /Ferramenta externa inválida/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
console.log('External tool launcher smoke test passed.');
