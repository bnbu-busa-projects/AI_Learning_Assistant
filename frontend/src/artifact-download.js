// Fetch through the authenticated artifact API, never through a host file path.
export async function downloadArtifact(url, token, path, browser = globalThis) {
    const response = await browser.fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Artifact download failed (${response.status})`);
    const blob = await response.blob();
    const objectUrl = browser.URL.createObjectURL(blob);
    const link = browser.document.createElement("a");
    link.href = objectUrl;
    link.download = path.split("/").pop() || "artifact";
    try {
        browser.document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
        // Allow the browser time to start reading the download before releasing it.
        browser.setTimeout(() => browser.URL.revokeObjectURL(objectUrl), 60000);
    }
}
