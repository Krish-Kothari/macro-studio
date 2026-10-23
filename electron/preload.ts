import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("macroSystem", {
  openUrl: (url: string) => ipcRenderer.invoke("system:open-url", url),
  chooseApplication: () => ipcRenderer.invoke("system:choose-application") as Promise<string | undefined>,
  chooseMedia: () => ipcRenderer.invoke("system:choose-media") as Promise<string | undefined>,
  openApplication: (applicationPath: string) => ipcRenderer.invoke("system:open-application", applicationPath),
  playMedia: (mediaPath: string) => ipcRenderer.invoke("system:play-media", mediaPath)
});
