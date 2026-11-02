// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { BackgroundVideoViewState as BackgroundVideoState } from "~shared/background-video";

export type { BackgroundVideoViewState as BackgroundVideoState } from "~shared/background-video";

contextBridge.exposeInMainWorld("ytmd", {
  // Block body so ipcRenderer itself is never returned through the context bridge
  onBackgroundVideoState: (callback: (state: BackgroundVideoState) => void) => {
    ipcRenderer.on("backgroundVideo:state", (event: Electron.IpcRendererEvent, state: BackgroundVideoState) => {
      callback(state);
    });
  },
  requestBackgroundVideoState: () => ipcRenderer.send("backgroundVideo:requestState")
});
