import assert from 'node:assert/strict';
import http from 'node:http';
import { getComfyUiStatus, listComfyUiWorkflows, readComfyUiWorkflow } from '../scripts/comfyui-client.mjs';

const previousEndpoint = process.env.COMFYUI_URL;
const server = http.createServer((request, response) => {
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
  assert.match(status.note, /não inicia workflows/i);

  const workflows = await listComfyUiWorkflows();
  assert.equal(workflows.length, 2);
  assert.ok(workflows.every((workflow) => workflow.available));
  assert.ok(workflows.every((workflow) => workflow.requiresModelSelection));
  const characterWorkflow = await readComfyUiWorkflow('character-concept');
  assert.equal(characterWorkflow.workflow['1'].inputs.ckpt_name, '__SELECT_A_COMPATIBLE_CHECKPOINT__');
  assert.equal(Object.keys(characterWorkflow.workflow).length, 7);
  await assert.rejects(() => readComfyUiWorkflow('../outside'), /desconhecido/);

  await new Promise((resolve) => server.close(resolve));
  const unavailable = await getComfyUiStatus({ includeModels: false });
  assert.equal(unavailable.connected, false);
  assert.deepEqual(unavailable.queue, { running: 0, pending: 0 });
  console.log('ComfyUI client smoke test passed.');
} finally {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (previousEndpoint === undefined) delete process.env.COMFYUI_URL;
  else process.env.COMFYUI_URL = previousEndpoint;
}
