import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: "#101113",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (isDev) window.loadURL("http://localhost:5173");
  else window.loadFile(path.join(__dirname, "../dist/index.html"));
}

ipcMain.handle("system:open-url", async (_event, url: string) => {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  await shell.openExternal(parsed.toString());
  return true;
});

ipcMain.handle("system:choose-application", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose an application",
    properties: ["openFile"]
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle("system:choose-media", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose an audio file",
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "aiff"] }]
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle("system:open-application", async (_event, applicationPath: string) => {
  const pathToOpen = applicationPath.trim();
  if (!pathToOpen) throw new Error("Application path is required.");
  const error = await shell.openPath(pathToOpen);
  if (error) throw new Error(error);
  return true;
});

ipcMain.handle("system:play-media", async (_event, mediaPath: string) => {
  const pathToOpen = mediaPath.trim();
  if (!pathToOpen) throw new Error("Audio file path is required.");
  const error = await shell.openPath(pathToOpen);
  if (error) throw new Error(error);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
