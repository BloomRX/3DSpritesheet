import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverPath = path.join(repositoryRoot, 'scripts', 'spriteforge-mcp.mjs');
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spriteforge-mcp-'));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: temporaryRoot,
  env: {
    ...process.env,
    SPRITEFORGE_HOME: repositoryRoot,
    SPRITEFORGE_PROJECT_ROOT: temporaryRoot,
  },
  stderr: 'pipe',
});
const client = new Client({ name: 'spriteforge-smoke-test', version: '1.0.0' });

function parseResult(response) {
  if (response.isError) throw new Error(response.content?.map((part) => part.text).join('\n') || 'MCP tool failed');
  const text = response.content?.find((part) => part.type === 'text')?.text;
  assert.ok(text, 'tool returned JSON text');
  return JSON.parse(text);
}

try {
  await client.connect(transport);
  const listedTools = await client.listTools();
  const toolNames = new Set(listedTools.tools.map((tool) => tool.name));
  for (const name of [
    'spriteforge_get_status',
    'spriteforge_comfyui_status',
    'spriteforge_list_comfyui_workflows',
    'spriteforge_list_free_models',
    'spriteforge_list_assets',
    'spriteforge_create_asset',
    'spriteforge_add_reference',
    'spriteforge_prepare_task',
    'spriteforge_update_stage',
    'spriteforge_open_panel',
  ]) assert.ok(toolNames.has(name), `tool ${name} is registered`);

  const comfyStatus = parseResult(await client.callTool({ name: 'spriteforge_comfyui_status', arguments: {} }));
  assert.equal(typeof comfyStatus.connected, 'boolean');
  assert.ok(comfyStatus.connected ? Array.isArray(comfyStatus.devices) : Boolean(comfyStatus.error));
  const comfyWorkflows = parseResult(await client.callTool({ name: 'spriteforge_list_comfyui_workflows', arguments: {} }));
  assert.equal(comfyWorkflows.workflows.length, 2);
  assert.ok(comfyWorkflows.workflows.every((workflow) => workflow.available));
  const runtime = parseResult(await client.callTool({ name: 'spriteforge_get_status', arguments: {} }));
  assert.ok(runtime.tools.comfyui);
  assert.match(runtime.note, /não inicia workflows/i);

  const catalog = parseResult(await client.callTool({ name: 'spriteforge_list_free_models', arguments: {} }));
  assert.ok(catalog.models.some((model) => model.id === 'qwen2.5-coder:7b'));
  assert.match(catalog.note, /Nenhum modelo vem selecionado/);

  const created = parseResult(await client.callTool({
    name: 'spriteforge_create_asset',
    arguments: {
      name: 'Batedora da Névoa',
      type: 'character',
      brief: 'Uma personagem exploradora, com capa curta e silhueta legível.',
      visualPrompt: 'Fantasia acolhedora, tecido verde e metal envelhecido.',
      animations: ['Idle', 'Walk'],
      targetFrameSize: '64 × 64 px',
    },
  }));
  const asset = created.asset;
  assert.equal(asset.id, 'batedora-da-nevoa');
  assert.equal(asset.type, 'character');
  assert.equal(asset.completed.length, 5);
  assert.equal(asset.startStageIndex, 0);

  const list = parseResult(await client.callTool({ name: 'spriteforge_list_assets', arguments: {} }));
  assert.equal(list.assets.length, 1);
  assert.equal(list.assets[0].id, asset.id);

  const referenceDirectory = path.join(temporaryRoot, 'incoming');
  await fs.mkdir(referenceDirectory, { recursive: true });
  await fs.writeFile(path.join(referenceDirectory, 'sketch.png'), Buffer.from('test image'));
  const reference = parseResult(await client.callTool({
    name: 'spriteforge_add_reference',
    arguments: { assetId: asset.id, sourcePath: 'incoming/sketch.png' },
  }));
  assert.equal(reference.reference, `.spriteforge/assets/${asset.id}/references/sketch.png`);

  const prepared = parseResult(await client.callTool({
    name: 'spriteforge_prepare_task',
    arguments: { assetId: asset.id, agent: 'opencode' },
  }));
  const task = JSON.parse(await fs.readFile(path.join(temporaryRoot, prepared.task), 'utf8'));
  assert.equal(task.schemaVersion, '2.0');
  assert.equal(task.agent, 'opencode');
  assert.equal(task.asset.id, asset.id);
  assert.equal(task.asset.referenceFile, reference.reference);
  assert.equal(task.asset.workflowId, '3d_to_2d');
  assert.equal(task.asset.startStageIndex, 0);
  assert.equal(task.workflow.length, 5);
  assert.ok(task.workflow.every((stage) => stage.execution === 'run'));
  assert.ok((await fs.stat(prepared.schema)).isFile());
  assert.ok((await fs.readFile(path.join(temporaryRoot, prepared.prompt), 'utf8')).includes('Não invente'));
  assert.ok((await fs.stat(path.join(temporaryRoot, prepared.brief))).isFile());

  const outOfOrder = await client.callTool({
    name: 'spriteforge_update_stage',
    arguments: { assetId: asset.id, stageIndex: 1, status: 'completed', outputs: [reference.reference] },
  });
  assert.equal(outOfOrder.isError, true, 'stage completion requires registered preceding outputs');

  const completedBrief = parseResult(await client.callTool({
    name: 'spriteforge_update_stage',
    arguments: {
      assetId: asset.id,
      stageIndex: 0,
      status: 'completed',
      outputs: [`${asset.outputPath}/brief.md`],
      note: 'Brief de origem revisado.',
    },
  }));
  assert.equal(completedBrief.status, 'completed');

  const completedViews = parseResult(await client.callTool({
    name: 'spriteforge_update_stage',
    arguments: {
      assetId: asset.id,
      stageIndex: 1,
      status: 'completed',
      outputs: [reference.reference],
    },
  }));
  assert.equal(completedViews.status, 'completed');

  const attemptedTraversal = await client.callTool({
    name: 'spriteforge_create_asset',
    arguments: {
      name: 'Unsafe path',
      type: 'item',
      itemKind: 'tool',
      brief: 'brief',
      visualPrompt: 'prompt',
      outputPath: '../outside',
    },
  });
  assert.equal(attemptedTraversal.isError, true, 'the server rejects output paths outside the project');

  await fs.writeFile(path.join(referenceDirectory, 'existing-model.glb'), Buffer.from('test model source'));
  const partialCreated = parseResult(await client.callTool({
    name: 'spriteforge_create_asset',
    arguments: {
      name: 'Modelo Existente',
      type: 'character',
      brief: 'Personagem com modelo fonte já disponível.',
      visualPrompt: 'Preservar o design do modelo fornecido.',
      entryPointId: 'model',
      startStageIndex: 3,
      existingInputs: [{ path: 'incoming/existing-model.glb', stageIndex: 2 }],
    },
  }));
  const partialAsset = partialCreated.asset;
  assert.equal(partialAsset.startStageIndex, 3);
  assert.equal(partialAsset.existingInputs[0].stageIndex, 2);
  const partialPrepared = parseResult(await client.callTool({
    name: 'spriteforge_prepare_task',
    arguments: { assetId: partialAsset.id, agent: 'codex' },
  }));
  const partialTask = JSON.parse(await fs.readFile(path.join(temporaryRoot, partialPrepared.task), 'utf8'));
  assert.equal(partialPrepared.brief, null, 'handoff does not create an upstream brief for a resumed task');
  assert.equal(partialTask.asset.startStageIndex, 3);
  assert.equal(partialTask.asset.existingInputs[0].path, 'incoming/existing-model.glb');
  assert.deepEqual(partialTask.workflow.map((stage) => stage.execution), ['skip', 'skip', 'skip', 'run', 'run']);
  assert.match(await fs.readFile(path.join(temporaryRoot, partialPrepared.prompt), 'utf8'), /Comece na etapa 4 \(Rig & animação\)/);

  const partialRigOutput = `${partialAsset.outputPath}/rig/character.fbx`;
  const partialRigAbsolute = path.join(temporaryRoot, partialRigOutput);
  await fs.mkdir(path.dirname(partialRigAbsolute), { recursive: true });
  await fs.writeFile(partialRigAbsolute, Buffer.from('verified rig artifact'));
  const completedPartialRig = parseResult(await client.callTool({
    name: 'spriteforge_update_stage',
    arguments: { assetId: partialAsset.id, stageIndex: 3, status: 'completed', outputs: [partialRigOutput], note: 'Rig validado a partir do modelo de entrada.' },
  }));
  assert.equal(completedPartialRig.status, 'completed', 'the task can resume at an existing model without completing earlier stages');
  const forbiddenUpstreamCompletion = await client.callTool({
    name: 'spriteforge_update_stage',
    arguments: { assetId: partialAsset.id, stageIndex: 2, status: 'completed', outputs: ['incoming/existing-model.glb'] },
  });
  assert.equal(forbiddenUpstreamCompletion.isError, true, 'stages before the selected entry point are not marked complete');

  const missingInputAsset = parseResult(await client.callTool({
    name: 'spriteforge_create_asset',
    arguments: {
      name: 'Entrada ausente',
      type: 'character',
      brief: 'Entrada de teste que não existe.',
      visualPrompt: 'Teste de validação de caminho.',
      entryPointId: 'model',
      startStageIndex: 3,
      existingInputs: [{ path: 'incoming/nao-existe.glb', stageIndex: 2 }],
    },
  }));
  const missingInputTask = await client.callTool({
    name: 'spriteforge_prepare_task',
    arguments: { assetId: missingInputAsset.asset.id, agent: 'agnostic' },
  });
  assert.equal(missingInputTask.isError, true, 'handoff refuses a supplied artifact path that does not exist');

  const finalStore = JSON.parse(await fs.readFile(path.join(temporaryRoot, '.spriteforge', 'assets.json'), 'utf8'));
  const storedOriginal = finalStore.assets.find((candidate) => candidate.id === asset.id);
  const storedPartial = finalStore.assets.find((candidate) => candidate.id === partialAsset.id);
  assert.equal(storedOriginal.stageStatus[0].status, 'completed');
  assert.equal(storedOriginal.stageStatus[1].outputs[0], reference.reference);
  assert.equal(storedPartial.stageStatus[0].status, 'pending', 'skipped stages are not rewritten as completed');
  assert.equal(storedPartial.stageStatus[3].status, 'completed');
  console.log('MCP smoke test passed.');
} finally {
  await client.close().catch(() => {});
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
