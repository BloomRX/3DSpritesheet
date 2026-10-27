const assert = require('node:assert/strict');
const { WorkflowRunner, validatePlan } = require('../electron/workflow-runner.cjs');

async function main() {
  const order = [];
  const persisted = [];
  const events = [];
  const runner = new WorkflowRunner({
    adapters: {
      prepare: async ({ reportProgress }) => {
        order.push('prepare');
        await reportProgress({ progress: 50, message: 'Preparando insumos' });
        return { outputs: ['refs/concept.png'], note: 'Imagem real salva.' };
      },
      pack: async ({ run }) => {
        assert.equal(run.steps[0].status, 'completed');
        order.push('pack');
        return { outputs: ['sprites/sheet.png', 'sprites/sheet.json'] };
      },
    },
    persist: async (run) => persisted.push(run),
    onEvent: (event) => events.push(event.event),
  });
  const run = await runner.run({
    id: '12345678-1234-4234-8234-123456789abc',
    workflowId: 'smoke-workflow',
    assetId: 'test-asset',
    steps: [
      { id: 'prepare', title: 'Preparar', adapter: 'prepare', dependsOn: [] },
      { id: 'pack', title: 'Empacotar', adapter: 'pack', dependsOn: ['prepare'] },
    ],
  });
  assert.deepEqual(order, ['prepare', 'pack']);
  assert.equal(run.status, 'completed');
  assert.equal(run.progress, 100);
  assert.deepEqual(run.result.outputs, ['refs/concept.png', 'sprites/sheet.png', 'sprites/sheet.json']);
  assert(events.includes('step-progress'));
  assert(events.includes('run-completed'));
  assert(persisted.length >= 6);

  assert.throws(() => validatePlan({ workflowId: 'bad', steps: [{ id: 'x', adapter: 'missing' }] }, {}), /Adapter indisponível/);
  assert.throws(() => validatePlan({ workflowId: 'bad', steps: [{ id: 'b', adapter: 'ok', dependsOn: ['a'] }] }, { ok: async () => ({ outputs: [] }) }), /precisa aparecer antes/);

  const failedRunner = new WorkflowRunner({ adapters: { unavailable: async () => { throw Object.assign(new Error('provider ausente'), { code: 'WORKFLOW_BLOCKED' }); } } });
  await assert.rejects(failedRunner.run({
    workflowId: 'blocked-workflow',
    assetId: 'test-asset',
    steps: [{ id: 'provider', adapter: 'unavailable' }],
  }), (error) => error.code === 'WORKFLOW_BLOCKED' && error.run.status === 'blocked');

  let signalSeen = false;
  const cancelRunner = new WorkflowRunner({ adapters: {
    wait: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        signalSeen = true;
        reject(Object.assign(new Error('cancelled'), { code: 'WORKFLOW_CANCELLED' }));
      }, { once: true });
    }),
  } });
  const cancelPromise = cancelRunner.run({ id: 'cancel-run', workflowId: 'cancel-test', steps: [{ id: 'wait', adapter: 'wait' }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelRunner.cancel('cancel-run'), true);
  await assert.rejects(cancelPromise, (error) => error.code === 'WORKFLOW_CANCELLED' && error.run.status === 'cancelled');
  assert.equal(signalSeen, true);

  const persistFailureRunner = new WorkflowRunner({
    adapters: { fast: async () => ({ outputs: [] }) },
    persist: async () => { throw new Error('disk indisponível'); },
  });
  await assert.rejects(persistFailureRunner.run({
    id: 'persist-failure-run', workflowId: 'persist-failure', steps: [{ id: 'step', adapter: 'fast' }],
  }), /persistir o estado do workflow/);
  assert.equal(persistFailureRunner.activeRunId, null, 'A falha ao persistir o evento inicial must release the runner lock.');
  assert.equal(persistFailureRunner.get('persist-failure-run').status, 'failed');

  console.log('Workflow runner smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
