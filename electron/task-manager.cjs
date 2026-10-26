const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

class ManagedProcessRegistry {
  constructor({ platform = process.platform, spawnProcess = spawn, killProcess = process.kill } = {}) {
    this.platform = platform;
    this.spawnProcess = spawnProcess;
    this.killProcess = killProcess;
    this.processes = new Map();
  }

  start(label, command, args = [], options = {}) {
    const child = this.spawnProcess(command, args, {
      ...options,
      detached: this.platform !== 'win32',
      windowsHide: true,
    });
    const task = {
      id: randomUUID(),
      label: String(label || 'Tarefa local').slice(0, 120),
      pid: child.pid || null,
      startedAt: new Date().toISOString(),
      child,
    };
    this.processes.set(task.id, task);
    const remove = () => this.processes.delete(task.id);
    child.once('exit', remove);
    child.once('error', remove);
    return { child, task: this.toPublicTask(task) };
  }

  toPublicTask(task) {
    return {
      id: task.id,
      label: task.label,
      pid: task.pid,
      startedAt: task.startedAt,
      status: task.child.exitCode === null ? 'running' : 'stopped',
    };
  }

  list() {
    return [...this.processes.values()].map((task) => this.toPublicTask(task));
  }

  async stopAll({ timeoutMs = 2500 } = {}) {
    const active = [...this.processes.values()].filter((task) => task.child.exitCode === null && task.child.signalCode === null);
    for (const task of active) this.terminate(task);
    await Promise.all(active.map((task) => this.waitForExit(task, timeoutMs)));
    for (const task of active) {
      if (task.child.exitCode === null && task.child.signalCode === null) this.forceTerminate(task);
    }
    await Promise.all(active.map((task) => this.waitForExit(task, 1000)));
    return { stopped: active.length, remaining: this.list() };
  }

  terminate(task) {
    if (!task.pid) {
      try { task.child.kill('SIGTERM'); } catch { /* process exited between checks */ }
      return;
    }
    if (this.platform === 'win32') {
      const result = spawnSync('taskkill', ['/PID', String(task.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 3000,
      });
      if (result.status === 0) return;
      try { task.child.kill('SIGTERM'); } catch { /* process exited between checks */ }
      return;
    }
    try {
      this.killProcess(-task.pid, 'SIGTERM');
    } catch {
      try { task.child.kill('SIGTERM'); } catch { /* process exited between checks */ }
    }
  }

  forceTerminate(task) {
    if (!task.pid) {
      try { task.child.kill('SIGKILL'); } catch { /* process exited between checks */ }
      return;
    }
    if (this.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(task.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 3000,
      });
      return;
    }
    try {
      this.killProcess(-task.pid, 'SIGKILL');
    } catch {
      try { task.child.kill('SIGKILL'); } catch { /* process exited between checks */ }
    }
  }

  waitForExit(task, timeoutMs) {
    if (task.child.exitCode !== null || task.child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeoutMs);
      function done() {
        clearTimeout(timer);
        task.child.removeListener('exit', done);
        resolve();
      }
      task.child.once('exit', done);
    });
  }
}

function normalizeActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;
  const label = String(activity.label || activity.name || 'Tarefa ativa').replace(/[\r\n]/g, ' ').slice(0, 150);
  const detail = String(activity.detail || '').replace(/[\r\n]/g, ' ').slice(0, 200);
  const progress = Number.isFinite(activity.progress) ? Math.max(0, Math.min(100, Math.round(activity.progress))) : null;
  return { label, detail, progress, kind: String(activity.kind || 'external').slice(0, 32) };
}

function buildCloseReport({ activities = [], managedProcesses = [], comfyStatus = null } = {}) {
  const cleanActivities = activities.map(normalizeActivity).filter(Boolean);
  const lines = [];

  if (managedProcesses.length) {
    lines.push('Processos iniciados pela Lia Forge (serão encerrados se você confirmar):');
    for (const task of managedProcesses) {
      lines.push(`• ${String(task.label || 'Tarefa local').replace(/[\r\n]/g, ' ').slice(0, 150)}${task.pid ? ` · PID ${task.pid}` : ''}`);
    }
  }

  if (cleanActivities.length) {
    lines.push('Atividades registradas no workspace (podem pertencer a agentes externos):');
    for (const activity of cleanActivities) {
      const progress = activity.progress === null ? '' : ` · ${activity.progress}%`;
      lines.push(`• ${activity.label}${progress}${activity.detail ? ` — ${activity.detail}` : ''}`);
    }
  }

  const running = Number(comfyStatus?.queue?.running) || 0;
  const pending = Number(comfyStatus?.queue?.pending) || 0;
  if (comfyStatus?.connected && (running > 0 || pending > 0)) {
    lines.push(`ComfyUI externo: ${running} workflow(s) em execução, ${pending} na fila. A Lia Forge não iniciou nem cancelará esses trabalhos ao fechar.`);
  }

  const hasActivity = managedProcesses.length > 0 || cleanActivities.length > 0 || (comfyStatus?.connected && (running > 0 || pending > 0));
  return {
    hasActivity: Boolean(hasActivity),
    details: lines.join('\n'),
    managedCount: managedProcesses.length,
    workspaceActivityCount: cleanActivities.length,
    externalComfyJobs: running + pending,
  };
}

module.exports = { ManagedProcessRegistry, buildCloseReport, normalizeActivity };
