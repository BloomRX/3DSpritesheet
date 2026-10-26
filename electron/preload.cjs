const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('liaForge', Object.freeze({
  isDesktop: true,
  readWorkspaceAssets: () => ipcRenderer.invoke('lia-forge:assets:read'),
  writeWorkspaceAssets: (assets) => ipcRenderer.invoke('lia-forge:assets:write', assets),
  openAssetStageFolder: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:open-folder', payload),
  completeAssetStageManually: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:complete-stage', payload),
  skipOptionalAssetStage: (payload) => ipcRenderer.invoke('lia-forge:assets:manual:skip-stage', payload),
  getExternalToolStatus: () => ipcRenderer.invoke('lia-forge:tools:status'),
  openExternalTool: (payload) => ipcRenderer.invoke('lia-forge:tools:open', payload),
  chooseAndOpenExternalApplication: (payload) => ipcRenderer.invoke('lia-forge:tools:choose-and-open', payload),
  openComfyUiInterface: (payload) => ipcRenderer.invoke('lia-forge:tools:open-comfyui', payload),
  getComfyUiStatus: () => ipcRenderer.invoke('lia-forge:comfyui:status'),
  listComfyUiWorkflows: () => ipcRenderer.invoke('lia-forge:comfyui:workflows:list'),
  readComfyUiWorkflow: (workflowId) => ipcRenderer.invoke('lia-forge:comfyui:workflows:read', workflowId),
  getManagedProcesses: () => ipcRenderer.invoke('lia-forge:processes:list'),
  reportActivities: (activities) => ipcRenderer.send('lia-forge:activities:report', activities),
}));
