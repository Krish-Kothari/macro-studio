import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("macroSystem", {
  openUrl: (url: string) => ipcRenderer.invoke("system:open-url", url),
  chooseApplication: () => ipcRenderer.invoke("system:choose-application") as Promise<string | undefined>,
  openApplication: (applicationPath: string) => ipcRenderer.invoke("system:open-application", applicationPath)
});
