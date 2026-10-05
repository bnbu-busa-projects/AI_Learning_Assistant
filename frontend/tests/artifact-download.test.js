import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadArtifact } from '../src/artifact-download.js';

test('downloads exact PDF bytes with bearer auth and a local filename', async () => {
    const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 0, 255])], { type: 'application/pdf' });
    let savedBlob;
    let cleanup;
    let clicked = false;
    let removed = false;
    const link = { click() { clicked = true; }, remove() { removed = true; } };
    const browser = {
        async fetch(url, options) {
            assert.equal(url, '/api/runs/run-1/artifacts/files/output/main.pdf');
            assert.deepEqual(options.headers, { Authorization: 'Bearer private-token' });
            return { ok: true, blob: async () => pdf };
        },
        URL: {
            createObjectURL(blob) { savedBlob = blob; return 'blob:local'; },
            revokeObjectURL(url) { assert.equal(url, 'blob:local'); },
        },
        document: {
            createElement(tag) { assert.equal(tag, 'a'); return link; },
            body: { appendChild(element) { assert.equal(element, link); } },
        },
        setTimeout(callback) { cleanup = callback; },
    };
    await downloadArtifact('/api/runs/run-1/artifacts/files/output/main.pdf', 'private-token', 'output/main.pdf', browser);
    assert.equal(link.download, 'main.pdf');
    assert.equal(link.href, 'blob:local');
    assert.equal(savedBlob, pdf);
    assert.ok(clicked && removed);
    assert.equal(typeof cleanup, 'function');
    cleanup();
});

test('rejects unauthorized or missing files without saving an error response', async () => {
    for (const status of [401, 404]) {
        const browser = {
            async fetch() { return { ok: false, status, blob() { assert.fail('must not download an error response'); } }; },
        };
        await assert.rejects(downloadArtifact('/api/artifact', 'token', 'main.pdf', browser), new RegExp(String(status)));
    }
});
