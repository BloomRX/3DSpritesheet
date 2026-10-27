const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { makePng } = require('./png-fixtures.cjs');
const {
  buildBlenderSpritesheetArgs,
  candidateModelPaths,
  findModelInput,
  parseFrameSize,
  runProcess,
  validateSpritesheetFiles,
} = require('../electron/blender-adapter.cjs');

async function main() {
  assert.deepEqual(parseFrameSize('48 × 64 px'), { width: 48, height: 64 });
  assert.deepEqual(parseFrameSize('bad size', { width: 64, height: 64 }), { width: 64, height: 64 });
  assert.deepEqual(candidateModelPaths({
    existingInputs: [
      { path: 'game/assets/hero/3d/model.blend', stageIndex: 2 },
      { path: 'game/assets/hero/rig/hero.fbx', stageIndex: 3 },
    ],
  }), ['game/assets/hero/rig/hero.fbx', 'game/assets/hero/3d/model.blend']);
  assert.equal(findModelInput({ stageStatus: [{}, {}, { outputs: ['game/assets/item/3d/lantern.glb'] }] }), 'game/assets/item/3d/lantern.glb');

  const args = buildBlenderSpritesheetArgs({
    scriptPath: '/opt/lia forge/scripts/blender_spritesheet.py',
    inputPath: '/workspace/hero rig.blend',
    outputDirectory: '/workspace/game assets/hero/sprites/run 1',
    asset: { type: 'character', name: 'Herói Arco', target: '48 × 48 px', animations: ['Idle', 'Walk'] },
  });
  assert(args.includes('/workspace/hero rig.blend'));
  assert(args.includes(JSON.stringify(['Idle', 'Walk'])));
  assert.equal(args[args.indexOf('--frame-width') + 1], '48');

  const png = makePng(96, 48);
  const metadata = {
    schemaVersion: 1,
    frameWidth: 48,
    frameHeight: 48,
    sheetWidth: 96,
    sheetHeight: 48,
    columns: 2,
    rows: 1,
    frames: [
      { filename: 'hero-walk-00', animation: 'walk', durationMs: 100, pivot: { x: 24, y: 47 }, x: 0, y: 0, width: 48, height: 48 },
      { filename: 'hero-walk-01', animation: 'walk', durationMs: 100, pivot: { x: 24, y: 47 }, x: 48, y: 0, width: 48, height: 48 },
    ],
  };
  assert.deepEqual(validateSpritesheetFiles({ pngBuffer: png, metadata, frameSize: { width: 48, height: 48 } }), { sheetWidth: 96, sheetHeight: 48, frameCount: 2 });
  assert.throws(() => validateSpritesheetFiles({ pngBuffer: makePng(96, 48, { colorType: 2 }), metadata, frameSize: { width: 48, height: 48 } }), /RGBA/);
  const corruptedPng = Buffer.from(png);
  corruptedPng[corruptedPng.indexOf(Buffer.from('IDAT')) + 8] ^= 0xff;
  assert.throws(() => validateSpritesheetFiles({ pngBuffer: corruptedPng, metadata, frameSize: { width: 48, height: 48 } }), /CRC inválido/);
  assert.throws(() => validateSpritesheetFiles({ pngBuffer: png, metadata: { ...metadata, sheetWidth: 48 }, frameSize: { width: 48, height: 48 } }), /não correspondem/);

  const progress = [];
  const child = spawn(process.execPath, ['-e', 'console.log("LIA_FORGE_PROGRESS 37 mock stage"); console.log("LIA_FORGE_PROGRESS 82 finishing")'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await runProcess(child, { onProgress: async (event) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    progress.push(event);
  } });
  assert.deepEqual(progress, [
    { progress: 37, message: 'mock stage' },
    { progress: 82, message: 'finishing' },
  ]);

  console.log('Blender adapter smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
