import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import net from 'node:net';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spriteforge-vite-'));
const serverFile = path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const probe = net.createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
await new Promise((resolve) => probe.close(resolve));

const child = spawn(process.execPath, [serverFile, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: repositoryRoot,
  env: { ...process.env, SPRITEFORGE_PROJECT_ROOT: temporaryRoot },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (part) => { logs += part; });
child.stderr.on('data', (part) => { logs += part; });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early:\n${logs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/spriteforge/assets`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not start:\n${logs}`);
}

try {
  await waitForServer();
  const url = `http://127.0.0.1:${port}/api/spriteforge/assets`;
  const initial = await fetch(url, { headers: { Origin: `http://127.0.0.1:${port}` } });
  assert.equal(initial.status, 200);
  const initialPayload = await initial.json();
  assert.equal(initialPayload.assets, null);
  assert.equal(initialPayload.projectRoot, temporaryRoot);

  const comfyWorkflowsResponse = await fetch(`http://127.0.0.1:${port}/api/lia-forge/comfyui/workflows`, {
    headers: { Origin: `http://127.0.0.1:${port}` },
  });
  assert.equal(comfyWorkflowsResponse.status, 200);
  const comfyWorkflows = await comfyWorkflowsResponse.json();
  assert.equal(comfyWorkflows.length, 2);
  const characterTemplateResponse = await fetch(`http://127.0.0.1:${port}/api/lia-forge/comfyui/workflows/character-concept`);
  assert.equal(characterTemplateResponse.status, 200);
  assert.equal((await characterTemplateResponse.json()).workflow['1'].inputs.ckpt_name, '__SELECT_A_COMPATIBLE_CHECKPOINT__');
  const comfyStatusResponse = await fetch(`http://127.0.0.1:${port}/api/lia-forge/comfyui/status`);
  assert.equal(comfyStatusResponse.status, 200);
  assert.equal(typeof (await comfyStatusResponse.json()).connected, 'boolean');
  const comfyCrossOrigin = await fetch(`http://127.0.0.1:${port}/api/lia-forge/comfyui/workflows`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(comfyCrossOrigin.status, 403);

  const assets = [{ id: 'test-hero', type: 'character', name: 'Test Hero', completed: [false, false, false, false, false] }];
  const saved = await fetch(url, {
    method: 'PUT',
    headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).ok, true);

  const loaded = await fetch(url, { headers: { Origin: `http://127.0.0.1:${port}` } });
  assert.deepEqual((await loaded.json()).assets, assets);

  const crossOrigin = await fetch(url, { headers: { Origin: 'https://evil.example' } });
  assert.equal(crossOrigin.status, 403);

  if (process.platform !== 'win32') {
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spriteforge-outside-'));
    try {
      const outsideFile = path.join(outsideRoot, 'assets.json');
      await fs.writeFile(outsideFile, '{"assets":[]}\n', 'utf8');
      const storeFile = path.join(temporaryRoot, '.spriteforge', 'assets.json');
      await fs.rename(storeFile, `${storeFile}.saved`);
      await fs.symlink(outsideFile, storeFile);
      const symlinkRead = await fetch(url);
      assert.equal(symlinkRead.status, 500);
      const symlinkWrite = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets }),
      });
      assert.equal(symlinkWrite.status, 400);
      assert.equal(await fs.readFile(outsideFile, 'utf8'), '{"assets":[]}\n');
    } finally {
      await fs.rm(outsideRoot, { recursive: true, force: true });
    }
  }
  console.log('Vite workspace-store smoke test passed.');
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))]);
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
