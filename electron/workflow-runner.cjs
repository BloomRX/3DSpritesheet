const { randomUUID } = require('node:crypto');

function cleanMessage(value, limit = 500) {
  return String(value || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').slice(0, limit);
}

function validatePlan(plan, adapters) {
  if (!plan || typeof plan !== 'object' || typeof plan.workflowId !== 'string' || !plan.workflowId.trim()) {
    throw new Error('Workflow inválido: informe workflowId.');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0 || plan.steps.length > 30) {
    throw new Error('Workflow inválido: steps precisa ter entre 1 e 30 etapas.');
  }
  const seen = new Set();
  for (const [index, step] of plan.steps.entries()) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || seen.has(step.id)) {
      throw new Error(`Workflow inválido: id da etapa ${index + 1} ausente ou repetido.`);
    }
    if (typeof step.adapter !== 'string' || typeof adapters[step.adapter] !== 'function') {
      throw new Error(`Adapter indisponível para a etapa ${step.id}: ${step.adapter || '(não informado)'}.`);
    }
    const dependencies = Array.isArray(step.dependsOn) ? step.dependsOn : [];
    for (const dependency of dependencies) {
      if (!seen.has(dependency)) throw new Error(`Dependência ${dependency} precisa aparecer antes de ${step.id}.`);
    }
    seen.add(step.id);
  }
  return true;
}

class WorkflowRunner {
  constructor({ adapters = {}, persist = async () => {}, onEvent = () => {} } = {}) {
    this.adapters = adapters;
    this.persist = persist;
    this.onEvent = onEvent;
    this.runs = new Map();
    this.activeRunId = null;
  }

  snapshot(run) {
    return JSON.parse(JSON.stringify(run));
  }

  async publish(run, event, step = null) {
    const snapshot = this.snapshot(run);
    try { await this.persist(snapshot); } catch (error) {
      throw new Error(`Não foi possível persistir o estado do workflow: ${error.message || error}`);
    }
    try { this.onEvent({ event, run: snapshot, stepId: step?.id || null }); } catch { /* UI event delivery is best-effort. */ }
  }

  async run(plan, context = {}) {
    validatePlan(plan, this.adapters);
    if (this.activeRunId) throw new Error('Já existe um workflow executando nesta instância.');
    const controller = new AbortController();
    const run = {
      id: plan.id || randomUUID(),
      workflowId: plan.workflowId,
      assetId: String(plan.assetId || ''),
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: plan.steps.map((step) => ({
        id: step.id,
        title: cleanMessage(step.title || step.id, 120),
        adapter: step.adapter,
        status: 'pending',
        progress: 0,
        note: '',
        outputs: [],
        startedAt: null,
        completedAt: null,
      })),
      result: null,
      error: null,
    };
    this.runs.set(run.id, { run, controller });
    this.activeRunId = run.id;
    run.status = 'running';

    try {
      await this.publish(run, 'run-started');
      for (const stepPlan of plan.steps) {
        if (controller.signal.aborted) throw Object.assign(new Error('Workflow cancelado pelo usuário.'), { code: 'WORKFLOW_CANCELLED' });
        const step = run.steps.find((candidate) => candidate.id === stepPlan.id);
        step.status = 'in_progress';
        step.startedAt = new Date().toISOString();
        step.note = 'Executando adapter local.';
        run.updatedAt = step.startedAt;
        await this.publish(run, 'step-started', step);

        const adapter = this.adapters[stepPlan.adapter];
        const result = await adapter({
          ...context,
          step: { ...stepPlan },
          run: this.snapshot(run),
          signal: controller.signal,
          reportProgress: async ({ progress, message }) => {
            if (controller.signal.aborted) return;
            step.progress = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : step.progress;
            step.note = cleanMessage(message || step.note);
            run.progress = Math.round((run.steps.reduce((total, current) => total + current.progress, 0)) / run.steps.length);
            run.updatedAt = new Date().toISOString();
            await this.publish(run, 'step-progress', step);
          },
        });
        if (controller.signal.aborted) throw Object.assign(new Error('Workflow cancelado pelo usuário.'), { code: 'WORKFLOW_CANCELLED' });
        if (!result || !Array.isArray(result.outputs)) throw new Error(`O adapter ${stepPlan.adapter} não retornou uma lista de outputs verificados.`);
        step.status = 'completed';
        step.progress = 100;
        step.outputs = result.outputs.map((output) => cleanMessage(output, 500));
        step.note = cleanMessage(result.note || 'Outputs reais produzidos e verificados.');
        step.completedAt = new Date().toISOString();
        run.progress = Math.round((run.steps.reduce((total, current) => total + current.progress, 0)) / run.steps.length);
        run.updatedAt = step.completedAt;
        await this.publish(run, 'step-completed', step);
      }
      run.status = 'completed';
      run.progress = 100;
      run.result = { outputs: run.steps.flatMap((step) => step.outputs) };
      run.updatedAt = new Date().toISOString();
      await this.publish(run, 'run-completed');
      return this.snapshot(run);
    } catch (error) {
      run.status = error?.code === 'WORKFLOW_CANCELLED' ? 'cancelled' : error?.code === 'WORKFLOW_BLOCKED' ? 'blocked' : 'failed';
      const active = run.steps.find((step) => step.status === 'in_progress');
      if (active) {
        active.status = run.status;
        active.note = cleanMessage(error.message || error);
      }
      run.error = cleanMessage(error.message || error);
      run.updatedAt = new Date().toISOString();
      await this.publish(run, `run-${run.status}`, active);
      throw Object.assign(new Error(run.error), { code: error?.code || 'WORKFLOW_FAILED', run: this.snapshot(run) });
    } finally {
      this.activeRunId = null;
    }
  }

  cancel(runId) {
    const entry = this.runs.get(runId);
    if (!entry || entry.run.status !== 'running') return false;
    entry.controller.abort();
    return true;
  }

  get(runId) {
    const entry = this.runs.get(runId);
    return entry ? this.snapshot(entry.run) : null;
  }
}

module.exports = { WorkflowRunner, validatePlan };
