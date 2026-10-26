const path = require('node:path');

const STAGE_FOLDERS = Object.freeze({
  character: ['', 'references', '3d', 'rig', 'sprites'],
  item: ['', 'references', '3d', 'motion', 'sprites'],
});

const STAGE_LABELS = Object.freeze({
  character: ['Brief', 'Referências', 'Modelo 3D', 'Rig & animação', 'Spritesheet'],
  item: ['Brief', 'Referências', 'Modelo 3D', 'Movimento & variações', 'Spritesheet'],
});

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MODEL_EXTENSIONS = ['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl'];
const CHARACTER_MOTION_EXTENSIONS = ['blend', 'fbx', 'glb', 'gltf', 'bvh', 'abc', 'json'];
const ITEM_MOTION_EXTENSIONS = ['blend', 'fbx', 'glb', 'gltf', 'gif', 'mp4', 'png', 'json'];

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveAssetDirectory(projectRoot, outputPath) {
  if (typeof outputPath !== 'string' || !outputPath.trim() || path.isAbsolute(outputPath)) {
    throw new Error('A pasta do asset precisa ser relativa à raiz do projeto.');
  }
  const root = path.resolve(projectRoot);
  const directory = path.resolve(root, outputPath);
  if (!isInside(root, directory) || directory === root) {
    throw new Error('A pasta do asset precisa permanecer dentro da raiz do projeto.');
  }
  return directory;
}

function stageDirectory(projectRoot, outputPath, assetType, stageIndex) {
  const folders = STAGE_FOLDERS[assetType];
  if (!folders || !Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= folders.length) {
    throw new Error('Etapa manual inválida.');
  }
  const assetDirectory = resolveAssetDirectory(projectRoot, outputPath);
  const directory = path.resolve(assetDirectory, folders[stageIndex]);
  if (!isInside(assetDirectory, directory)) throw new Error('A pasta da etapa está fora da pasta do asset.');
  return directory;
}

function stageLabel(assetType, stageIndex) {
  const labels = STAGE_LABELS[assetType];
  if (!labels || !Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= labels.length) {
    throw new Error('Etapa manual inválida.');
  }
  return labels[stageIndex];
}

function stageFilters(assetType, stageIndex) {
  if (!STAGE_FOLDERS[assetType] || !Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 4) {
    throw new Error('Etapa manual inválida.');
  }
  if (stageIndex === 0) return [{ name: 'Brief em Markdown', extensions: ['md'] }];
  if (stageIndex === 1) return [{ name: 'Imagens de referência', extensions: IMAGE_EXTENSIONS }];
  if (stageIndex === 2) return [{ name: 'Modelos 3D', extensions: MODEL_EXTENSIONS }];
  if (stageIndex === 3) {
    return [{ name: 'Rig, animação ou movimento', extensions: assetType === 'item' ? ITEM_MOTION_EXTENSIONS : CHARACTER_MOTION_EXTENSIONS }];
  }
  return [{ name: 'Spritesheet e metadados', extensions: ['png', 'json'] }];
}

function validateStageOutputs(assetType, stageIndex, outputPaths) {
  if (!Array.isArray(outputPaths) || outputPaths.length === 0) {
    throw new Error('Selecione ao menos um arquivo real para registrar esta etapa.');
  }
  const extensions = new Set(outputPaths.map((outputPath) => path.extname(outputPath).slice(1).toLowerCase()));
  if (stageIndex === 0 && !extensions.has('md')) {
    throw new Error('O brief precisa ser um arquivo Markdown (.md).');
  }
  if (stageIndex === 1 && ![...extensions].some((extension) => IMAGE_EXTENSIONS.includes(extension))) {
    throw new Error('Selecione ao menos uma imagem de referência (.png, .jpg, .jpeg ou .webp).');
  }
  if (stageIndex === 2 && ![...extensions].some((extension) => MODEL_EXTENSIONS.includes(extension))) {
    throw new Error('Selecione ao menos um modelo 3D (.blend, .glb, .gltf, .fbx, .obj ou .stl).');
  }
  if (stageIndex === 3) {
    const allowed = assetType === 'item' ? ITEM_MOTION_EXTENSIONS : CHARACTER_MOTION_EXTENSIONS;
    if (![...extensions].some((extension) => allowed.includes(extension))) {
      throw new Error('O arquivo selecionado não tem um formato de rig, animação ou movimento compatível.');
    }
  }
  if (stageIndex === 4 && (!extensions.has('png') || !extensions.has('json'))) {
    throw new Error('Para concluir o spritesheet, selecione o PNG e o JSON de metadados.');
  }
  return true;
}

module.exports = {
  isInside,
  resolveAssetDirectory,
  stageDirectory,
  stageFilters,
  stageLabel,
  validateStageOutputs,
};
