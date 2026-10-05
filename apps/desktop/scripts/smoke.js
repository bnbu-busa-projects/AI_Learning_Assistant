const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
    DEFAULT_BACKEND_URL,
    buildWorkbenchUrl,
    findComposeFile,
    runStartupSequence,
    sanitizeOutput,
} = require("../src/runtime");

async function main() {
    await smokeReadyState();
    await smokeMissingDockerFailure();
    smokeSanitization();
    console.log("Desktop shell smoke checks passed.");
}

async function smokeReadyState() {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), "aila-desktop-smoke-"));
    const composePath = path.join(projectRoot, "compose.yml");
    writeFileSync(composePath, "services:\n  backend:\n    image: example/backend\n");

    const calls = [];
    const states = [];
    let healthChecks = 0;

    const result = await runStartupSequence({
        projectRoot,
        backendUrl: DEFAULT_BACKEND_URL,
        backendPollMs: 1,
        backendTimeoutMs: 50,
        execFile: async (command, args) => {
            calls.push([command, ...args]);
            if (args[0] === "--version") return { stdout: "Docker version 26.0.0", stderr: "" };
            if (args[0] === "info") return { stdout: "\"26.0.0\"", stderr: "" };
            if (args[0] === "compose") return { stdout: "started", stderr: "" };
            throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
        },
        fetch: async () => {
            healthChecks += 1;
            return { ok: healthChecks > 1 };
        },
        onState: (event) => states.push(event.state),
    });

    assert.equal(findComposeFile(projectRoot), composePath);
    assert.equal(result.state, "ready");
    assert.equal(result.workbenchUrl, buildWorkbenchUrl(DEFAULT_BACKEND_URL));
    assert.deepEqual(states, [
        "checking_docker",
        "starting_services",
        "waiting_for_backend",
        "ready",
    ]);
    assert(calls.some((call) => call.includes("compose")));
}

async function smokeMissingDockerFailure() {
    const states = [];
    const result = await runStartupSequence({
        projectRoot: os.tmpdir(),
        backendPollMs: 1,
        backendTimeoutMs: 5,
        execFile: async () => {
            const error = new Error("spawn docker ENOENT");
            error.code = "ENOENT";
            throw error;
        },
        fetch: async () => ({ ok: false }),
        onState: (event) => states.push(event),
    });

    assert.equal(result.state, "failed");
    assert.equal(result.details.code, "docker_not_installed");
    assert.equal(states[0].state, "checking_docker");
    assert.equal(states.at(-1).state, "failed");
}

function smokeSanitization() {
    const clean = sanitizeOutput(
        "Authorization: Bearer secret-token\napi_key=sk-secret-local\nnormal"
    );
    assert(!clean.includes("secret-token"));
    assert(!clean.includes("sk-secret-local"));
    assert(clean.includes("normal"));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
