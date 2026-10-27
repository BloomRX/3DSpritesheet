import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { getComfyUiStatus, listComfyUiWorkflows, readComfyUiWorkflow, runComfyUiConcept } from '../scripts/comfyui-client.mjs';

const require = createRequire(import.meta.url);
const { makePng } = require('./png-fixtures.cjs');
const previousEndpoint = process.env.COMFYUI_URL;
let postedWorkflow = null;
let promptCount = 0;
let historyCount = 0;
const png = makePng(16, 16);
const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/prompt') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      postedWorkflow = JSON.parse(body).prompt;
      promptCount += 1;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ prompt_id: 'mock-prompt-id' }));
    });
    return;
  }
  if (request.method === 'GET' && request.url === '/history/mock-prompt-id') {
    historyCount += 1;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ 'mock-prompt-id': {
      status: historyCount === 1 ? { completed: false, status_str: 'running' } : { completed: true, status_str: 'success' },
      outputs: { '8': { images: [{ filename: 'mock-output.png', subfolder: '', type: 'output' }] } },
    } }));
    return;
  }
  if (request.method === 'GET' && request.url.startsWith('/view?')) {
    response.setHeader('Content-Type', 'image/png');
    response.end(png);
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  const payloads = {
    '/system_stats': {
      system: { comfyui_version: 'test-build', torch_version: '2.test', python_version: '3.test' },
      devices: [{ name: 'Mock AMD GPU', type: 'hip', index: 0, vram_total: 8_000_000_000, vram_free: 6_000_000_000 }],
    },
    '/queue': { queue_running: [[1, 'running-prompt-id']], queue_pending: [[2, 'pending-prompt-id'], [3, 'next-prompt-id']] },
    '/models/checkpoints': ['mock-checkpoint.safetensors'],
    '/models/loras': [],
    '/models/vae': ['mock-vae.safetensors'],
    '/models/controlnet': [],
  };
  const payload = payloads[request.url];
  if (!payload) {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  response.end(JSON.stringify(payload));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-forge-comfy-smoke-'));
try {
  process.env.COMFYUI_URL = `http://127.0.0.1:${port}`;
  const status = await getComfyUiStatus();
  assert.equal(status.connected, true);
  assert.equal(status.version, 'test-build');
  assert.deepEqual(status.queue, { running: 1, pending: 2 });
  assert.equal(status.devices[0].name, 'Mock AMD GPU');
  assert.equal(status.devices[0].vramTotalBytes, 8_000_000_000);
  assert.equal(status.models.checkpoints[0], 'mock-checkpoint.safetensors');
  assert.equal(status.modelCount, 2);
  assert.match(status.note, /ação explícita e escolha de checkpoint/i);

  const workflows = await listComfyUiWorkflows();
  assert.equal(workflows.length, 2);
  assert.ok(workflows.every((workflow) => workflow.available));
  assert.ok(workflows.every((workflow) => workflow.requiresModelSelection));
  const characterWorkflow = await readComfyUiWorkflow('character-concept');
  assert.equal(characterWorkflow.workflow['1'].inputs.ckpt_name, '__SELECT_A_COMPATIBLE_CHECKPOINT__');
  assert.equal(Object.keys(characterWorkflow.workflow).length, 7);
  await assert.rejects(() => readComfyUiWorkflow('../outside'), /desconhecido/);

  await assert.rejects(() => runComfyUiConcept({
    workflowId: 'item-concept', prompt: 'A stylized bronze lantern for a game inventory icon.',
    checkpoint: 'not-installed.safetensors', outputDirectory: path.join(tempDir, 'blocked'),
  }), /não aparece na lista/);
  assert.equal(promptCount, 0, 'An uninstalled checkpoint must never be submitted.');

  const progress = [];
  const generation = await runComfyUiConcept({
    workflowId: 'item-concept',
    prompt: 'A stylized bronze lantern for a game inventory icon.',
    checkpoint: 'mock-checkpoint.safetensors',
    outputDirectory: path.join(tempDir, 'generated'),
    onProgress: async (event) => progress.push(event),
    timeoutMs: 5000,
  });
  assert.equal(generation.promptId, 'mock-prompt-id');
  assert.equal(generation.checkpoint, 'mock-checkpoint.safetensors');
  assert.equal(generation.outputs.length, 1);
  assert.equal((await fs.readFile(generation.outputs[0])).subarray(0, 8).equals(png.subarray(0, 8)), true);
  assert.equal(promptCount, 1);
  assert.ok(historyCount >= 2, 'Intermediate output must not complete the reference stage.');
  assert.equal(postedWorkflow['1'].inputs.ckpt_name, 'mock-checkpoint.safetensors');
  assert.match(postedWorkflow['2'].inputs.text, /stylized bronze lantern/);
  assert.ok(Number.isInteger(postedWorkflow['5'].inputs.seed));
  assert.ok(progress.some((event) => /salva/.test(event.message)));

  await new Promise((resolve) => server.close(resolve));
  const unavailable = await getComfyUiStatus({ includeModels: false });
  assert.equal(unavailable.connected, false);
  assert.deepEqual(unavailable.queue, { running: 0, pending: 0 });
  console.log('ComfyUI client smoke test passed.');
} finally {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await fs.rm(tempDir, { recursive: true, force: true });
  if (previousEndpoint === undefined) delete process.env.COMFYUI_URL;
  else process.env.COMFYUI_URL = previousEndpoint;
}
