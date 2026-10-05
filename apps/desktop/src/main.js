const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const {
    DEFAULT_BACKEND_URL,
    buildWorkbenchUrl,
    projectRootFromDesktopDir,
    runStartupSequence,
} = require("./runtime");

const launchSmoke = process.env.AILA_DESKTOP_LAUNCH_SMOKE === "1";
const skipRuntimeStartup = process.env.AILA_DESKTOP_SKIP_RUNTIME === "1";
let mainWindow = null;
let latestRuntimeState = null;
let runtimeInFlight = false;
let launchSmokeFinished = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 980,
        minHeight: 680,
        title: "AI Learning Assistant",
        backgroundColor: "#151411",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    installLaunchSmokeHooks(mainWindow);
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    mainWindow.loadFile(path.join(__dirname, "shell.html")).catch((error) => {
        console.error("[desktop-launch]", error.message);
        if (launchSmoke) {
            app.exit(1);
        }
    });
}

async function startRuntime() {
    if (runtimeInFlight) {
        return latestRuntimeState;
    }
    runtimeInFlight = true;
    const backendUrl = process.env.AILA_BACKEND_URL || DEFAULT_BACKEND_URL;
    const workbenchUrl = process.env.AILA_WORKBENCH_URL || buildWorkbenchUrl(backendUrl);

    if (skipRuntimeStartup) {
        const event = {
            state: "ready",
            message: "Runtime startup skipped for Electron launch smoke.",
            details: { backendUrl, workbenchUrl, launchSmoke: true },
            timestamp: new Date().toISOString(),
            backendUrl,
            workbenchUrl,
        };
        publishRuntimeState(event);
        runtimeInFlight = false;
        return event;
    }

    const result = await runStartupSequence({
        projectRoot: projectRootFromDesktopDir(__dirname),
        backendUrl,
        workbenchUrl,
        onState: publishRuntimeState,
    });
    runtimeInFlight = false;

    if (result.state === "ready" && mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(result.workbenchUrl);
    }
    return result;
}

function installLaunchSmokeHooks(window) {
    if (!launchSmoke) return;
    let shellLoaded = false;
    let windowReady = false;

    const timeout = setTimeout(() => {
        if (launchSmokeFinished) return;
        console.error("[desktop-launch-smoke] Window did not finish loading in time.");
        app.exit(1);
    }, 15_000);

    const finishIfReady = () => {
        if (!shellLoaded || !windowReady || launchSmokeFinished) return;
        launchSmokeFinished = true;
        clearTimeout(timeout);
        console.log("[desktop-launch-smoke] BrowserWindow displayed shell page.");
        setTimeout(() => app.quit(), 50);
    };

    window.once("ready-to-show", () => {
        windowReady = true;
        finishIfReady();
    });
    window.webContents.once("did-finish-load", () => {
        shellLoaded = true;
        finishIfReady();
    });
    window.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
        launchSmokeFinished = true;
        clearTimeout(timeout);
        console.error(`[desktop-launch-smoke] ${errorCode}: ${errorDescription}`);
        app.exit(1);
    });
}

function publishRuntimeState(event) {
    latestRuntimeState = event;
    if (event.state === "failed") {
        console.error("[desktop-runtime]", event.message, event.details || {});
    } else {
        console.log("[desktop-runtime]", event.state, event.message);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("runtime:state", event);
    }
}

ipcMain.handle("runtime:get-state", () => latestRuntimeState);
ipcMain.handle("runtime:retry", () => startRuntime());
ipcMain.handle("runtime:reveal-path", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) {
        return { ok: false, message: "No artifact path was provided." };
    }
    shell.showItemInFolder(targetPath);
    return { ok: true };
});
ipcMain.handle("runtime:open-diagnostics", async () => {
    await shell.openPath(projectRootFromDesktopDir(__dirname));
    return { ok: true };
});

app.whenReady().then(() => {
    createWindow();
    startRuntime();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            startRuntime();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
