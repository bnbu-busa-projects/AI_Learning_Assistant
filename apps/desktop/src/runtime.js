const { execFile: execFileCallback } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const STARTUP_STATES = Object.freeze([
    "checking_docker",
    "starting_services",
    "waiting_for_backend",
    "ready",
    "failed",
]);

const DEFAULT_BACKEND_URL = "http://127.0.0.1:14242";
const DEFAULT_COMPOSE_PROJECT = "ai-learning-assistant";
const DEFAULT_BACKEND_TIMEOUT_MS = 300_000;
const DEFAULT_BACKEND_POLL_MS = 1_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;
const COMPOSE_CANDIDATES = Object.freeze([
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
]);

class ShellRuntimeError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "ShellRuntimeError";
        this.code = code;
        this.details = details;
    }
}

function projectRootFromDesktopDir(desktopDir = __dirname) {
    return path.resolve(desktopDir, "../../..");
}

function buildWorkbenchUrl(backendUrl = DEFAULT_BACKEND_URL) {
    return `${backendUrl.replace(/\/$/u, "")}/ui/`;
}

function createRuntimeEvent(state, message, details = {}) {
    if (!STARTUP_STATES.includes(state)) {
        throw new Error(`Unknown runtime state: ${state}`);
    }
    return {
        state,
        message,
        details,
        timestamp: new Date().toISOString(),
    };
}

function emitState(onState, state, message, details = {}) {
    const event = createRuntimeEvent(state, message, details);
    onState(event);
    return event;
}

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFileCallback(
            command,
            args,
            {
                timeout: DEFAULT_COMMAND_TIMEOUT_MS,
                windowsHide: true,
                ...options,
            },
            (error, stdout, stderr) => {
                if (error) {
                    error.stdout = stdout;
                    error.stderr = stderr;
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            }
        );
    });
}

async function checkDocker(execFile = execFileAsync) {
    try {
        await execFile("docker", ["--version"], { timeout: 10_000 });
    } catch (error) {
        throw new ShellRuntimeError(
            "docker_not_installed",
            "Docker Desktop was not found. Install Docker Desktop and try again.",
            { stderr: sanitizeOutput(error.stderr || error.message) }
        );
    }

    try {
        const result = await execFile("docker", ["info", "--format", "{{json .ServerVersion}}"], {
            timeout: 15_000,
        });
        return { version: String(result.stdout || "").trim().replace(/^"|"$/gu, "") };
    } catch (error) {
        throw new ShellRuntimeError(
            "docker_not_running",
            "Docker Desktop is installed but not running. Start Docker Desktop and retry.",
            { stderr: sanitizeOutput(error.stderr || error.message) }
        );
    }
}

function findComposeFile(projectRoot) {
    for (const candidate of COMPOSE_CANDIDATES) {
        const resolved = path.join(projectRoot, candidate);
        if (existsSync(resolved)) {
            return resolved;
        }
    }
    return null;
}

async function startComposeServices({
    projectRoot,
    composeFile,
    composeProject = DEFAULT_COMPOSE_PROJECT,
    execFile = execFileAsync,
}) {
    const resolvedComposeFile = composeFile || findComposeFile(projectRoot);
    if (!resolvedComposeFile) {
        return {
            started: false,
            missing: true,
            message: "No Docker Compose file was found for this repository yet.",
        };
    }

    try {
        const result = await execFile(
            "docker",
            ["compose", "-p", composeProject, "-f", resolvedComposeFile, "up", "-d"],
            { cwd: projectRoot, timeout: DEFAULT_COMMAND_TIMEOUT_MS }
        );
        return {
            started: true,
            composeFile: resolvedComposeFile,
            stdout: sanitizeOutput(result.stdout),
            stderr: sanitizeOutput(result.stderr),
        };
    } catch (error) {
        throw new ShellRuntimeError(
            "compose_failed",
            "Docker Compose failed to start the backend services.",
            {
                composeFile: resolvedComposeFile,
                stderr: sanitizeOutput(error.stderr || error.message),
            }
        );
    }
}

async function isBackendHealthy(backendUrl, fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== "function") {
        throw new ShellRuntimeError("fetch_unavailable", "Backend health checks need fetch.");
    }

    const healthUrl = `${backendUrl.replace(/\/$/u, "")}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);
    try {
        const response = await fetchImpl(healthUrl, { signal: controller.signal });
        return Boolean(response && response.ok);
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForBackend({
    backendUrl,
    timeoutMs = DEFAULT_BACKEND_TIMEOUT_MS,
    intervalMs = DEFAULT_BACKEND_POLL_MS,
    fetch: fetchImpl = globalThis.fetch,
}) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await isBackendHealthy(backendUrl, fetchImpl)) {
            return { healthy: true };
        }
        await sleep(intervalMs);
    }
    throw new ShellRuntimeError(
        "backend_unhealthy",
        "The backend health endpoint did not become ready in time.",
        { backendUrl }
    );
}

async function runStartupSequence(options = {}) {
    const projectRoot = options.projectRoot || projectRootFromDesktopDir();
    const backendUrl = options.backendUrl || process.env.AILA_BACKEND_URL || DEFAULT_BACKEND_URL;
    const workbenchUrl = options.workbenchUrl || buildWorkbenchUrl(backendUrl);
    const onState = options.onState || (() => {});
    const execFile = options.execFile || execFileAsync;
    const fetchImpl = options.fetch || globalThis.fetch;
    let composeResult = null;

    try {
        emitState(onState, "checking_docker", "Checking Docker Desktop availability.");
        const docker = await checkDocker(execFile);

        if (options.checkBackendBeforeCompose !== false) {
            const alreadyHealthy = await isBackendHealthy(backendUrl, fetchImpl);
            if (alreadyHealthy) {
                const event = emitState(onState, "ready", "Backend is already healthy.", {
                    backendUrl,
                    workbenchUrl,
                    docker,
                });
                return { ...event, backendUrl, workbenchUrl };
            }
        }

        emitState(onState, "starting_services", "Starting Docker Compose services.", { docker });
        composeResult = await startComposeServices({
            projectRoot,
            composeFile: options.composeFile,
            composeProject: options.composeProject,
            execFile,
        });

        emitState(onState, "waiting_for_backend", "Waiting for backend health.", {
            backendUrl,
            compose: composeResult,
        });
        await waitForBackend({
            backendUrl,
            timeoutMs: options.backendTimeoutMs,
            intervalMs: options.backendPollMs,
            fetch: fetchImpl,
        });

        const event = emitState(onState, "ready", "Backend is healthy. Loading workbench.", {
            backendUrl,
            workbenchUrl,
            compose: composeResult,
            docker,
        });
        return { ...event, backendUrl, workbenchUrl };
    } catch (error) {
        const failure = error instanceof ShellRuntimeError
            ? error
            : new ShellRuntimeError("runtime_failed", "Desktop runtime startup failed.", {
                stderr: sanitizeOutput(error.stderr || error.message),
            });
        const event = emitState(onState, "failed", failure.message, {
            code: failure.code,
            backendUrl,
            workbenchUrl,
            compose: composeResult,
            ...failure.details,
        });
        return { ...event, backendUrl, workbenchUrl };
    }
}

function sanitizeOutput(value, maxChars = 4000) {
    const text = String(value || "")
        .replace(/sk-[A-Za-z0-9_-]{8,}/gu, "[redacted-key]")
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [redacted-token]")
        .replace(/(api[_-]?key|authorization|token|password|secret)\s*[:=]\s*[^,\s}\]]+/giu, "$1=[redacted]")
        .trim();
    if (text.length <= maxChars) {
        return text;
    }
    return `${text.slice(-maxChars)}\n[log tail truncated to ${maxChars} characters]`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    COMPOSE_CANDIDATES,
    DEFAULT_BACKEND_URL,
    DEFAULT_COMPOSE_PROJECT,
    STARTUP_STATES,
    ShellRuntimeError,
    buildWorkbenchUrl,
    checkDocker,
    createRuntimeEvent,
    execFileAsync,
    findComposeFile,
    isBackendHealthy,
    projectRootFromDesktopDir,
    runStartupSequence,
    sanitizeOutput,
    startComposeServices,
    waitForBackend,
};
