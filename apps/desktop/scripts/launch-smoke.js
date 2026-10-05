const { spawn } = require("node:child_process");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
let electronBinary;

try {
    electronBinary = require("electron");
} catch (error) {
    process.stderr.write(
        "Electron is not installed. Run `npm --prefix apps/desktop install` before launch smoke.\n"
    );
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}

const child = spawn(electronBinary, [packageRoot], {
    cwd: packageRoot,
    env: {
        ...process.env,
        AILA_DESKTOP_LAUNCH_SMOKE: "1",
        AILA_DESKTOP_SKIP_RUNTIME: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
const timeout = setTimeout(() => {
    child.kill("SIGTERM");
    process.stderr.write("Electron launch smoke timed out.\n");
    process.stderr.write(output);
    process.exit(1);
}, 20_000);

child.stdout.on("data", (chunk) => {
    output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
    output += chunk.toString();
});
child.on("error", (error) => {
    clearTimeout(timeout);
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
child.on("exit", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
        process.stderr.write(output);
        process.exit(code || 1);
    }
    if (!output.includes("BrowserWindow displayed shell page.")) {
        process.stderr.write(output);
        process.stderr.write("Electron launch smoke did not report a displayed shell page.\n");
        process.exit(1);
    }
    process.stdout.write("Desktop Electron launch smoke checks passed.\n");
});
