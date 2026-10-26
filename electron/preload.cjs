const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('liaForge', Object.freeze({
  isDesktop: true,
  readWorkspaceAssets: () => ipcRenderer.invoke('lia-forge:assets:read'),
  writeWorkspaceAssets: (assets) => ipcRenderer.invoke('lia-forge:assets:write', assets),
  getComfyUiStatus: () => ipcRenderer.invoke('lia-forge:comfyui:status'),
  listComfyUiWorkflows: () => ipcRenderer.invoke('lia-forge:comfyui:workflows:list'),
  readComfyUiWorkflow: (workflowId) => ipcRenderer.invoke('lia-forge:comfyui:workflows:read', workflowId),
  getManagedProcesses: () => ipcRenderer.invoke('lia-forge:processes:list'),
  reportActivities: (activities) => ipcRenderer.send('lia-forge:activities:report', activities),
}));
