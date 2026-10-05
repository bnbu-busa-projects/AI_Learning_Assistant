const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopRuntime", {
    getState: () => ipcRenderer.invoke("runtime:get-state"),
    retry: () => ipcRenderer.invoke("runtime:retry"),
    openDiagnostics: () => ipcRenderer.invoke("runtime:open-diagnostics"),
    revealPath: (targetPath) => ipcRenderer.invoke("runtime:reveal-path", targetPath),
    onState: (callback) => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on("runtime:state", listener);
        return () => ipcRenderer.removeListener("runtime:state", listener);
    },
});
