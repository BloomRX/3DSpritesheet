const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveLiaForgePaths } = require('../electron/paths.cjs');

const homeDirectory = path.resolve('/tmp/lia-paths-home');
const documentsDirectory = path.join(homeDirectory, 'Documents');

const packagedDefault = resolveLiaForgePaths({
  env: {},
  homeDirectory,
  documentsDirectory,
  platform: 'win32',
  isPackaged: true,
  cwd: '/tmp/source-checkout',
});
assert.equal(packagedDefault.workspaceRoot, path.join(homeDirectory, 'Lia', 'Forge'));
assert.equal(packagedDefault.workspaceRootSource, 'padrão Lia');
assert.equal(packagedDefault.legacyWorkspaceRoot, path.join(documentsDirectory, 'Lia Forge'));
assert.equal(packagedDefault.modelDirectory, path.join(homeDirectory, 'AppData', 'Local', 'Lia', 'Modelos'));
assert.equal(packagedDefault.configDirectory, path.join(homeDirectory, 'AppData', 'Roaming', 'Lia', 'Forge', 'config'));
assert.equal(packagedDefault.dataDirectory, path.join(homeDirectory, 'AppData', 'Local', 'Lia', 'Forge'));

const customBrandRoot = resolveLiaForgePaths({
  env: { LIA_HOME: '/tmp/user-chosen/Lia' },
  homeDirectory,
  platform: 'linux',
  isPackaged: true,
  cwd: '/tmp/source-checkout',
});
assert.equal(customBrandRoot.workspaceRoot, path.resolve('/tmp/user-chosen/Lia/Forge'));
assert.equal(customBrandRoot.legacyWorkspaceRoot, null);

const explicitProject = resolveLiaForgePaths({
  env: {
    LIA_HOME: '/tmp/user-chosen/Lia',
    SPRITEFORGE_PROJECT_ROOT: '/tmp/game/project',
    LIA_MODELOS: '/tmp/shared-models',
    LIA_DATA: '/tmp/lia-data',
    APPDATA: '/tmp/roaming',
  },
  homeDirectory,
  platform: 'win32',
  isPackaged: true,
  cwd: '/tmp/source-checkout',
});
assert.equal(explicitProject.workspaceRoot, path.resolve('/tmp/game/project'));
assert.equal(explicitProject.workspaceRootSource, 'SPRITEFORGE_PROJECT_ROOT');
assert.equal(explicitProject.legacyWorkspaceRoot, null);
assert.equal(explicitProject.modelDirectory, path.resolve('/tmp/shared-models'));
assert.equal(explicitProject.dataDirectory, path.resolve('/tmp/lia-data'));
assert.equal(explicitProject.configDirectory, path.join('/tmp/roaming', 'Lia', 'Forge', 'config'));

const developerDefault = resolveLiaForgePaths({
  env: {},
  homeDirectory,
  platform: 'linux',
  isPackaged: false,
  cwd: '/tmp/source-checkout',
});
assert.equal(developerDefault.workspaceRoot, path.resolve('/tmp/source-checkout'));
assert.equal(developerDefault.workspaceRootSource, 'diretório atual (desenvolvimento)');
assert.equal(developerDefault.modelDirectory, path.join(homeDirectory, '.local', 'share', 'Lia', 'Modelos'));

console.log('lia paths smoke: ok');
