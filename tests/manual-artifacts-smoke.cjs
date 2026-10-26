const assert = require('node:assert/strict');
const path = require('node:path');
const {
  isInside,
  resolveAssetDirectory,
  stageDirectory,
  stageFilters,
  stageLabel,
  validateStageOutputs,
} = require('../electron/manual-artifacts.cjs');

const projectRoot = path.resolve('/tmp/lia-forge-manual-workspace');
const assetPath = 'game/assets/characters/mira';

assert.equal(resolveAssetDirectory(projectRoot, assetPath), path.join(projectRoot, assetPath));
assert.equal(stageDirectory(projectRoot, assetPath, 'character', 3), path.join(projectRoot, assetPath, 'rig'));
assert.equal(stageDirectory(projectRoot, assetPath, 'item', 3), path.join(projectRoot, assetPath, 'motion'));
assert.equal(stageLabel('character', 4), 'Spritesheet');
assert.deepEqual(stageFilters('character', 1)[0].extensions, ['png', 'jpg', 'jpeg', 'webp']);
assert.equal(isInside(projectRoot, path.join(projectRoot, 'game', 'assets')), true);
assert.equal(isInside(projectRoot, path.resolve(projectRoot, '../outside')), false);
assert.throws(() => resolveAssetDirectory(projectRoot, '../outside'), /dentro da raiz/);
assert.throws(() => stageDirectory(projectRoot, assetPath, 'unknown', 1), /Etapa manual inválida/);
assert.equal(validateStageOutputs('character', 1, ['game/assets/characters/mira/references/front.png']), true);
assert.equal(validateStageOutputs('character', 2, ['game/assets/characters/mira/3d/source.blend']), true);
assert.equal(validateStageOutputs('character', 3, ['game/assets/characters/mira/rig/walk.fbx']), true);
assert.equal(validateStageOutputs('character', 4, [
  'game/assets/characters/mira/sprites/spritesheet.png',
  'game/assets/characters/mira/sprites/spritesheet.json',
]), true);
assert.throws(() => validateStageOutputs('character', 4, ['game/assets/characters/mira/sprites/spritesheet.png']), /PNG e o JSON/);
assert.throws(() => validateStageOutputs('character', 2, ['game/assets/characters/mira/3d/notes.txt']), /modelo 3D/);
console.log('Manual artifact helpers smoke test passed.');
