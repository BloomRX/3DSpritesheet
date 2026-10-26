const assert = require('node:assert/strict');
const { ManagedProcessRegistry, buildCloseReport, normalizeActivity } = require('../electron/task-manager.cjs');

async function main() {
  const empty = buildCloseReport({ activities: [], managedProcesses: [], comfyStatus: { connected: true, queue: { running: 0, pending: 0 } } });
  assert.equal(empty.hasActivity, false);

  const report = buildCloseReport({
    activities: [
      { kind: 'external', label: 'Etapa registrada', detail: 'Modelo 3D · personagem Mira', progress: 40 },
      { kind: 'external', label: 'Etapa MCP', detail: 'Rig & animação', progress: 25 },
    ],
    managedProcesses: [{ label: 'worker iniciada pela Lia Forge', pid: 9876 }],
    comfyStatus: { connected: true, queue: { running: 1, pending: 2 } },
  });
  assert.equal(report.hasActivity, true);
  assert.equal(report.managedCount, 1);
  assert.equal(report.workspaceActivityCount, 2);
  assert.equal(report.externalComfyJobs, 3);
  assert.match(report.details, /worker iniciada pela Lia Forge/);
  assert.match(report.details, /ComfyUI externo: 1 workflow/);
  assert.match(report.details, /não iniciou nem cancelará/);
  assert.equal(normalizeActivity({ label: 'x\nmalicious', progress: 101 }).label, 'x malicious');
  assert.equal(normalizeActivity({ label: 'x', progress: 101 }).progress, 100);

  const registry = new ManagedProcessRegistry();
  const { child, task } = registry.start(
    'worker de teste',
    process.execPath,
    ['-e', 'setTimeout(() => {}, 60000)'],
    { stdio: 'ignore' },
  );
  assert.ok(task.id);
  assert.equal(registry.list().length, 1);
  const stopped = await registry.stopAll({ timeoutMs: 500 });
  assert.equal(stopped.remaining.length, 0);
  assert.equal(registry.list().length, 0);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  console.log('Task manager smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
