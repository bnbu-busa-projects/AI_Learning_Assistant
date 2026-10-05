const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const filesToCheck = [
    "src/main.js",
    "src/preload.js",
    "src/runtime.js",
    "src/shell-renderer.js",
    "scripts/launch-smoke.js",
    "scripts/smoke.js",
];

for (const relativePath of filesToCheck) {
    const absolutePath = path.join(packageRoot, relativePath);
    const result = spawnSync(process.execPath, ["--check", absolutePath], {
        cwd: packageRoot,
        encoding: "utf-8",
    });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }
}

for (const requiredFile of ["src/shell.html", "package.json"]) {
    if (!existsSync(path.join(packageRoot, requiredFile))) {
        process.stderr.write(`Missing required desktop file: ${requiredFile}\n`);
        process.exit(1);
    }
}

const runtime = require("../src/runtime");
for (const state of ["checking_docker", "starting_services", "waiting_for_backend", "ready", "failed"]) {
    if (!runtime.STARTUP_STATES.includes(state)) {
        process.stderr.write(`Missing runtime state: ${state}\n`);
        process.exit(1);
    }
}

console.log("Desktop shell build checks passed.");
