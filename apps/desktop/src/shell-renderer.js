const stateEl = document.getElementById("state");
const messageEl = document.getElementById("message");
const detailsEl = document.getElementById("details");
const retryButton = document.getElementById("retry");
const diagnosticsButton = document.getElementById("diagnostics");

function renderState(event) {
    if (!event) return;
    stateEl.textContent = event.state || "checking_docker";
    messageEl.textContent = event.message || "Preparing local runtime.";
    const details = event.details && Object.keys(event.details).length
        ? JSON.stringify(event.details, null, 2)
        : "";
    detailsEl.hidden = !details;
    detailsEl.textContent = details;
    retryButton.disabled = event.state !== "failed";
}

retryButton.addEventListener("click", () => {
    retryButton.disabled = true;
    window.desktopRuntime?.retry();
});

diagnosticsButton.addEventListener("click", () => {
    window.desktopRuntime?.openDiagnostics();
});

window.desktopRuntime?.onState(renderState);
window.desktopRuntime?.getState().then(renderState);
