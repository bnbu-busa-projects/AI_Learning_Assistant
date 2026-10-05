import { downloadArtifact } from "./artifact-download.js";
import "./styles.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { LOCALES, messages } from "./locales.js";
import contextDialCriticalUrl from "./assets/previews/context-budget-dial-critical.png";
import contextDialOkUrl from "./assets/previews/context-budget-dial-ok.png";
import contextDialWarningUrl from "./assets/previews/context-budget-dial-warning.png";
import authEntryPreviewUrl from "./assets/previews/auth-entry-preview.png";
import emptyWorkbenchPreviewUrl from "./assets/previews/empty-workbench-preview.png";
import {
    DEFAULT_MODEL_PROFILE,
    UPLOAD_ACCEPT_ATTRIBUTE,
    applyWorkbenchInteraction,
    buildRunRequest,
    canSubmitRun as canSubmitRunCore,
    clampPdfPage,
    findArtifactByRole,
    isActiveRunStatus,
    isTextArtifact,
    normalizeActiveCodeFile,
    normalizeArtifactMetadata,
    normalizeCourseMetadata,
    optionsForIntent as optionsForIntentCore,
    outputPreferenceForIntent as outputPreferenceForIntentCore,
    resolveSelectedCourseId,
} from "./workbench-core.js";

const API_URL = window.__AI_LEARNING_ASSISTANT_API_URL || window.location.origin;
const TOKEN_KEY = "ai_learning_assistant_token";
const USER_KEY = "ai_learning_assistant_user";
const LOCALE_KEY = "ai_learning_assistant_locale";
const CONTEXT_LIMIT = DEFAULT_MODEL_PROFILE.contextWindowHint;
const RUN_POLL_INTERVAL_MS = 1200;
const PDF_RENDER_WIDTH = 1120;
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
const DEFAULT_LOCALE = "en";
const contextDialAssets = {
    ok: contextDialOkUrl,
    warning: contextDialWarningUrl,
    critical: contextDialCriticalUrl,
};
const initialLocale = getInitialLocale();
const DEFAULT_MODEL_FORM = {
    displayName: DEFAULT_MODEL_PROFILE.displayName,
    provider: DEFAULT_MODEL_PROFILE.provider,
    baseUrl: DEFAULT_MODEL_PROFILE.baseUrl,
    model: DEFAULT_MODEL_PROFILE.model,
    contextWindowHint: DEFAULT_MODEL_PROFILE.contextWindowHint,
    supportsStreaming: DEFAULT_MODEL_PROFILE.supportsStreaming,
    apiKey: "",
};

const intents = [
    {
        id: "code_homework",
        outputs: ["solution.py", "solution.ipynb"],
        stages: ["route", "context", "generate", "validate"],
        accent: "clay",
    },
    {
        id: "essay_latex",
        outputs: ["main.html", "main.pdf"],
        stages: ["route", "context", "write", "compile"],
        accent: "sage",
    },
    {
        id: "beamer_slides",
        outputs: ["slides.html", "slides.pdf"],
        stages: ["route", "outline", "write", "compile"],
        accent: "amber",
    },
    {
        id: "cheat_sheet",
        outputs: ["cheat-sheet.html", "cheat-sheet.pdf"],
        stages: ["ingest", "compress", "layout", "compile"],
        accent: "coral",
    },
];

const state = {
    locale: initialLocale,
    authMode: "login",
    token: localStorage.getItem(TOKEN_KEY) || "",
    user: readStoredUser(),
    activePane: "console",
    intent: "code_homework",
    outputPreference: "py",
    searchMode: "auto",
    targetPages: 2,
    taskText: "",
    refinementText: "",
    files: [],
    fieldErrors: {},
    context: null,
    previewTab: "primary",
    activeFile: "solution.py",
    notice: { message: "", tone: "neutral" },
    course: initialCourseState(),
    model: {
        editorOpen: false,
        profiles: [],
        profile: null,
        form: { ...DEFAULT_MODEL_FORM },
        fieldErrors: {},
        statusMessage: "",
        statusTone: "neutral",
        busy: "",
    },
    authMessage: "",
    authTone: "neutral",
    run: initialRunState(initialLocale),
    artifacts: initialArtifactState(),
    history: [initialReadyHistory(initialLocale)],
};

const app = document.getElementById("app");
let runPollTimerId = null;
let pdfjsModulePromise = null;

init();

function init() {
    applyLocaleDocumentState();
    refreshLocalContext();
    normalizeActiveFile();
    render();
    if (state.token) {
        refreshCurrentUser();
    }
}

async function refreshCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${state.token}` },
        });
        if (!response.ok) throw new Error(t("auth.expired"));
        const user = await response.json();
        setUser(user, state.token);
    } catch {
        clearSession();
        render();
    }
}

function render() {
    const isAuthenticated = Boolean(state.user && state.token);
    applyLocaleDocumentState();
    // Runtime/session chrome stays out of the web workbench; Electron and auth surfaces own those states.
    app.innerHTML = `
        <div class="studio-app ${isAuthenticated ? "" : "is-auth-entry"}" data-mobile-pane="${escapeHtml(state.activePane)}" lang="${escapeHtml(state.locale)}">
            <main class="studio-main">
                ${
                    isAuthenticated
                        ? `${renderMobilePaneSwitch()}
                            <section class="workbench-grid" aria-label="${escapeHtml(t("app.title"))}">
                                ${renderConsolePane(isAuthenticated)}
                                ${renderPreviewPane(isAuthenticated)}
                            </section>`
                        : renderAuthEntry()
                }
                ${isAuthenticated && state.model.editorOpen ? renderModelSettingsPanel() : ""}
            </main>
        </div>
    `;
    bindEvents();
    if (isAuthenticated) updateContextDial();
}

function renderLocaleSwitch() {
    return `
        <div class="locale-switch" role="group" aria-label="${escapeHtml(t("locale.label"))}">
            ${LOCALES.map((locale) => `
                <button
                    type="button"
                    class="${state.locale === locale.id ? "is-active" : ""}"
                    data-locale="${escapeHtml(locale.id)}"
                    title="${escapeHtml(locale.name)}"
                    aria-label="${escapeHtml(locale.name)}"
                >${escapeHtml(locale.label)}</button>
            `).join("")}
        </div>
    `;
}

function renderMobilePaneSwitch() {
    return `
        <nav class="mobile-pane-switch" aria-label="${escapeHtml(t("app.title"))}">
            <button type="button" class="${state.activePane === "console" ? "is-active" : ""}" data-pane="console">${escapeHtml(t("mobile.console"))}</button>
            <button type="button" class="${state.activePane === "preview" ? "is-active" : ""}" data-pane="preview">${escapeHtml(t("mobile.preview"))}</button>
        </nav>
    `;
}

function renderConsolePane(isAuthenticated) {
    return `
        <section class="console-pane workbench-pane" aria-label="${escapeHtml(t("pane.consoleKicker"))}">
            <div class="pane-head">
                <div>
                    <div class="pane-kicker">${escapeHtml(t("pane.consoleKicker"))}</div>
                </div>
                <div class="pane-actions">
                    ${renderLocaleSwitch()}
                    <button class="tool-button" type="button" data-action="open-model-settings" ${isAuthenticated ? "" : "disabled"}>
                        <span class="tool-glyph" aria-hidden="true"></span>
                        <span>${escapeHtml(modelButtonLabel())}</span>
                    </button>
                    <button class="identity-chip" type="button" data-action="logout">
                        <span>${escapeHtml(state.user?.email || t("app.userFallback"))}</span>
                        <strong>${escapeHtml(state.user?.role || "")}</strong>
                    </button>
                </div>
            </div>

            ${renderCourseControl()}

            <div class="console-utility-row">
                ${renderContextDial()}
                ${renderSearchModeControl()}
            </div>

            <div class="artifact-type-bar" role="radiogroup" aria-label="${escapeHtml(t("controls.artifactType"))}">
                ${intents.map(renderIntentButton).join("")}
            </div>

            <section class="command-composer" aria-label="${escapeHtml(t("composer.brief"))}">
                <div class="composer-head">
                    <label class="field-label" for="task-text">${escapeHtml(t("composer.brief"))}</label>
                    <span>${escapeHtml(intentText(getSelectedIntent().id, "description"))}</span>
                </div>
                <textarea
                    id="task-text"
                    class="task-input ${state.fieldErrors.task_text ? "has-error" : ""}"
                    rows="8"
                    placeholder="${escapeHtml(t("composer.briefPlaceholder"))}"
                >${escapeHtml(state.taskText)}</textarea>
                ${state.fieldErrors.task_text ? `<div class="field-error">${escapeHtml(state.fieldErrors.task_text)}</div>` : ""}
                ${renderIntentOptions()}
                ${renderUploadArea()}
                <div class="composer-actions">
                    <button class="run-button" type="button" data-action="run" data-run-status="${escapeHtml(state.run.status)}" ${canSubmitRun(isAuthenticated) ? "" : "disabled"}>
                        <span class="run-glyph" aria-hidden="true"></span>
                        <span data-run-button-label>${runButtonLabel()}</span>
                    </button>
                    ${renderComposerRunStatus(isAuthenticated)}
                </div>
            </section>

            ${renderRefinementComposer(isAuthenticated)}
            ${renderCommandHistory()}
        </section>
    `;
}

function renderCourseControl() {
    const selected = selectedCourse();
    const ordinarySelected = selected && !selected.isDefault;
    const disabled = state.course.loading || !state.course.items.length || isActiveRunStatus(state.run.status);
    const courseMutationDisabled = Boolean(state.course.busy || isActiveRunStatus(state.run.status));
    return `
        <section class="course-control ${state.course.panelOpen ? "is-open" : ""}" aria-label="${escapeHtml(t("course.label"))}">
            <div class="course-select-row">
                <label class="course-select-field">
                    <span class="field-label">${escapeHtml(t("course.label"))}</span>
                    <select data-course-select ${disabled ? "disabled" : ""}>
                        ${state.course.items.length
                            ? state.course.items.map((course) => `
                                <option value="${escapeHtml(course.id)}" ${course.id === state.course.selectedId ? "selected" : ""}>
                                    ${escapeHtml(courseDisplayTitle(course))}
                                </option>
                            `).join("")
                            : `<option value="">${escapeHtml(state.course.loading ? t("course.loading") : t("course.unavailable"))}</option>`
                        }
                    </select>
                </label>
                <div class="course-context-note">
                    <strong>${escapeHtml(selected?.isDefault ? t("course.contextDisabled") : t("course.contextEnabled"))}</strong>
                    <span>${escapeHtml(selected?.isDefault ? t("course.defaultNote") : t("course.contextNote"))}</span>
                </div>
                <button class="secondary-action course-manage-button" type="button" data-action="toggle-course-manager">
                    ${escapeHtml(state.course.panelOpen ? t("course.done") : t("course.manage"))}
                </button>
            </div>
            ${state.course.panelOpen ? `
                <div class="course-manager">
                    <form class="course-create-form" data-course-form="create">
                        <label>
                            <span class="field-label">${escapeHtml(t("course.newTitle"))}</span>
                            <input type="text" maxlength="200" data-course-create-title value="${escapeHtml(state.course.createTitle)}" placeholder="${escapeHtml(t("course.newPlaceholder"))}">
                        </label>
                        <button class="secondary-action" type="submit" ${courseMutationDisabled ? "disabled" : ""}>${escapeHtml(t("course.create"))}</button>
                    </form>
                    <div class="course-edit-row">
                        <label>
                            <span class="field-label">${escapeHtml(t("course.selectedTitle"))}</span>
                            <input type="text" maxlength="200" data-course-rename-title value="${escapeHtml(selected?.isDefault ? courseDisplayTitle(selected) : state.course.renameTitle)}" ${ordinarySelected ? "" : "disabled"}>
                        </label>
                        <button class="secondary-action" type="button" data-action="rename-course" ${ordinarySelected && !courseMutationDisabled ? "" : "disabled"}>${escapeHtml(t("course.rename"))}</button>
                        <button class="secondary-action is-danger" type="button" data-action="archive-course" ${ordinarySelected && !courseMutationDisabled ? "" : "disabled"}>${escapeHtml(t("course.archive"))}</button>
                    </div>
                    ${selected?.isDefault ? `<p class="course-default-lock">${escapeHtml(t("course.defaultLocked"))}</p>` : ""}
                    ${state.course.message ? `<div class="inline-notice is-${escapeHtml(state.course.tone)}">${escapeHtml(state.course.message)}</div>` : ""}
                </div>
            ` : ""}
        </section>
    `;
}

function renderIntentButton(intent) {
    const active = state.intent === intent.id;
    return `
        <button
            type="button"
            class="artifact-type ${active ? "is-active" : ""}"
            data-intent="${intent.id}"
            data-accent="${intent.accent}"
            role="radio"
            aria-checked="${active}"
        >
            <span class="artifact-short">${escapeHtml(intentText(intent.id, "short"))}</span>
            <span>
                <strong>${escapeHtml(intentText(intent.id, "label"))}</strong>
                <small>${escapeHtml(intentText(intent.id, "title"))}</small>
            </span>
        </button>
    `;
}

function renderSearchModeControl() {
    return `
        <div class="search-control">
            <span class="field-label">${escapeHtml(t("controls.search"))}</span>
            <div class="segmented-control" data-control="search-mode">
                ${["auto", "on", "off"].map((mode) => `
                    <button type="button" class="${state.searchMode === mode ? "is-active" : ""}" data-search-mode="${mode}">
                        ${escapeHtml(t(`controls.searchMode.${mode}`))}
                    </button>
                `).join("")}
            </div>
        </div>
    `;
}

function renderIntentOptions() {
    if (state.intent === "code_homework") {
        return `
            <div class="option-row">
                <div>
                    <span class="field-label">${escapeHtml(t("controls.output"))}</span>
                    <div class="segmented-control is-tight" data-control="code-output">
                        <button type="button" class="${state.outputPreference === "py" ? "is-active" : ""}" data-output-preference="py">.py</button>
                        <button type="button" class="${state.outputPreference === "ipynb" ? "is-active" : ""}" data-output-preference="ipynb">.ipynb</button>
                    </div>
                </div>
                <div class="status-capsule">${escapeHtml(t("controls.previewOnly"))}</div>
            </div>
        `;
    }
    if (state.intent === "cheat_sheet") {
        return `
            <div class="option-row">
                <label class="number-field">
                    <span class="field-label">${escapeHtml(t("controls.targetPages"))}</span>
                    <input id="target-pages" class="${state.fieldErrors.target_pages ? "has-error" : ""}" type="number" min="1" max="12" value="${state.targetPages}">
                </label>
                <div class="status-capsule">${escapeHtml(t("controls.a4"))}</div>
                <div class="status-capsule">${escapeHtml(t("controls.dense"))}</div>
            </div>
            ${state.fieldErrors.target_pages ? `<div class="field-error">${escapeHtml(state.fieldErrors.target_pages)}</div>` : ""}
        `;
    }
    return `
        <div class="option-row">
            <div class="status-capsule">${escapeHtml(t("controls.pdfFirst"))}</div>
            <div class="status-capsule">${escapeHtml(t("controls.sourceKept"))}</div>
        </div>
    `;
}

function renderUploadArea() {
    const selectedText = state.files.length
        ? t(state.files.length === 1 ? "uploads.selected" : "uploads.selectedPlural", { count: state.files.length })
        : t("uploads.choose");
    return `
        <section class="upload-module" aria-label="${escapeHtml(t("uploads.label"))}">
            <div class="upload-zone" data-action="open-file-picker" role="button" tabindex="0">
                <input id="file-input" type="file" multiple accept="${UPLOAD_ACCEPT_ATTRIBUTE}">
                <span class="upload-mark" aria-hidden="true"></span>
                <div>
                    <strong>${escapeHtml(t("uploads.label"))}</strong>
                    <span>${escapeHtml(selectedText)}</span>
                </div>
            </div>
            ${state.files.length ? renderSelectedFiles() : ""}
            ${state.notice.message ? `<div class="inline-notice is-${state.notice.tone}">${escapeHtml(state.notice.message)}</div>` : ""}
        </section>
    `;
}

function renderSelectedFiles() {
    return `
        <div class="selected-files">
            ${state.files.map((item) => `
                <div class="selected-file" data-file-key="${escapeHtml(item.key)}">
                    <span class="file-kind">${escapeHtml(fileKind(item.name))}</span>
                    <span class="file-name">${escapeHtml(item.name)}</span>
                    <small>${escapeHtml(uploadStatusLabel(item))}</small>
                    <button class="icon-action" type="button" data-remove-file="${escapeHtml(item.key)}" aria-label="${escapeHtml(t("actions.removeFile", { name: item.name }))}">x</button>
                </div>
            `).join("")}
        </div>
    `;
}

function renderAuthEntry() {
    return `
        <section class="auth-entry" aria-label="${escapeHtml(t("auth.kicker"))}">
            <div class="auth-entry-shell">
                <div class="auth-entry-preview" aria-hidden="true">
                    <img src="${escapeHtml(authEntryPreviewUrl)}" alt="">
                    <div class="auth-preview-paper">
                        <span class="auth-preview-rule"></span>
                        <div class="auth-preview-brand">${escapeHtml(t("app.brand"))}</div>
                        <i></i><i></i><i></i>
                    </div>
                </div>
                ${renderAuthPanel()}
            </div>
        </section>
    `;
}

function renderRefinementComposer(isAuthenticated) {
    const disabled = !isAuthenticated || !state.run.id || isActiveRunStatus(state.run.status);
    return `
        <section class="refinement-composer" aria-label="${escapeHtml(t("refinement.label"))}">
            <div class="composer-head">
                <label class="field-label" for="refinement-text">${escapeHtml(t("refinement.label"))}</label>
                <span>${escapeHtml(state.run.id ? t("refinement.revisionSource", { id: shortRunId(state.run.id) }) : t("refinement.availableAfterRun"))}</span>
            </div>
            <textarea
                id="refinement-text"
                rows="3"
                placeholder="${escapeHtml(t("refinement.placeholder"))}"
                ${disabled ? "disabled" : ""}
            >${escapeHtml(state.refinementText)}</textarea>
            <div class="composer-actions">
                <button class="secondary-action" type="button" data-action="run-refinement" ${disabled || !state.refinementText.trim() ? "disabled" : ""}>
                    ${escapeHtml(t("actions.newRevisionRun"))}
                </button>
                <span class="run-note" data-refinement-note>${escapeHtml(t("refinement.note"))}</span>
            </div>
        </section>
    `;
}

function renderCommandHistory() {
    return `
        <section class="history-stream" aria-label="${escapeHtml(t("history.label"))}">
            <div class="history-head">
                <span>${escapeHtml(t("history.label"))}</span>
                <small>${escapeHtml(t("history.entries", { count: state.history.length }))}</small>
            </div>
            <div class="history-list">
                ${state.history.slice().reverse().map(renderHistoryItem).join("")}
            </div>
        </section>
    `;
}

function renderHistoryItem(item) {
    return `
        <article class="history-item is-${escapeHtml(item.kind)}" data-status="${escapeHtml(item.status || "idle")}">
            <div class="history-marker"></div>
            <div class="history-content">
                <div class="history-title">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(formatHistoryTime(item.timestamp))}</span>
                </div>
                <p>${escapeHtml(item.message)}</p>
                ${
                    item.meta
                        ? `<div class="history-meta">${escapeHtml(item.meta)}</div>`
                        : ""
                }
            </div>
        </article>
    `;
}

function renderPreviewPane(isAuthenticated) {
    const intent = getSelectedIntent();
    return `
        <section class="preview-pane workbench-pane" aria-label="${escapeHtml(t("pane.previewKicker"))}">
            <div class="preview-header">
                <div>
                    <div class="pane-kicker">${escapeHtml(t("pane.previewKicker"))}</div>
                    <h2>${escapeHtml(intentText(intent.id, "title"))}</h2>
                </div>
                <div class="preview-actions">
                    <button class="secondary-action" type="button" data-action="copy-current-path" ${state.run.outputRoot ? "" : "disabled"}>${escapeHtml(t("actions.copyPath"))}</button>
                    <button class="secondary-action" type="button" data-action="reveal-run" ${state.run.outputRoot ? "" : "disabled"}>${escapeHtml(t("actions.reveal"))}</button>
                    <button class="secondary-action" type="button" data-action="regenerate" ${canSubmitRun(isAuthenticated) ? "" : "disabled"}>${escapeHtml(t("actions.regenerate"))}</button>
                </div>
            </div>

            <div class="preview-status-strip">
                ${renderRunStatusPill()}
                ${renderStageTrack(intent)}
            </div>

            <div class="preview-shell" data-intent="${escapeHtml(state.intent)}" data-run-status="${escapeHtml(state.run.status)}" style="--preview-empty-image: url('${escapeHtml(emptyWorkbenchPreviewUrl)}')">
                ${renderPreviewTabs()}
                <div class="preview-body">
                    ${renderPreviewBody()}
                </div>
            </div>

            ${renderOutputFiles()}
        </section>
    `;
}

function renderRunStatusPill() {
    return `
        <div class="run-status-pill" data-status="${escapeHtml(state.run.status)}">
            <span class="status-light"></span>
            <div>
                <strong>${escapeHtml(statusLabel(state.run.status))}</strong>
                <span>${escapeHtml(t("preview.currentStage", { stage: stageLabel(state.run.stage) }))}</span>
            </div>
        </div>
        <p class="run-message">${escapeHtml(state.run.error || state.run.message)}</p>
    `;
}

function renderStageTrack(intent) {
    const current = normalizedStageBucket(state.run.stage, state.run.status);
    return `
        <div class="stage-track-shell" aria-label="${escapeHtml(t("preview.statusMessage"))}">
            <div class="stage-track-head">
                <span>${escapeHtml(t("preview.stageProgress"))}</span>
                <small>${escapeHtml(t("preview.currentStage", { stage: stageLabel(state.run.stage) }))}</small>
            </div>
            <div class="stage-track" role="list">
                ${intent.stages.map((stage, index) => `
                    <span class="stage-step ${stage === current ? "is-active" : ""}" role="listitem" ${stage === current ? 'aria-current="step"' : ""}>
                        <small>${index + 1}</small>
                        <strong>${escapeHtml(stageLabel(stage))}</strong>
                    </span>
                `).join("")}
            </div>
        </div>
    `;
}

function renderPreviewTabs() {
    const tabs = getPreviewTabs();
    return `
        <div class="preview-tabs" role="tablist" aria-label="${escapeHtml(t("pane.previewKicker"))}">
            ${tabs.map((tab) => `
                <button
                    type="button"
                    role="tab"
                    class="${state.previewTab === tab.id ? "is-active" : ""}"
                    data-preview-tab="${tab.id}"
                    aria-selected="${state.previewTab === tab.id}"
                >
                    ${escapeHtml(tab.label)}
                </button>
            `).join("")}
        </div>
    `;
}

function renderPreviewBody() {
    if (state.previewTab === "source") return renderSourceInspection();
    if (state.previewTab === "logs") return renderLogInspection();
    if (state.previewTab === "manifest") return renderManifestInspection();
    if (state.intent === "code_homework") return renderCodePreview();
    if (state.intent === "essay_latex") return renderEssayPreview();
    if (state.intent === "beamer_slides") return renderSlidesPreview();
    return renderCheatSheetPreview();
}

function renderCodePreview() {
    if (state.outputPreference === "ipynb") {
        return renderNotebookPreview();
    }
    const files = getCodeFiles();
    return `
        <div class="code-product">
            <div class="code-tabs">
                ${files.map((file) => `
                    <button type="button" class="${state.activeFile === file ? "is-active" : ""}" data-active-file="${escapeHtml(file)}">
                        ${escapeHtml(file)}
                    </button>
                `).join("")}
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${escapeHtml(t("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor" aria-label="${escapeHtml(t("preview.code"))}">
                ${renderHighlightedCode(codePreviewText(state.activeFile), languageForFilename(state.activeFile))}
            </div>
            <div class="terminal-strip" data-status="${escapeHtml(state.run.status)}">
                <span>${escapeHtml(codeStatusTitle())}</span>
                <strong>${escapeHtml(codeStatusDetail())}</strong>
            </div>
        </div>
    `;
}

function renderNotebookPreview() {
    const notebook = notebookPreviewModel();
    return `
        <div class="notebook-product">
            <div class="notebook-toolbar">
                <span>solution.ipynb</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${escapeHtml(t("actions.copyVisible"))}</button>
            </div>
            <div class="notebook-cell is-markdown">
                <span class="cell-label">${escapeHtml(t("preview.markdown"))}</span>
                <h3>${escapeHtml(notebook.title)}</h3>
                <p>${escapeHtml(notebook.body)}</p>
            </div>
            <div class="notebook-cell">
                <span class="cell-label">${escapeHtml(t("preview.code"))}</span>
                <div class="code-editor is-compact">${renderHighlightedCode(notebook.code)}</div>
            </div>
            <div class="terminal-strip" data-status="${escapeHtml(state.run.status)}">
                <span>${escapeHtml(t("preview.notebookValidation"))}</span>
                <strong>${escapeHtml(notebook.detail)}</strong>
            </div>
        </div>
    `;
}

function renderEssayPreview() {
    const realHtml = renderRealHtmlPreview("essay");
    if (realHtml) return realHtml;
    const realPdf = renderRealPdfPreview("essay");
    if (realPdf) return realPdf;
    return `
        <div class="pdf-stage">
            <div class="page-rail">
                <span class="is-active">1</span>
                <span>2</span>
                <span>3</span>
            </div>
            <article class="pdf-page essay-page">
                <header>
                    <span class="paper-overline">${escapeHtml(t("preview.htmlReport"))}</span>
                    <h3>${escapeHtml(briefTitle(t("preview.generatedEssay")))}</h3>
                    <div class="paper-rule"></div>
                </header>
                <section>
                    <h4>${escapeHtml(t("preview.introduction"))}</h4>
                    <p></p><p class="short"></p>
                    <h4>${escapeHtml(t("preview.argument"))}</h4>
                    <p></p><p></p><p class="shorter"></p>
                    <h4>${escapeHtml(t("preview.references"))}</h4>
                    <p class="short"></p>
                </section>
            </article>
            ${renderPreviewOverlay(t("preview.emptyPdfTitle"), t("preview.emptyPdfMessage"))}
        </div>
    `;
}

function renderSlidesPreview() {
    const realHtml = renderRealHtmlPreview("slides");
    if (realHtml) return realHtml;
    const realPdf = renderRealPdfPreview("slides");
    if (realPdf) return realPdf;
    return `
        <div class="slide-product">
            <aside class="slide-thumbs" aria-label="${escapeHtml(t("preview.deckTitle"))}">
                <span class="is-active"></span>
                <span></span>
                <span></span>
                <span></span>
            </aside>
            <div class="slide-canvas">
                <div class="slide-page">
                    <span class="slide-kicker">${escapeHtml(intentText("beamer_slides", "title"))}</span>
                    <h3>${escapeHtml(briefTitle(t("preview.generatedSlides")))}</h3>
                    <div class="slide-columns">
                        <span></span><span></span><span></span><span></span>
                    </div>
                    <div class="slide-footer">${escapeHtml(t("preview.pageLabel"))}</div>
                </div>
            </div>
            ${renderPreviewOverlay(t("preview.deckTitle"), t("preview.deckMessage"))}
        </div>
    `;
}

function renderCheatSheetPreview() {
    const realHtml = renderRealHtmlPreview("sheet");
    if (realHtml) return realHtml;
    const realPdf = renderRealPdfPreview("sheet");
    if (realPdf) return realPdf;
    const pageCount = Math.max(1, Math.round(Number(state.targetPages) || 1));
    return `
        <div class="cheat-product">
            <div class="cheat-toolbar">
                <span>${escapeHtml(t("preview.a4DenseLayout"))}</span>
                <strong>${escapeHtml(t(pageCount === 1 ? "preview.onePage" : "preview.manyPages", { count: pageCount }))}</strong>
            </div>
            <div class="cheat-pages">
                ${Array.from({ length: Math.min(pageCount, 4) }, (_, pageIndex) => `
                    <article class="cheat-page">
                        <header>
                            <span></span><span></span>
                        </header>
                        <div class="cheat-grid">
                            ${Array.from({ length: 36 }, (_, index) => `
                                <i class="${(index + pageIndex) % 7 === 0 ? "is-strong" : ""}"></i>
                            `).join("")}
                        </div>
                    </article>
                `).join("")}
            </div>
            ${renderPreviewOverlay(t("preview.sheetTitle"), t("preview.sheetMessage"))}
        </div>
    `;
}

function renderRealHtmlPreview(kind) {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryHtml", { intent: state.intent });
    if (!artifact) return "";
    const html = artifactText(artifact.path);
    const error = state.artifacts.errorsByPath[artifact.path] || "";
    const loading = state.artifacts.loading && !html && !error;
    const titleKey = kind === "slides" ? "preview.deckTitle" : kind === "sheet" ? "preview.sheetTitle" : "preview.htmlDocumentTitle";
    const frameClass = kind === "slides" ? "is-slides" : kind === "sheet" ? "is-sheet" : "is-essay";
    return `
        <div class="html-render-product ${frameClass}" data-html-path="${escapeHtml(artifact.path)}">
            <div class="html-render-toolbar">
                <div>
                    <span>${escapeHtml(t(titleKey))}</span>
                    <strong>${escapeHtml(artifactDisplayName(artifact, "artifact.html"))}</strong>
                </div>
                <span>${escapeHtml(error ? t("preview.preservedForInspection") : t("preview.htmlRenderReady"))}</span>
            </div>
            <div class="html-render-frame">
                ${
                    html
                        ? `<iframe class="html-preview-frame" title="${escapeHtml(t("preview.htmlFrameTitle"))}" sandbox="allow-same-origin" srcdoc="${escapeHtml(html)}"></iframe>`
                        : renderHtmlPlaceholder(kind)
                }
                ${loading ? renderPdfRendererOverlay(t("preview.htmlLoading"), t("preview.htmlLoadingMessage"), "loading") : ""}
                ${error ? renderPdfRendererOverlay(t("preview.htmlRendererError"), `${artifactDisplayName(artifact, "artifact.html")}: ${error}`, "error") : ""}
            </div>
            <div class="pdf-render-note">${escapeHtml(error ? t("preview.pdfFallbackAvailable") : t("preview.htmlRenderReady"))}</div>
        </div>
    `;
}

function renderHtmlPlaceholder(kind) {
    if (kind === "slides") return renderPdfPlaceholder("slides");
    if (kind === "sheet") return renderPdfPlaceholder("sheet");
    return renderPdfPlaceholder("essay");
}

function renderRealPdfPreview(kind) {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryPdf", { intent: state.intent });
    if (!artifact) return "";
    const entry = pdfPreviewEntry(artifact.path);
    const pageCount = entry.pageCount || 0;
    const currentPage = clampPdfPage(entry.currentPage || 1, pageCount || 1);
    const image = entry.pages?.[currentPage] || "";
    const loading = entry.loading || (state.artifacts.loading && !image && !entry.error);
    const titleKey = kind === "slides" ? "preview.deckTitle" : kind === "sheet" ? "preview.sheetTitle" : "preview.emptyPdfTitle";
    const labelKey = kind === "slides" ? "preview.pdfSlidePosition" : kind === "sheet" ? "preview.pdfSheetPosition" : "preview.pdfPagePosition";
    const pageLabel = t(labelKey, { page: currentPage, total: pageCount || "?" });
    const alt = t("preview.pdfPageAlt", { page: currentPage, total: pageCount || "?" });

    return `
        <div class="pdf-render-product is-${escapeHtml(kind)}" data-pdf-path="${escapeHtml(artifact.path)}">
            <div class="pdf-render-toolbar">
                <div>
                    <span>${escapeHtml(t(titleKey))}</span>
                    <strong>${escapeHtml(artifactDisplayName(artifact, "artifact.pdf"))}</strong>
                </div>
                <div class="pdf-page-controls" aria-label="${escapeHtml(pageLabel)}">
                    <button type="button" data-download-file="${escapeHtml(artifact.path)}" ${state.token ? "" : "disabled"}>${escapeHtml(t("actions.download"))}</button>
                    <button type="button" data-pdf-page-action="previous" data-pdf-path="${escapeHtml(artifact.path)}" ${currentPage <= 1 || loading ? "disabled" : ""}>${escapeHtml(t("preview.previousPage"))}</button>
                    <span>${escapeHtml(pageLabel)}</span>
                    <button type="button" data-pdf-page-action="next" data-pdf-path="${escapeHtml(artifact.path)}" ${(pageCount && currentPage >= pageCount) || loading ? "disabled" : ""}>${escapeHtml(t("preview.nextPage"))}</button>
                </div>
            </div>
            <div class="pdf-render-frame">
                ${renderPdfSideRail(kind, currentPage, pageCount, artifact.path, loading)}
                <figure class="pdf-render-surface">
                    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}">` : renderPdfPlaceholder(kind)}
                    ${loading ? renderPdfRendererOverlay(t("preview.pdfLoading"), t("preview.pdfLoadingMessage"), "loading") : ""}
                    ${entry.error ? renderPdfRendererError(artifact, entry.error) : ""}
                </figure>
            </div>
            <div class="pdf-render-note">${escapeHtml(entry.error ? t("preview.preservedForInspection") : t("preview.pdfRenderReady"))}</div>
        </div>
    `;
}

function renderPdfSideRail(kind, currentPage, pageCount, path, loading) {
    const count = Math.max(1, Math.min(pageCount || state.targetPages || 1, kind === "sheet" ? 4 : 8));
    return `
        <div class="pdf-render-rail" data-kind="${escapeHtml(kind)}">
            ${Array.from({ length: count }, (_, index) => {
                const page = index + 1;
                return `
                    <button
                        type="button"
                        class="${page === currentPage ? "is-active" : ""}"
                        data-pdf-page-action="go"
                        data-pdf-page="${page}"
                        data-pdf-path="${escapeHtml(path)}"
                        ${loading || (pageCount && page > pageCount) ? "disabled" : ""}
                        aria-label="${escapeHtml(t("preview.pdfGoToPage", { page }))}"
                    >${page}</button>
                `;
            }).join("")}
        </div>
    `;
}

function renderPdfPlaceholder(kind) {
    if (kind === "slides") {
        return `
            <div class="slide-page is-pdf-placeholder">
                <span class="slide-kicker">${escapeHtml(intentText("beamer_slides", "title"))}</span>
                <h3>${escapeHtml(briefTitle(t("preview.generatedSlides")))}</h3>
                <div class="slide-columns"><span></span><span></span><span></span><span></span></div>
            </div>
        `;
    }
    if (kind === "sheet") {
        return `
            <article class="cheat-page is-pdf-placeholder">
                <header><span></span><span></span></header>
                <div class="cheat-grid">
                    ${Array.from({ length: 48 }, (_, index) => `<i class="${index % 7 === 0 ? "is-strong" : ""}"></i>`).join("")}
                </div>
            </article>
        `;
    }
    return `
        <article class="pdf-page essay-page is-pdf-placeholder">
            <header>
                <span class="paper-overline">${escapeHtml(t("preview.htmlReport"))}</span>
                <h3>${escapeHtml(briefTitle(t("preview.generatedEssay")))}</h3>
                <div class="paper-rule"></div>
            </header>
            <section>
                <h4>${escapeHtml(t("preview.introduction"))}</h4>
                <p></p><p class="short"></p>
                <h4>${escapeHtml(t("preview.argument"))}</h4>
                <p></p><p></p><p class="shorter"></p>
            </section>
        </article>
    `;
}

function renderPdfRendererError(artifact, message) {
    return renderPdfRendererOverlay(
        t("preview.pdfRendererError"),
        `${artifactDisplayName(artifact, "artifact.pdf")}: ${message}`,
        "error",
    );
}

function renderPdfRendererOverlay(title, message, tone) {
    return `
        <div class="preview-overlay is-${escapeHtml(tone)}">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

function renderPreviewOverlay(title, message) {
    if (state.run.status === "succeeded" && state.run.outputRoot) return "";
    if (state.run.status === "failed") {
        return `
            <div class="preview-overlay is-error">
                <strong>${escapeHtml(state.run.errorCode || t("preview.failedTitle"))}</strong>
                <span>${escapeHtml(state.run.error || t("preview.failedMessage"))}</span>
            </div>
        `;
    }
    if (isActiveRunStatus(state.run.status)) {
        return `
            <div class="preview-overlay is-running">
                <strong>${escapeHtml(stageLabel(state.run.stage))}</strong>
                <span>${escapeHtml(state.run.message)}</span>
            </div>
        `;
    }
    return `
        <div class="preview-overlay">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

function renderSourceInspection() {
    const source = sourceInspectionModel();
    const filename = artifactDisplayName(source.artifact, sourceFilenameForIntent());
    const language = filename.endsWith(".html") || filename.endsWith(".htm")
        ? "html"
        : filename.endsWith(".json")
            ? "json"
            : "python";
    return `
        <div class="inspection-product">
            ${renderInspectionIntro(t("preview.sourceTitle"), source.message, source.tone)}
            <div class="inspection-head">
                <span>${escapeHtml(filename)}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${escapeHtml(t("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor">${renderHighlightedCode(source.text, language)}</div>
            <div class="inspection-note">${escapeHtml(artifactAccessNote())}</div>
        </div>
    `;
}

function renderLogInspection() {
    const log = logInspectionModel();
    return `
        <div class="inspection-product">
            ${renderInspectionIntro(t("preview.logsTitle"), log.message, log.tone)}
            <div class="inspection-head">
                <span>${escapeHtml(artifactDisplayName(log.artifact, t("source.generationLog")))}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${escapeHtml(t("actions.copyVisible"))}</button>
            </div>
            <div class="log-view">
                ${renderLogLines(log.text)}
            </div>
            <div class="inspection-note">${escapeHtml(artifactAccessNote())}</div>
        </div>
    `;
}

function renderManifestInspection() {
    const manifest = manifestInspectionModel();
    const text = manifest.text || JSON.stringify(expectedManifestSkeleton(), null, 2);
    return `
        <div class="inspection-product">
            ${renderInspectionIntro(t("preview.manifestTitle"), manifest.message, manifest.tone)}
            <div class="inspection-head">
                <span>${escapeHtml(artifactDisplayName(manifest.artifact, "manifest.json"))}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${escapeHtml(t("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor">${renderHighlightedCode(text, "json")}</div>
            <div class="inspection-note">${escapeHtml(artifactAccessNote())}</div>
        </div>
    `;
}

function expectedManifestSkeleton() {
    return {
        schema_version: 1,
        run_id: state.run.id || null,
        revision_of_run_id: state.run.revisionOfRunId || null,
        intent: state.intent,
        search: { mode: state.searchMode },
        status: state.run.status,
        outputs: getExpectedFiles().map((file) => ({ path: file.relativePath, kind: file.kind })),
    };
}

function renderInspectionIntro(title, message, tone = "neutral") {
    return `
        <div class="inspection-intro is-${escapeHtml(tone)}">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

function renderOutputFiles() {
    const files = outputFilesForDisplay();
    return `
        <section class="output-dock" aria-label="${escapeHtml(t("preview.files"))}">
            <div class="output-head">
                <span>${escapeHtml(t("preview.files"))}</span>
                <small>${state.run.outputRoot ? escapeHtml(truncatePath(state.run.outputRoot)) : escapeHtml(t("preview.runFolderPending"))}</small>
            </div>
            <div class="output-grid">
                ${files.map((file) => renderOutputFile(file)).join("")}
            </div>
        </section>
    `;
}

function renderOutputFile(file) {
    const path = artifactAbsolutePath(file.relativePath);
    const isReady = Boolean(file.artifact || (state.run.outputRoot && (state.run.status === "succeeded" || file.kind !== "pdf")));
    return `
        <div class="output-file" data-kind="${escapeHtml(file.kind)}">
            <span class="file-kind">${escapeHtml(file.badge)}</span>
            <div>
                <strong>${escapeHtml(file.name)}</strong>
                <small>${escapeHtml(isReady ? file.readyLabel : file.pendingLabel)}</small>
            </div>
            <div class="file-actions">
                <button type="button" data-download-file="${escapeHtml(file.relativePath)}" ${file.artifact && state.token ? "" : "disabled"}>${escapeHtml(t("actions.download"))}</button>
                <button type="button" data-open-file="${escapeHtml(path || "")}" ${path ? "" : "disabled"}>${escapeHtml(t("actions.open"))}</button>
            </div>
        </div>
    `;
}

function renderContextDial() {
    const estimate = getCurrentContextEstimate();
    return `
        <div class="context-widget" tabindex="0" data-context-state="${escapeHtml(estimate.warning_level)}" aria-label="${escapeHtml(contextAriaLabel(estimate))}">
            <div class="dial-ring" aria-hidden="true">
                <img src="${escapeHtml(contextDialAssets[estimate.warning_level] || contextDialAssets.ok)}" alt="">
                <span data-context-field="state">${escapeHtml(contextStateLabel(estimate.warning_level))}</span>
            </div>
            <div class="context-copy">
                <strong data-context-field="source-label">${escapeHtml(contextSourceLabel(estimate.source))}</strong>
                <span data-context-field="summary">${escapeHtml(contextSummary(estimate))}</span>
            </div>
            <div class="context-popover" role="tooltip">
                <div><span>${escapeHtml(t("context.input"))}</span><strong data-context-field="input">${formatInt(estimate.estimated_input_tokens)}</strong></div>
                <div><span>${escapeHtml(t("context.output"))}</span><strong data-context-field="output">${formatInt(estimate.estimated_output_tokens)}</strong></div>
                <div><span>${escapeHtml(t("context.total"))}</span><strong data-context-field="total">${formatInt(estimate.estimated_total_tokens)}</strong></div>
                <div><span>${escapeHtml(t("context.limit"))}</span><strong data-context-field="limit">${formatInt(estimate.context_window_limit)}</strong></div>
                <div><span>${escapeHtml(t("context.use"))}</span><strong data-context-field="utilization">${formatPercent(estimate.utilization_ratio)}</strong></div>
                <div><span>${escapeHtml(t("context.warningLabel"))}</span><strong data-context-field="warning">${escapeHtml(contextStateLabel(estimate.warning_level))}</strong></div>
                <div><span>${escapeHtml(t("context.source"))}</span><strong data-context-field="source">${escapeHtml(contextSourceLabel(estimate.source))}</strong></div>
            </div>
        </div>
    `;
}

function renderAuthPanel() {
    return `
        <section class="auth-panel" aria-label="${escapeHtml(t("auth.kicker"))}">
            <div class="auth-head">
                <div>
                    <div class="pane-kicker">${escapeHtml(t("auth.kicker"))}</div>
                    <h2>${escapeHtml(state.authMode === "login" ? t("auth.loginTitle") : t("auth.registerTitle"))}</h2>
                </div>
                <div class="auth-head-actions">
                    ${renderLocaleSwitch()}
                    <div class="auth-tabs">
                        <button type="button" class="${state.authMode === "login" ? "is-active" : ""}" data-auth-mode="login">${escapeHtml(t("actions.login"))}</button>
                        <button type="button" class="${state.authMode === "register" ? "is-active" : ""}" data-auth-mode="register">${escapeHtml(t("auth.registerTitle"))}</button>
                    </div>
                </div>
            </div>
            <form id="auth-form" class="auth-form" autocomplete="off">
                <label>
                    <span class="field-label">${escapeHtml(t("auth.email"))}</span>
                    <input id="auth-email" type="email" autocomplete="off" autocapitalize="none" spellcheck="false">
                </label>
                <label>
                    <span class="field-label">${escapeHtml(t("auth.password"))}</span>
                    <input id="auth-password" type="password" autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}">
                </label>
                ${
                    state.authMode === "register"
                        ? `<label>
                            <span class="field-label">${escapeHtml(t("auth.confirmPassword"))}</span>
                            <input id="auth-confirm" type="password" autocomplete="new-password">
                        </label>`
                        : ""
                }
                <button class="run-button is-full" type="submit">${escapeHtml(state.authMode === "login" ? t("actions.login") : t("actions.createAccount"))}</button>
                <div class="inline-notice is-${state.authTone}">${escapeHtml(state.authMessage)}</div>
            </form>
        </section>
    `;
}

function renderModelSettingsPanel() {
    const form = state.model.form;
    const profile = state.model.profile;
    const keyState = profile?.api_key_ref ? t("model.savedKey") : t("model.noSavedKey");
    const isBusy = Boolean(state.model.busy);
    return `
        <section class="model-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("model.settingsKicker"))}">
            <div class="model-dialog">
                <div class="model-dialog-head">
                    <div>
                        <div class="pane-kicker">${escapeHtml(t("model.settingsKicker"))}</div>
                        <h2>${escapeHtml(form.displayName || t("model.defaultName"))}</h2>
                    </div>
                    <button class="icon-action is-large" type="button" data-action="close-model-settings" aria-label="${escapeHtml(t("actions.closeModel"))}">x</button>
                </div>
                <form id="model-settings-form" class="model-form" novalidate>
                    <p class="model-helper">${escapeHtml(t("model.defaultHelp"))}</p>
                    ${renderModelField("displayName", t("model.displayName"), "text", form.displayName, t("model.defaultName"), false)}
                    ${renderModelField("baseUrl", t("model.baseUrl"), "url", form.baseUrl, DEFAULT_MODEL_FORM.baseUrl, true)}
                    ${renderModelField("model", t("model.model"), "text", form.model, DEFAULT_MODEL_FORM.model, true)}
                    ${renderModelDefaultSummary(form)}
                    ${renderModelField("apiKey", t("model.apiKey"), "password", form.apiKey, profile?.api_key_ref ? t("model.newKey") : t("model.apiKey"), false, "new-password")}
                    <div class="model-secret-row">
                        <span class="key-state ${profile?.api_key_ref ? "is-ready" : ""}">${escapeHtml(keyState)}</span>
                        <span class="profile-id">${escapeHtml(profile?.id || t("model.environmentDefault"))}</span>
                    </div>
                    <div class="model-actions">
                        <button class="secondary-action" type="button" data-action="test-model-settings" ${isBusy ? "disabled" : ""}>${escapeHtml(t("actions.test"))}</button>
                        <button class="run-button" type="submit" ${isBusy ? "disabled" : ""}>${escapeHtml(state.model.busy === "save" ? t("actions.saving") : t("actions.save"))}</button>
                    </div>
                    <div class="inline-notice is-${state.model.statusTone}">${escapeHtml(state.model.statusMessage)}</div>
                </form>
            </div>
        </section>
    `;
}

function renderModelDefaultSummary(form) {
    return `
        <div class="model-default-grid" aria-label="${escapeHtml(t("model.defaultsSummary"))}">
            <div>
                <span>${escapeHtml(t("model.provider"))}</span>
                <strong>${escapeHtml(form.provider || DEFAULT_MODEL_FORM.provider)}</strong>
            </div>
            <div>
                <span>${escapeHtml(t("model.contextWindow"))}</span>
                <strong>${escapeHtml(formatInt(form.contextWindowHint || DEFAULT_MODEL_FORM.contextWindowHint))}</strong>
            </div>
            <div>
                <span>${escapeHtml(t("model.streaming"))}</span>
                <strong>${escapeHtml(form.supportsStreaming ? t("model.streamingOn") : t("model.streamingOff"))}</strong>
            </div>
        </div>
    `;
}

function renderModelField(field, label, type, value, placeholder, required, autocomplete = "off") {
    const error = state.model.fieldErrors[field] || "";
    return `
        <label class="model-field ${error ? "has-error" : ""}">
            <span class="field-label">${escapeHtml(label)}</span>
            <input
                data-model-field="${field}"
                type="${type}"
                value="${escapeHtml(value)}"
                placeholder="${escapeHtml(placeholder)}"
                autocomplete="${escapeHtml(autocomplete)}"
                ${required ? "required" : ""}
            >
            <span class="field-error">${escapeHtml(error)}</span>
        </label>
    `;
}

function bindEvents() {
    bindLocaleControls();
    bindAuthPanelEvents();
    document.querySelectorAll("[data-pane]").forEach((button) => {
        button.addEventListener("click", () => {
            state.activePane = button.dataset.pane;
            render();
        });
    });
    document.getElementById("task-text")?.addEventListener("input", (event) => {
        state.taskText = event.target.value;
        delete state.fieldErrors.task_text;
        event.target.classList.remove("has-error");
        event.target.closest(".command-composer")?.querySelector(".field-error")?.remove();
        refreshLocalContext();
        updateContextDial();
        updateComposerActionState();
    });
    document.getElementById("refinement-text")?.addEventListener("input", (event) => {
        state.refinementText = event.target.value;
        refreshLocalContext();
        updateContextDial();
        updateComposerActionState();
    });
    document.querySelectorAll("button[data-intent]").forEach((button) => {
        button.addEventListener("click", () => {
            applyInteraction({ type: "selectIntent", intent: button.dataset.intent });
            refreshLocalContext();
            render();
        });
    });
    document.querySelectorAll("[data-search-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            applyInteraction({ type: "selectSearchMode", searchMode: button.dataset.searchMode });
            render();
        });
    });
    document.querySelector("[data-course-select]")?.addEventListener("change", (event) => {
        state.course.selectedId = resolveSelectedCourseId(state.course.items, event.target.value);
        syncCourseRenameTitle();
        state.course.message = "";
        render();
    });
    document.querySelector("[data-action='toggle-course-manager']")?.addEventListener("click", () => {
        state.course.panelOpen = !state.course.panelOpen;
        state.course.message = "";
        syncCourseRenameTitle();
        render();
    });
    document.querySelector("[data-course-create-title]")?.addEventListener("input", (event) => {
        state.course.createTitle = event.target.value;
    });
    document.querySelector("[data-course-rename-title]")?.addEventListener("input", (event) => {
        state.course.renameTitle = event.target.value;
    });
    document.querySelector("[data-course-form='create']")?.addEventListener("submit", handleCourseCreate);
    document.querySelector("[data-action='rename-course']")?.addEventListener("click", handleCourseRename);
    document.querySelector("[data-action='archive-course']")?.addEventListener("click", handleCourseArchive);
    document.querySelectorAll("[data-output-preference]").forEach((button) => {
        button.addEventListener("click", () => {
            applyInteraction({
                type: "selectOutputPreference",
                outputPreference: button.dataset.outputPreference,
            });
            refreshLocalContext();
            render();
        });
    });
    document.getElementById("target-pages")?.addEventListener("input", (event) => {
        applyInteraction({ type: "setTargetPages", targetPages: event.target.value });
        refreshLocalContext();
        updateContextDial();
    });
    const uploadZone = document.querySelector("[data-action='open-file-picker']");
    uploadZone?.addEventListener("click", () => document.getElementById("file-input")?.click());
    uploadZone?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        document.getElementById("file-input")?.click();
    });
    document.getElementById("file-input")?.addEventListener("change", (event) => {
        addLocalFiles(Array.from(event.target.files || []));
        render();
    });
    document.querySelectorAll("[data-remove-file]").forEach((button) => {
        button.addEventListener("click", () => {
            state.files = state.files.filter((file) => file.key !== button.dataset.removeFile);
            refreshLocalContext();
            render();
        });
    });
    document.querySelector("[data-action='run']")?.addEventListener("click", () => handleRun({ isRevision: false }));
    document.querySelector("[data-action='run-refinement']")?.addEventListener("click", () => handleRun({ isRevision: true }));
    document.querySelector("[data-action='regenerate']")?.addEventListener("click", () => handleRun({ isRevision: false, isRegenerate: true }));
    document.querySelector("[data-action='logout']")?.addEventListener("click", () => {
        stopRunPolling();
        clearSession();
        render();
    });
    document.querySelector("[data-action='open-model-settings']")?.addEventListener("click", openModelSettings);
    document.querySelector("[data-action='close-model-settings']")?.addEventListener("click", closeModelSettings);
    document.getElementById("model-settings-form")?.addEventListener("submit", handleModelSettingsSave);
    document.querySelector("[data-action='test-model-settings']")?.addEventListener("click", handleModelSettingsTest);
    document.querySelectorAll("[data-model-field]").forEach((input) => {
        input.addEventListener("input", () => {
            state.model.form[input.dataset.modelField] = input.value;
            delete state.model.fieldErrors[input.dataset.modelField];
            input.closest(".model-field")?.classList.remove("has-error");
            const error = input.closest(".model-field")?.querySelector(".field-error");
            if (error) error.textContent = "";
        });
    });
    document.querySelector(".preview-tabs")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-preview-tab]");
        if (!button) return;
        state.previewTab = button.dataset.previewTab;
        render();
    });
    document.querySelectorAll("[data-active-file]").forEach((button) => {
        button.addEventListener("click", () => {
            state.activeFile = button.dataset.activeFile;
            render();
        });
    });
    document.querySelectorAll("[data-pdf-page-action]").forEach((button) => {
        button.addEventListener("click", () => {
            handlePdfPageAction(button).catch(() => {});
        });
    });
    document.querySelector("[data-action='copy-visible-preview']")?.addEventListener("click", copyVisiblePreview);
    document.querySelector("[data-action='copy-current-path']")?.addEventListener("click", () => copyText(state.run.outputRoot || "", t("run.pathCopied")));
    document.querySelector("[data-action='reveal-run']")?.addEventListener("click", revealRunFolder);
    document.querySelectorAll("[data-download-file]").forEach((button) => {
        button.addEventListener("click", async () => {
            const artifact = state.artifacts.items.find((item) => item.path === button.dataset.downloadFile);
            if (!artifact || !state.token || !state.run.id) return;
            button.disabled = true;
            try {
                await downloadArtifact(artifactUrl(state.run.id, artifact), state.token, artifact.path);
                state.notice = { message: t("run.downloadStarted"), tone: "success" };
            } catch {
                state.notice = { message: t("run.downloadFailed"), tone: "error" };
            }
            render();
        });
    });
    document.querySelectorAll("[data-open-file]").forEach((button) => {
        button.addEventListener("click", () => openLocalPath(button.dataset.openFile || ""));
    });
    document.onkeydown = handleGlobalKeydown;
}

function applyInteraction(action) {
    Object.assign(state, applyWorkbenchInteraction({
        intent: state.intent,
        previewTab: state.previewTab,
        fieldErrors: state.fieldErrors,
        activeFile: state.activeFile,
        outputPreference: state.outputPreference,
        searchMode: state.searchMode,
        targetPages: state.targetPages,
    }, action));
}

function bindLocaleControls(root = document) {
    root.querySelectorAll("[data-locale]").forEach((button) => {
        button.addEventListener("click", () => {
            setLocale(button.dataset.locale);
        });
    });
}

function bindAuthPanelEvents(root = document) {
    root.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            setAuthMode(button.dataset.authMode);
        });
    });
    root.querySelector("#auth-form")?.addEventListener("submit", handleAuthSubmit);
}

function setAuthMode(authMode) {
    state.authMode = authMode === "register" ? "register" : "login";
    state.authMessage = "";
    state.authTone = "neutral";
    updateAuthPanel();
}

function updateAuthPanel() {
    const currentPanel = document.querySelector(".auth-panel");
    if (!currentPanel) {
        render();
        return;
    }
    const fragment = document.createRange().createContextualFragment(renderAuthPanel());
    const nextPanel = fragment.querySelector(".auth-panel");
    if (!nextPanel) {
        render();
        return;
    }
    currentPanel.replaceWith(nextPanel);
    bindLocaleControls(nextPanel);
    bindAuthPanelEvents(nextPanel);
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("auth-email")?.value.trim().toLowerCase() || "";
    const password = document.getElementById("auth-password")?.value || "";
    const confirm = document.getElementById("auth-confirm")?.value || "";
    const endpoint = state.authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = state.authMode === "login"
        ? { email, password }
        : { email, password, confirm_password: confirm };

    state.authMessage = t("auth.contacting");
    state.authTone = "neutral";
    updateAuthPanel();

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(errorMessage(data, t("auth.failed")));
        if (state.authMode === "register") {
            state.authMode = "login";
            state.authMessage = t("auth.created");
            state.authTone = "success";
            updateAuthPanel();
            return;
        }
        setUser({ email: data.email, role: data.role }, data.token);
    } catch (error) {
        state.authMessage = safeDisplayMessage(error.message);
        state.authTone = "error";
        updateAuthPanel();
    }
}

async function handleRun({ isRevision, isRegenerate = false }) {
    if (!state.user || !state.token) return;
    const promptText = isRevision ? state.refinementText.trim() : state.taskText.trim();
    const revisionOfRunId = isRevision ? state.run.id : null;

    if (!promptText) {
        state.fieldErrors.task_text = isRevision ? "" : t("run.required");
        state.run = {
            ...initialRunState(),
            status: "idle",
            stage: "validate_request",
            message: isRevision ? t("refinement.missing") : t("run.addBrief"),
        };
        render();
        return;
    }

    stopRunPolling();
    refreshLocalContext();
    state.fieldErrors = {};
    state.notice = { message: "", tone: "neutral" };
    state.run = {
        ...initialRunState(),
        status: "queued",
        stage: state.files.some((file) => !file.uploadId) ? "upload_inputs" : "submit_run",
        message: state.files.some((file) => !file.uploadId) ? t("run.preparingUploads") : t("run.submitting"),
        revisionOfRunId,
    };
    state.artifacts = initialArtifactState();
    addHistory({
        kind: isRevision ? "revision" : "command",
        status: "queued",
        title: isRevision ? t("history.followUpTitle") : isRegenerate ? t("history.regenerateTitle") : t("history.generationTitle"),
        message: promptText,
        meta: `${intentText(getSelectedIntent().id, "label")} / ${t("controls.search")} ${t(`controls.searchMode.${state.searchMode}`)}`,
    });
    state.activePane = "preview";
    render();

    try {
        const uploadIds = await uploadFilesIfNeeded();
        state.run = { ...state.run, stage: "submit_run", message: t("run.submitting") };
        render();
        const response = await fetch(`${API_URL}/api/runs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify(buildRunPayload({ promptText, uploadIds, revisionOfRunId })),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            applyRunApiError(data, t("run.requestFailed"));
            render();
            return;
        }
        applyRunPayload(data);
        upsertRunHistory();
        if (isRevision) state.refinementText = "";
        render();
        const submittedRunId = data.id || data.run_id || state.run.id;
        if (submittedRunId) {
            if (TERMINAL_RUN_STATUSES.has(state.run.status)) {
                await hydrateRunArtifacts(submittedRunId);
            } else {
                await pollRunEvent(submittedRunId);
            }
            if (!TERMINAL_RUN_STATUSES.has(state.run.status)) startRunPolling(submittedRunId);
        }
    } catch (error) {
        state.run = {
            ...state.run,
            status: "failed",
            stage: state.run.stage || "submit_run",
            message: t("run.requestFailed"),
            error: safeDisplayMessage(error.message),
            errorCode: "frontend_request_failed",
        };
        upsertRunHistory();
        render();
    }
}

async function uploadFilesIfNeeded() {
    const pending = state.files.filter((file) => !file.uploadId);
    if (!pending.length) return state.files.map((file) => file.uploadId).filter(Boolean);

    pending.forEach((file) => {
        file.status = "uploading";
    });
    render();

    const formData = new FormData();
    pending.forEach((item) => formData.append("files", item.file, item.name));
    const response = await fetch(`${API_URL}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        pending.forEach((file) => {
            file.status = "failed";
        });
        const fallback = response.status === 404
            ? t("uploads.unavailable")
            : t("uploads.failedGeneric");
        throw new Error(errorMessage(data, fallback));
    }

    const uploads = Array.isArray(data.uploads) ? data.uploads : [];
    pending.forEach((file, index) => {
        const upload = uploads[index];
        file.uploadId = upload?.id || "";
        file.status = file.uploadId ? "uploaded" : "failed";
    });
    if (pending.some((file) => !file.uploadId)) {
        throw new Error(t("uploads.missingIds"));
    }
    return state.files.map((file) => file.uploadId).filter(Boolean);
}

async function loadCourses({ preserveSelection = true } = {}) {
    if (!state.token) return;
    const previousSelection = preserveSelection ? state.course.selectedId : "";
    state.course.loading = true;
    state.course.message = "";
    render();
    try {
        const response = await fetch(`${API_URL}/api/courses`, {
            headers: { Authorization: `Bearer ${state.token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(errorMessage(data, t("course.loadFailed")));
        const items = normalizeCourseMetadata(data.courses);
        state.course.items = items;
        state.course.selectedId = resolveSelectedCourseId(items, previousSelection);
        state.course.tone = "neutral";
        syncCourseRenameTitle();
    } catch (error) {
        state.course.items = [];
        state.course.selectedId = "";
        state.course.message = safeDisplayMessage(error.message || t("course.loadFailed"));
        state.course.tone = "error";
    } finally {
        state.course.loading = false;
        render();
    }
}

async function handleCourseCreate(event) {
    event.preventDefault();
    const title = state.course.createTitle.trim();
    if (!title) {
        setCourseMessage(t("course.titleRequired"), "error");
        return;
    }
    state.course.busy = "create";
    setCourseMessage(t("course.creating"), "neutral");
    try {
        const course = await courseRequest("/api/courses", {
            method: "POST",
            body: JSON.stringify({ title }),
        }, t("course.createFailed"));
        state.course.createTitle = "";
        await loadCourses();
        state.course.selectedId = resolveSelectedCourseId(state.course.items, course.id);
        syncCourseRenameTitle();
        setCourseMessage(t("course.created"), "success");
    } catch (error) {
        setCourseMessage(error.message || t("course.createFailed"), "error");
    } finally {
        state.course.busy = "";
        render();
    }
}

async function handleCourseRename() {
    const course = selectedCourse();
    const title = state.course.renameTitle.trim();
    if (!course || course.isDefault) return;
    if (!title) {
        setCourseMessage(t("course.titleRequired"), "error");
        return;
    }
    state.course.busy = "rename";
    setCourseMessage(t("course.renaming"), "neutral");
    try {
        await courseRequest(`/api/courses/${encodeURIComponent(course.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ title }),
        }, t("course.renameFailed"));
        await loadCourses();
        setCourseMessage(t("course.renamed"), "success");
    } catch (error) {
        setCourseMessage(error.message || t("course.renameFailed"), "error");
    } finally {
        state.course.busy = "";
        render();
    }
}

async function handleCourseArchive() {
    const course = selectedCourse();
    if (!course || course.isDefault) return;
    state.course.busy = "archive";
    setCourseMessage(t("course.archiving"), "neutral");
    try {
        await courseRequest(`/api/courses/${encodeURIComponent(course.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ is_archived: true }),
        }, t("course.archiveFailed"));
        await loadCourses({ preserveSelection: false });
        setCourseMessage(t("course.archived"), "success");
    } catch (error) {
        setCourseMessage(error.message || t("course.archiveFailed"), "error");
    } finally {
        state.course.busy = "";
        render();
    }
}

async function courseRequest(path, options, fallback) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.token}`,
            ...(options?.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(data, fallback));
    return data;
}

function setCourseMessage(message, tone) {
    state.course.message = safeDisplayMessage(message);
    state.course.tone = tone;
    render();
}

function selectedCourse() {
    return state.course.items.find((course) => course.id === state.course.selectedId)
        || state.course.items.find((course) => course.isDefault)
        || null;
}

function syncCourseRenameTitle() {
    state.course.renameTitle = selectedCourse()?.title || "";
}

function courseDisplayTitle(course) {
    return course.isDefault ? t("course.defaultTitle") : course.title;
}

function setUser(user, token) {
    state.user = user;
    state.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    state.authMessage = "";
    state.run = initialRunState();
    state.artifacts = initialArtifactState();
    state.course = initialCourseState();
    refreshLocalContext();
    render();
    loadModelProfiles();
    loadCourses();
}

function clearSession() {
    resetModelState();
    state.user = null;
    state.token = "";
    state.artifacts = initialArtifactState();
    state.course = initialCourseState();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function resetModelState() {
    state.model = {
        editorOpen: false,
        profiles: [],
        profile: null,
        form: { ...DEFAULT_MODEL_FORM },
        fieldErrors: {},
        statusMessage: "",
        statusTone: "neutral",
        busy: "",
    };
}

function modelButtonLabel() {
    const profile = state.model.profile;
    if (profile?.model) return profile.model;
    if (state.model.statusTone === "error") return t("model.needsAttention");
    return t("model.defaultButton");
}

function openModelSettings() {
    hydrateModelFormFromProfile();
    state.model.editorOpen = true;
    state.model.statusMessage = state.model.profile ? t("model.savedLoaded") : t("model.defaultsLoaded");
    state.model.statusTone = "neutral";
    state.model.fieldErrors = {};
    render();
}

function closeModelSettings() {
    state.model.editorOpen = false;
    state.model.form.apiKey = "";
    state.model.fieldErrors = {};
    state.model.busy = "";
    render();
}

function handleGlobalKeydown(event) {
    if (event.key === "Escape" && state.model.editorOpen) closeModelSettings();
}

async function loadModelProfiles() {
    if (!state.token) return;
    try {
        const response = await fetch(`${API_URL}/api/settings/model-profiles`, {
            headers: { Authorization: `Bearer ${state.token}` },
        });
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(errorMessage(data, t("model.loadFailed")));
        const profiles = Array.isArray(data) ? data.map(sanitizeModelProfile) : [];
        state.model.profiles = profiles;
        state.model.profile = profiles.find((profile) => profile.is_default) || profiles[0] || null;
        hydrateModelFormFromProfile();
        if (state.model.editorOpen) {
            state.model.statusMessage = state.model.profile ? t("model.savedLoaded") : t("model.defaultsLoaded");
            state.model.statusTone = "neutral";
        }
        render();
    } catch (error) {
        state.model.statusMessage = safeDisplayMessage(error.message);
        state.model.statusTone = "error";
        if (state.model.editorOpen) render();
    }
}

function sanitizeModelProfile(profile) {
    return {
        id: String(profile?.id || "default-qwen"),
        display_name: String(profile?.display_name || t("model.defaultName")),
        provider: String(profile?.provider || "openai_compatible"),
        base_url: String(profile?.base_url || DEFAULT_MODEL_FORM.baseUrl),
        model: String(profile?.model || DEFAULT_MODEL_FORM.model),
        api_key_ref: profile?.api_key_ref ? String(profile.api_key_ref) : null,
        context_window_hint: Number(profile?.context_window_hint || DEFAULT_MODEL_FORM.contextWindowHint),
        supports_streaming: profile?.supports_streaming === undefined ? DEFAULT_MODEL_FORM.supportsStreaming : Boolean(profile.supports_streaming),
        is_default: Boolean(profile?.is_default),
    };
}

function hydrateModelFormFromProfile() {
    const profile = state.model.profile;
    state.model.form = {
        displayName: profile?.display_name || t("model.defaultName"),
        provider: profile?.provider || DEFAULT_MODEL_FORM.provider,
        baseUrl: profile?.base_url || DEFAULT_MODEL_FORM.baseUrl,
        model: profile?.model || DEFAULT_MODEL_FORM.model,
        contextWindowHint: Number(profile?.context_window_hint || DEFAULT_MODEL_FORM.contextWindowHint),
        supportsStreaming: profile?.supports_streaming === undefined ? DEFAULT_MODEL_FORM.supportsStreaming : Boolean(profile.supports_streaming),
        apiKey: "",
    };
}

async function handleModelSettingsSave(event) {
    event.preventDefault();
    state.model.busy = "save";
    state.model.statusMessage = t("model.saving");
    state.model.statusTone = "neutral";
    state.model.fieldErrors = {};
    render();

    try {
        const response = await fetch(`${API_URL}/api/settings/model-profiles/default`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify(buildModelProfilePayload({ includeApiKey: true })),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            applyModelApiError(data, t("model.saveFailed"));
            return;
        }
        state.model.profile = sanitizeModelProfile(data);
        state.model.profiles = [state.model.profile];
        hydrateModelFormFromProfile();
        state.model.statusMessage = t("model.saved");
        state.model.statusTone = "success";
        state.model.fieldErrors = {};
    } catch (error) {
        state.model.statusMessage = safeDisplayMessage(error.message);
        state.model.statusTone = "error";
    } finally {
        state.model.busy = "";
        state.model.form.apiKey = "";
        render();
    }
}

async function handleModelSettingsTest() {
    state.model.busy = "test";
    state.model.statusMessage = t("model.testing");
    state.model.statusTone = "neutral";
    state.model.fieldErrors = {};
    render();

    try {
        const useSubmittedProfile = Boolean(state.model.form.apiKey.trim());
        const response = await fetch(`${API_URL}/api/settings/model-profiles/test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify(useSubmittedProfile ? buildModelProfilePayload({ includeApiKey: true }) : {}),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            applyModelApiError(data, t("model.testFailed"));
            return;
        }
        state.model.statusMessage = t("model.connectionOk", { model: data.model || state.model.form.model });
        state.model.statusTone = "success";
        state.model.fieldErrors = {};
    } catch (error) {
        state.model.statusMessage = safeDisplayMessage(error.message);
        state.model.statusTone = "error";
    } finally {
        state.model.busy = "";
        render();
    }
}

function buildModelProfilePayload({ includeApiKey }) {
    const form = state.model.form;
    const payload = {
        display_name: form.displayName.trim() || t("model.defaultName"),
        provider: form.provider || "openai_compatible",
        base_url: form.baseUrl.trim() || DEFAULT_MODEL_FORM.baseUrl,
        model: form.model.trim() || DEFAULT_MODEL_FORM.model,
        context_window_hint: Number(form.contextWindowHint || DEFAULT_MODEL_FORM.contextWindowHint),
        supports_streaming: Boolean(form.supportsStreaming ?? DEFAULT_MODEL_FORM.supportsStreaming),
    };
    if (includeApiKey && form.apiKey.trim()) payload.api_key = form.apiKey.trim();
    return payload;
}

function applyModelApiError(data, fallback) {
    const error = data?.error || {};
    state.model.statusMessage = error.code
        ? `${error.code}: ${safeDisplayMessage(error.message || fallback)}`
        : errorMessage(data, fallback);
    state.model.statusTone = "error";
    state.model.fieldErrors = modelFieldErrors(error.fields || []);
}

function modelFieldErrors(fields) {
    return fields.reduce((errors, field) => {
        const key = modelFieldKey(field.field);
        if (key) errors[key] = fieldErrorText(field.rule);
        return errors;
    }, {});
}

function modelFieldKey(field) {
    if (field === "base_url") return "baseUrl";
    if (field === "model") return "model";
    if (field === "api_key") return "apiKey";
    if (field === "display_name") return "displayName";
    return "";
}

function fieldErrorText(rule) {
    if (rule === "required") return t("errors.required");
    if (rule === "absolute_http_url") return t("errors.absoluteHttpUrl");
    if (rule === "enum") return t("errors.enum");
    return rule || t("errors.invalid");
}

function initialRunState(locale) {
    const runLocale = locale || state.locale;
    return {
        id: "",
        status: "idle",
        stage: "compose",
        message: translate(runLocale, "run.ready"),
        error: null,
        errorCode: "",
        outputRoot: "",
        revisionOfRunId: null,
    };
}

function initialArtifactState() {
    return {
        runId: "",
        loading: false,
        loaded: false,
        error: "",
        items: [],
        manifest: null,
        textByPath: {},
        errorsByPath: {},
        pdfByPath: {},
    };
}

function initialCourseState() {
    return {
        items: [],
        selectedId: "",
        panelOpen: false,
        createTitle: "",
        renameTitle: "",
        loading: false,
        busy: "",
        message: "",
        tone: "neutral",
    };
}

function buildRunPayload({ promptText, uploadIds, revisionOfRunId }) {
    return buildRunRequest({
        promptText,
        uploadIds,
        revisionOfRunId,
        intent: state.intent,
        outputPreference: state.outputPreference,
        searchMode: state.searchMode,
        modelProfileId: state.model.profile?.id || null,
        courseId: state.course.selectedId || null,
        targetPages: state.targetPages,
    });
}

function outputPreferenceForIntent(intent) {
    return outputPreferenceForIntentCore(intent, state.outputPreference);
}

function optionsForIntent(intent) {
    return optionsForIntentCore(intent, state.targetPages);
}

function canSubmitRun(isAuthenticated) {
    return canSubmitRunCore({
        isAuthenticated,
        taskText: state.taskText,
        runStatus: state.run.status,
    });
}

function applyRunApiError(data, fallback) {
    const error = data?.error || {};
    state.fieldErrors = runFieldErrors(error.fields || []);
    state.run = {
        ...state.run,
        status: "failed",
        stage: "submit_run",
        message: t("run.requestFailed"),
        error: errorMessage(data, fallback),
        errorCode: String(error.code || "request_failed"),
    };
    upsertRunHistory();
}

function runFieldErrors(fields) {
    return fields.reduce((errors, field) => {
        if (field.field === "task_text") errors.task_text = fieldErrorText(field.rule);
        if (field.field === "options.target_pages") errors.target_pages = fieldErrorText(field.rule);
        if (field.field === "output_preference") errors.output_preference = fieldErrorText(field.rule);
        return errors;
    }, {});
}

function applyRunPayload(payload) {
    const nextRunId = payload.id || payload.run_id || state.run.id || "";
    if (nextRunId && state.run.id && nextRunId !== state.run.id) {
        state.artifacts = initialArtifactState();
    }
    if (payload.context) state.context = normalizeContextEstimate(payload.context, "backend");
    state.run = {
        ...state.run,
        id: nextRunId,
        status: payload.status || state.run.status,
        stage: payload.stage || state.run.stage || "queued",
        message: runMessageFromPayload(payload),
        error: errorFromPayload(payload),
        errorCode: errorCodeFromPayload(payload),
        outputRoot: payload.output_root || state.run.outputRoot || "",
    };
    if (!TERMINAL_RUN_STATUSES.has(state.run.status) && state.artifacts.runId) {
        state.artifacts = initialArtifactState();
    }
}

function runMessageFromPayload(payload) {
    if (payload.message) return safeDisplayMessage(payload.message);
    if (payload.error?.message) return safeDisplayMessage(payload.error.message);
    if (payload.error_message) return safeDisplayMessage(payload.error_message);
    if (payload.status === "succeeded") return t("run.succeeded");
    if (payload.status === "failed") return t("run.failed");
    if (payload.status === "running") return t("run.running");
    return t("run.queued");
}

function errorFromPayload(payload) {
    if (payload.error?.message) return safeDisplayMessage(payload.error.message);
    if (payload.status === "failed" && payload.error_message) return safeDisplayMessage(payload.error_message);
    return null;
}

function errorCodeFromPayload(payload) {
    if (payload.error?.code) return String(payload.error.code);
    if (payload.status === "failed" && typeof payload.error_message === "string") {
        return payload.error_message.split(":")[0] || "run_failed";
    }
    return "";
}

function startRunPolling(runId) {
    stopRunPolling();
    runPollTimerId = window.setInterval(() => {
        pollRunEvent(runId).catch((error) => {
            stopRunPolling();
            state.run = {
                ...state.run,
                status: "failed",
                stage: "poll_status",
                message: t("run.refreshFailed"),
                error: safeDisplayMessage(error.message),
                errorCode: "status_refresh_failed",
            };
            upsertRunHistory();
            render();
        });
    }, RUN_POLL_INTERVAL_MS);
}

function stopRunPolling() {
    if (!runPollTimerId) return;
    window.clearInterval(runPollTimerId);
    runPollTimerId = null;
}

async function pollRunEvent(runId) {
    if (!runId || !state.token) return;
    const response = await fetch(`${API_URL}/api/runs/${encodeURIComponent(runId)}/events`, {
        headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(data, t("run.statusRefreshFailed")));
    applyRunPayload(data);
    upsertRunHistory();
    render();
    if (TERMINAL_RUN_STATUSES.has(state.run.status)) {
        stopRunPolling();
        hydrateRunArtifacts(runId).catch(() => {});
    }
}

async function hydrateRunArtifacts(runId) {
    if (!runId || !state.token) return;
    if (state.artifacts.runId === runId && (state.artifacts.loading || state.artifacts.loaded)) return;
    state.artifacts = {
        ...initialArtifactState(),
        runId,
        loading: true,
    };
    render();
    try {
        const response = await fetch(`${API_URL}/api/runs/${encodeURIComponent(runId)}/artifacts`, {
            headers: { Authorization: `Bearer ${state.token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(errorMessage(data, t("source.artifactLoadFailed")));
        if (state.run.id !== runId) return;
        const items = normalizeArtifactMetadata(data.artifacts);
        state.artifacts = {
            ...state.artifacts,
            loading: true,
            items,
            manifest: data.manifest && typeof data.manifest === "object" ? data.manifest : null,
            error: "",
        };
        render();
        await hydrateTextArtifacts(runId, items);
        await hydratePdfArtifacts(runId, items);
        if (state.run.id !== runId) return;
        state.artifacts = {
            ...state.artifacts,
            loading: false,
            loaded: true,
        };
        render();
    } catch (error) {
        if (state.run.id !== runId) return;
        state.artifacts = {
            ...state.artifacts,
            loading: false,
            loaded: false,
            error: safeDisplayMessage(error.message || t("source.artifactLoadFailed")),
        };
        render();
    }
}

async function hydrateTextArtifacts(runId, artifacts) {
    const textArtifacts = artifacts.filter((artifact) => isTextArtifact(artifact));
    const nextText = {};
    const nextErrors = {};
    await Promise.all(textArtifacts.map(async (artifact) => {
        try {
            const response = await fetch(artifactUrl(runId, artifact), {
                headers: { Authorization: `Bearer ${state.token}` },
            });
            const text = await response.text();
            if (!response.ok) throw new Error(safeDisplayMessage(text || t("source.artifactReadFailed")));
            nextText[artifact.path] = sanitizeArtifactText(text);
        } catch (error) {
            nextErrors[artifact.path] = safeDisplayMessage(error.message || t("source.artifactReadFailed"));
        }
    }));
    if (state.run.id !== runId) return;
    state.artifacts = {
        ...state.artifacts,
        textByPath: nextText,
        errorsByPath: nextErrors,
    };
}

async function hydratePdfArtifacts(runId, artifacts) {
    const pdfArtifacts = artifacts.filter((artifact) => artifact.kind === "pdf" || artifact.mediaType === "application/pdf");
    if (!pdfArtifacts.length) return;
    await Promise.all(pdfArtifacts.map(async (artifact) => {
        const entry = pdfPreviewEntry(artifact.path);
        const pageNumber = clampPdfPage(entry.currentPage || 1, entry.pageCount || 1);
        await renderPdfPageToState(runId, artifact, pageNumber);
    }));
}

async function handlePdfPageAction(button) {
    const path = button.dataset.pdfPath || "";
    const artifact = state.artifacts.items.find((item) => item.path === path);
    if (!artifact || !state.run.id) return;
    const entry = pdfPreviewEntry(path);
    const pageCount = entry.pageCount || 1;
    let nextPage = entry.currentPage || 1;
    if (button.dataset.pdfPageAction === "previous") nextPage -= 1;
    else if (button.dataset.pdfPageAction === "next") nextPage += 1;
    else nextPage = Number(button.dataset.pdfPage || nextPage);
    nextPage = clampPdfPage(nextPage, pageCount);
    const hasPage = Boolean(entry.pages?.[nextPage]);
    state.artifacts = {
        ...state.artifacts,
        pdfByPath: {
            ...state.artifacts.pdfByPath,
            [path]: {
                ...entry,
                currentPage: nextPage,
                loading: !hasPage,
                error: hasPage ? entry.error : "",
            },
        },
    };
    render();
    if (!hasPage) {
        await renderPdfPageToState(state.run.id, artifact, nextPage);
    }
}

async function renderPdfPageToState(runId, artifact, pageNumber) {
    const path = artifact.path;
    const previous = pdfPreviewEntry(path);
    state.artifacts = {
        ...state.artifacts,
        pdfByPath: {
            ...state.artifacts.pdfByPath,
            [path]: {
                ...previous,
                currentPage: pageNumber,
                loading: true,
                error: "",
            },
        },
    };
    render();
    try {
        const rendered = await renderPdfArtifactPage(runId, artifact, pageNumber);
        if (state.run.id !== runId) return;
        const latest = pdfPreviewEntry(path);
        state.artifacts = {
            ...state.artifacts,
            pdfByPath: {
                ...state.artifacts.pdfByPath,
                [path]: {
                    ...latest,
                    loading: false,
                    error: "",
                    pageCount: rendered.pageCount,
                    currentPage: rendered.pageNumber,
                    pages: {
                        ...(latest.pages || {}),
                        [rendered.pageNumber]: rendered.dataUrl,
                    },
                    width: rendered.width,
                    height: rendered.height,
                },
            },
        };
        render();
    } catch (error) {
        if (state.run.id !== runId) return;
        const latest = pdfPreviewEntry(path);
        state.artifacts = {
            ...state.artifacts,
            pdfByPath: {
                ...state.artifacts.pdfByPath,
                [path]: {
                    ...latest,
                    loading: false,
                    error: safeDisplayMessage(error.message || t("preview.pdfRendererError")),
                    currentPage: pageNumber,
                    pages: latest.pages || {},
                },
            },
        };
        render();
    }
}

async function renderPdfArtifactPage(runId, artifact, pageNumber) {
    const response = await fetch(artifactUrl(runId, artifact), {
        headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(safeDisplayMessage(text || t("source.artifactReadFailed")));
    }
    const bytes = await response.arrayBuffer();
    const pdfjsLib = await getPdfjsLib();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    const documentProxy = await loadingTask.promise;
    const pageCount = documentProxy.numPages;
    const safePage = clampPdfPage(pageNumber, pageCount);
    const page = await documentProxy.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, PDF_RENDER_WIDTH / Math.max(1, baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error(t("preview.pdfRendererError"));
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    await documentProxy.destroy();
    return {
        dataUrl,
        pageCount,
        pageNumber: safePage,
        width: canvas.width,
        height: canvas.height,
    };
}

async function getPdfjsLib() {
    if (!pdfjsModulePromise) {
        pdfjsModulePromise = import("pdfjs-dist/build/pdf.mjs").then((module) => {
            module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            return module;
        });
    }
    return pdfjsModulePromise;
}

function artifactUrl(runId, artifact) {
    const url = artifact.url || `/api/runs/${encodeURIComponent(runId)}/artifacts/files/${artifact.path.split("/").map(encodeURIComponent).join("/")}`;
    return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function updateContextDial() {
    const estimate = getCurrentContextEstimate();
    const dial = document.querySelector(".dial-ring");
    const widget = document.querySelector(".context-widget");
    if (!dial || !widget) return;
    dial.style.setProperty("--context-ratio", `${Math.min(100, estimate.utilization_ratio * 100)}%`);
    const dialImage = dial.querySelector("img");
    if (dialImage) dialImage.src = contextDialAssets[estimate.warning_level] || contextDialAssets.ok;
    widget.dataset.contextState = estimate.warning_level;
    widget.setAttribute("aria-label", contextAriaLabel(estimate));
    setContextText("state", contextStateLabel(estimate.warning_level));
    setContextText("source-label", contextSourceLabel(estimate.source));
    setContextText("summary", contextSummary(estimate));
    setContextText("input", formatInt(estimate.estimated_input_tokens));
    setContextText("output", formatInt(estimate.estimated_output_tokens));
    setContextText("total", formatInt(estimate.estimated_total_tokens));
    setContextText("limit", formatInt(estimate.context_window_limit));
    setContextText("utilization", formatPercent(estimate.utilization_ratio));
    setContextText("warning", contextStateLabel(estimate.warning_level));
    setContextText("source", contextSourceLabel(estimate.source));
}

function updateComposerActionState() {
    const authenticated = Boolean(state.user && state.token);
    const runButton = document.querySelector("[data-action='run']");
    if (runButton) {
        runButton.disabled = !canSubmitRun(authenticated);
        runButton.dataset.runStatus = state.run.status;
        const label = runButton.querySelector("[data-run-button-label]");
        if (label) label.textContent = runButtonLabel();
    }
    const runNoteElement = document.querySelector("[data-run-note-shell]");
    if (runNoteElement) runNoteElement.outerHTML = renderComposerRunStatus(authenticated);

    const refinementDisabled = !authenticated || !state.run.id || isActiveRunStatus(state.run.status);
    const refinementButton = document.querySelector("[data-action='run-refinement']");
    if (refinementButton) refinementButton.disabled = refinementDisabled || !state.refinementText.trim();
}

function setContextText(field, text) {
    document.querySelectorAll(`[data-context-field="${field}"]`).forEach((element) => {
        element.textContent = text;
    });
}

function refreshLocalContext() {
    state.context = calculateLocalContextEstimate();
}

function getCurrentContextEstimate() {
    return state.context || calculateLocalContextEstimate();
}

function calculateLocalContextEstimate() {
    const selected = getSelectedIntent();
    const fileBytes = state.files.reduce((total, item) => total + Number(item.size || 0), 0);
    const promptText = `${state.taskText}\n${state.refinementText}`.trim();
    const estimatedInput = Math.max(1, Math.ceil((promptText.length + Math.min(fileBytes, 200000)) / 4));
    const outputBase = selected.id === "cheat_sheet"
        ? Math.max(5000, state.targetPages * 1800)
        : selected.id === "beamer_slides"
            ? 7000
            : selected.id === "essay_latex"
                ? 6000
                : state.outputPreference === "ipynb"
                    ? 5200
                    : 4000;
    const estimatedTotal = estimatedInput + outputBase;
    const ratio = estimatedTotal / CONTEXT_LIMIT;
    let warning = "ok";
    if (ratio > 0.85) warning = "critical";
    else if (ratio >= 0.70) warning = "warning";
    return normalizeContextEstimate({
        estimated_input_tokens: estimatedInput,
        estimated_output_tokens: outputBase,
        estimated_total_tokens: estimatedTotal,
        context_window_limit: CONTEXT_LIMIT,
        utilization_ratio: ratio,
        warning_level: warning,
        source: "local",
    }, "local");
}

function normalizeContextEstimate(rawContext, fallbackSource) {
    const input = cleanNumber(rawContext?.estimated_input_tokens, 0);
    const output = cleanNumber(rawContext?.estimated_output_tokens, 0);
    const limit = cleanNumber(rawContext?.context_window_limit, CONTEXT_LIMIT) || CONTEXT_LIMIT;
    const total = cleanNumber(rawContext?.estimated_total_tokens, input + output);
    const ratio = cleanNumber(rawContext?.utilization_ratio, limit ? total / limit : 0);
    const warning = normalizeWarningLevel(rawContext?.warning_level, ratio);
    return {
        estimated_input_tokens: input,
        estimated_output_tokens: output,
        estimated_total_tokens: total,
        context_window_limit: limit,
        utilization_ratio: ratio,
        warning_level: warning,
        source: String(rawContext?.source || fallbackSource || "local"),
    };
}

function cleanNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return number;
}

function normalizeWarningLevel(level, ratio) {
    if (level === "ok" || level === "warning" || level === "critical") return level;
    if (ratio > 0.85) return "critical";
    if (ratio >= 0.70) return "warning";
    return "ok";
}

function addLocalFiles(files) {
    const existingKeys = new Set(state.files.map((file) => file.key));
    const additions = files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        name: file.name,
        size: file.size,
        status: "pending",
        uploadId: "",
    })).filter((file) => !existingKeys.has(file.key));
    state.files = [...state.files, ...additions];
    state.notice = additions.length
        ? { message: t("uploads.willUpload"), tone: "neutral" }
        : { message: t("uploads.duplicates"), tone: "neutral" };
    refreshLocalContext();
}

function addHistory(entry) {
    state.history.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        ...entry,
    });
}

function upsertRunHistory() {
    if (!state.run.id) return;
    const id = `run-${state.run.id}`;
    const existing = state.history.find((item) => item.id === id);
    const entry = {
        id,
        kind: "run",
        status: state.run.status,
        title: t("history.runTitle", { id: shortRunId(state.run.id) }),
        message: state.run.error || state.run.message,
        meta: `${stageLabel(state.run.stage)} / ${state.run.outputRoot ? truncatePath(state.run.outputRoot) : t("history.folderPending")}`,
        timestamp: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, entry);
    else state.history.push(entry);
}

function getSelectedIntent() {
    return intents.find((intent) => intent.id === state.intent) || intents[0];
}

function normalizeActiveFile() {
    state.activeFile = normalizeActiveCodeFile(state.outputPreference, state.activeFile);
}

function getCodeFiles() {
    if (state.outputPreference === "ipynb") return ["solution.ipynb"];
    return ["solution.py", "tests.py", "README.md"];
}

function getPreviewTabs() {
    return [
        { id: "primary", label: intentText(state.intent, "primaryTab") },
        { id: "source", label: intentText(state.intent, "sourceTab") },
        { id: "logs", label: t("preview.tabs.logs") },
        { id: "manifest", label: t("preview.tabs.manifest") },
    ];
}

function getExpectedFiles() {
    if (state.intent === "code_homework") {
        const main = state.outputPreference === "ipynb"
            ? { name: "solution.ipynb", relativePath: "output/solution.ipynb", kind: "notebook", badge: "NB", readyLabel: t("files.notebookReady"), pendingLabel: t("files.pending") }
            : { name: "solution.py", relativePath: "output/solution.py", kind: "script", badge: "PY", readyLabel: t("files.scriptReady"), pendingLabel: t("files.pending") };
        return [
            main,
            { name: "generation.log", relativePath: "logs/generation.log", kind: "log", badge: "LOG", readyLabel: t("files.logReady"), pendingLabel: t("files.pending") },
            { name: "manifest.json", relativePath: "manifest.json", kind: "manifest", badge: "JS", readyLabel: t("files.metadataReady"), pendingLabel: t("files.pending") },
        ];
    }
    if (state.intent === "essay_latex") {
        return [
            { name: "main.html", relativePath: "output/main.html", kind: "source", badge: "HTML", readyLabel: t("files.sourceReady"), pendingLabel: t("files.pending") },
            { name: "main.pdf", relativePath: "output/main.pdf", kind: "pdf", badge: "PDF", readyLabel: t("files.pdfReady"), pendingLabel: t("files.compilePending") },
            { name: "convert.log", relativePath: "logs/convert.log", kind: "log", badge: "LOG", readyLabel: t("files.compileLogReady"), pendingLabel: t("files.pending") },
            { name: "manifest.json", relativePath: "manifest.json", kind: "manifest", badge: "JS", readyLabel: t("files.metadataReady"), pendingLabel: t("files.pending") },
        ];
    }
    if (state.intent === "beamer_slides") {
        return [
            { name: "slides.html", relativePath: "output/slides.html", kind: "source", badge: "HTML", readyLabel: t("files.sourceReady"), pendingLabel: t("files.pending") },
            { name: "slides.pdf", relativePath: "output/slides.pdf", kind: "pdf", badge: "PDF", readyLabel: t("files.deckReady"), pendingLabel: t("files.compilePending") },
            { name: "convert.log", relativePath: "logs/convert.log", kind: "log", badge: "LOG", readyLabel: t("files.compileLogReady"), pendingLabel: t("files.pending") },
            { name: "manifest.json", relativePath: "manifest.json", kind: "manifest", badge: "JS", readyLabel: t("files.metadataReady"), pendingLabel: t("files.pending") },
        ];
    }
    return [
        { name: "cheat-sheet.html", relativePath: "output/cheat-sheet.html", kind: "source", badge: "HTML", readyLabel: t("files.sourceReady"), pendingLabel: t("files.pending") },
        { name: "cheat-sheet.pdf", relativePath: "output/cheat-sheet.pdf", kind: "pdf", badge: "PDF", readyLabel: t("files.sheetReady"), pendingLabel: t("files.compilePending") },
        { name: "convert.log", relativePath: "logs/convert.log", kind: "log", badge: "LOG", readyLabel: t("files.compileLogReady"), pendingLabel: t("files.pending") },
        { name: "manifest.json", relativePath: "manifest.json", kind: "manifest", badge: "JS", readyLabel: t("files.metadataReady"), pendingLabel: t("files.pending") },
    ];
}

function outputFilesForDisplay() {
    const expected = getExpectedFiles();
    const byPath = new Map(state.artifacts.items.map((artifact) => [artifact.path, artifact]));
    const files = expected.map((file) => {
        const artifact = byPath.get(file.relativePath);
        return artifact ? { ...file, artifact, kind: artifact.kind || file.kind } : file;
    });
    for (const artifact of state.artifacts.items) {
        if (files.some((file) => file.relativePath === artifact.path)) continue;
        if (artifact.path.startsWith("input/")) continue;
        files.push(fileDisplayFromArtifact(artifact));
    }
    return files;
}

function fileDisplayFromArtifact(artifact) {
    const name = artifactDisplayName(artifact, artifact.path);
    const extension = name.split(".").pop()?.slice(0, 3).toUpperCase() || "OUT";
    return {
        name,
        relativePath: artifact.path,
        kind: artifact.kind || "artifact",
        badge: extension,
        readyLabel: readyLabelForArtifact(artifact),
        pendingLabel: t("files.pending"),
        artifact,
    };
}

function readyLabelForArtifact(artifact) {
    if (artifact.kind === "pdf") return t("files.pdfReady");
    if (artifact.kind === "log") return t("files.logReady");
    if (artifact.kind === "manifest") return t("files.metadataReady");
    if (artifact.kind === "notebook") return t("files.notebookReady");
    if (artifact.kind === "script") return t("files.scriptReady");
    return t("files.sourceReady");
}

function sourceFilenameForIntent() {
    if (state.intent === "code_homework") return state.outputPreference === "ipynb" ? "solution.ipynb" : "solution.py";
    if (state.intent === "beamer_slides") return "slides.html";
    if (state.intent === "cheat_sheet") return "cheat-sheet.html";
    return "main.html";
}

function codePreviewText(filename) {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryCode", {
        intent: state.intent,
        outputPreference: state.outputPreference,
        activeFile: filename,
    });
    const content = artifact ? artifactText(artifact.path) : "";
    if (content) return content;
    if (artifact && artifactReadFailed(artifact.path)) return rendererErrorText(artifact);
    if (state.artifacts.loading && state.run.id) return t("source.artifactLoading");
    if (filename === "tests.py") {
        return `from solution import solve\n\n\ndef test_sample_case():\n    assert solve([2, 4, 6]) == 12\n`;
    }
    if (filename === "README.md") {
        return `# Solution Notes\n\n- Parse the assignment input explicitly.\n- Keep edge cases near the solver.\n- Include complexity in the final answer.\n`;
    }
    return `from __future__ import annotations\n\n\ndef solve(values: list[int]) -> int:\n    \"\"\"Return the requested aggregate for the homework task.\"\"\"\n    total = 0\n    for value in values:\n        if value < 0:\n            continue\n        total += value\n    return total\n\n\nif __name__ == \"__main__\":\n    print(solve([1, 2, 3]))\n`;
}

function notebookCodeText() {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryCode", {
        intent: state.intent,
        outputPreference: "ipynb",
        activeFile: "solution.ipynb",
    });
    const content = artifact ? artifactText(artifact.path) : "";
    if (content) return notebookCodeFromText(content);
    if (artifact && artifactReadFailed(artifact.path)) return rendererErrorText(artifact);
    if (state.artifacts.loading && state.run.id) return t("source.artifactLoading");
    return `def solve(values):\n    total = 0\n    for value in values:\n        total += value\n    return total\n\nsolve([1, 2, 3])`;
}

function sourcePreviewText() {
    const source = sourceInspectionModel();
    return source.text;
}

function sourceInspectionModel() {
    const artifact = findArtifactByRole(state.artifacts.items, "source", {
        intent: state.intent,
        outputPreference: state.outputPreference,
        activeFile: sourceFilenameForIntent(),
    });
    const text = artifact ? artifactText(artifact.path) : "";
    if (text) return { artifact, text, message: t("source.artifactLoaded"), tone: "success" };
    if (artifact && artifactReadFailed(artifact.path)) return { artifact, text: rendererErrorText(artifact), message: t("source.artifactReadFailed"), tone: "error" };
    if (state.artifacts.loading && state.run.id) return { artifact, text: t("source.artifactLoading"), message: t("source.artifactLoading"), tone: "loading" };
    if (state.artifacts.error) return { artifact: null, text: sourceSkeletonText(), message: state.artifacts.error, tone: "error" };
    return { artifact: null, text: sourceSkeletonText(), message: t("preview.sourceMessage"), tone: "neutral" };
}

function logInspectionModel() {
    const artifact = findArtifactByRole(state.artifacts.items, "log", { intent: state.intent });
    const text = artifact ? artifactText(artifact.path) : "";
    if (text) return { artifact, text, message: t("source.artifactLoaded"), tone: "success" };
    if (artifact && artifactReadFailed(artifact.path)) return { artifact, text: rendererErrorText(artifact), message: t("source.artifactReadFailed"), tone: "error" };
    if (state.artifacts.loading && state.run.id) return { artifact, text: liveLogText(), message: t("source.artifactLoading"), tone: "loading" };
    if (state.artifacts.error) return { artifact: null, text: liveLogText(), message: state.artifacts.error, tone: "error" };
    return { artifact: null, text: liveLogText(), message: t("preview.logsMessage"), tone: "neutral" };
}

function manifestInspectionModel() {
    const artifact = findArtifactByRole(state.artifacts.items, "manifest");
    const text = artifact ? artifactText(artifact.path) : "";
    if (text) return { artifact, text, message: t("source.artifactLoaded"), tone: "success" };
    if (artifact && artifactReadFailed(artifact.path)) return { artifact, text: rendererErrorText(artifact), message: t("source.artifactReadFailed"), tone: "error" };
    if (state.artifacts.manifest) {
        return {
            artifact,
            text: JSON.stringify(state.artifacts.manifest, null, 2),
            message: t("source.artifactMetadataLoaded"),
            tone: "success",
        };
    }
    if (state.artifacts.loading && state.run.id) return { artifact, text: "", message: t("source.artifactLoading"), tone: "loading" };
    if (state.artifacts.error) return { artifact: null, text: "", message: state.artifacts.error, tone: "error" };
    return { artifact: null, text: "", message: t("preview.manifestMessage"), tone: "neutral" };
}

function notebookPreviewModel() {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryCode", {
        intent: state.intent,
        outputPreference: "ipynb",
        activeFile: "solution.ipynb",
    });
    const text = artifact ? artifactText(artifact.path) : "";
    if (text) {
        return {
            title: artifactDisplayName(artifact, "solution.ipynb"),
            body: notebookSummaryFromText(text),
            code: notebookCodeFromText(text),
            detail: t("source.artifactLoaded"),
        };
    }
    if (artifact && artifactReadFailed(artifact.path)) {
        return {
            title: artifactDisplayName(artifact, "solution.ipynb"),
            body: t("source.artifactReadFailed"),
            code: rendererErrorText(artifact),
            detail: t("preview.preservedForInspection"),
        };
    }
    return {
        title: t("preview.notebookApproach"),
        body: t("preview.notebookApproachBody"),
        code: notebookCodeText(),
        detail: state.run.status === "failed" ? t("preview.preservedForInspection") : t("preview.noExecution"),
    };
}

function sourceSkeletonText() {
    if (state.intent === "code_homework") return codePreviewText("solution.py");
    if (state.intent === "beamer_slides") {
        return `<!doctype html>\n<html lang="${state.locale}">\n<head>\n  <meta charset="utf-8">\n  <style>\n    @page { size: 10in 5.625in; margin: 0; }\n    .slide { width: 960px; height: 540px; page-break-after: always; }\n  </style>\n</head>\n<body>\n  <section class="slide">\n    <h1>${escapeHtmlForSkeleton(briefTitle(t("preview.generatedSlidesSource")))}</h1>\n    <ul><li>Motivation</li><li>Method</li><li>Result</li></ul>\n  </section>\n</body>\n</html>\n`;
    }
    if (state.intent === "cheat_sheet") {
        return `<!doctype html>\n<html lang="${state.locale}">\n<head>\n  <meta charset="utf-8">\n  <style>\n    @page { size: A4; margin: 8mm; }\n    main { columns: 4; font-size: 8px; }\n  </style>\n</head>\n<body><main><h1>Dense Review</h1><p>Key definitions, formulas, and proof templates.</p></main></body>\n</html>\n`;
    }
    return `<!doctype html>\n<html lang="${state.locale}">\n<head>\n  <meta charset="utf-8">\n  <style>@page { size: A4; margin: 20mm; } body { font-family: serif; }</style>\n</head>\n<body>\n  <article>\n    <h1>${escapeHtmlForSkeleton(briefTitle(t("preview.generatedEssay")))}</h1>\n    <h2>${escapeHtmlForSkeleton(t("preview.introduction"))}</h2>\n    <p>The generated HTML source is preserved even if PDF conversion fails.</p>\n    <h2>${escapeHtmlForSkeleton(t("preview.argument"))}</h2>\n    <p>Evidence and citations are recorded in the run manifest.</p>\n  </article>\n</body>\n</html>\n`;
}

function escapeHtmlForSkeleton(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function liveLogText() {
    const lines = [
        `${timestampLabel()} ${stageLabel(state.run.stage)}: ${state.run.message}`,
        `run ${state.run.id || t("source.notStarted")}`,
        `${t("source.status")} ${statusLabel(state.run.status)}`,
    ];
    if (state.run.error) lines.push(`${t("source.error")} ${state.run.error}`);
    return lines.join("\n");
}

function renderLogLines(text) {
    return String(text || "").split("\n").filter(Boolean).map((line) => {
        const firstSpace = line.indexOf(" ");
        const label = firstSpace > 0 ? line.slice(0, firstSpace) : "log";
        const body = firstSpace > 0 ? line.slice(firstSpace + 1) : line;
        const errorClass = /error|failed|traceback|exception|compile_failed/iu.test(line) ? " class=\"is-error\"" : "";
        return `<p${errorClass}><span>${escapeHtml(label)}</span> ${escapeHtml(body)}</p>`;
    }).join("") || `<p><span>${escapeHtml(t("source.status"))}</span> ${escapeHtml(t("source.noArtifactText"))}</p>`;
}

function artifactText(path) {
    return state.artifacts.textByPath[path] || "";
}

function pdfPreviewEntry(path) {
    return state.artifacts.pdfByPath[path] || {
        loading: false,
        error: "",
        pageCount: 0,
        currentPage: 1,
        pages: {},
    };
}

function artifactReadFailed(path) {
    return Boolean(state.artifacts.errorsByPath[path]);
}

function rendererErrorText(artifact) {
    const detail = state.artifacts.errorsByPath[artifact.path] || t("source.artifactReadFailed");
    return `${t("source.artifactReadFailed")}\n${artifact.path}\n${detail}`;
}

function artifactDisplayName(artifact, fallback) {
    const path = artifact?.path || "";
    return path.split("/").filter(Boolean).pop() || fallback;
}

function languageForFilename(filename) {
    if (filename.endsWith(".json") || filename.endsWith(".ipynb")) return "json";
    if (filename.endsWith(".html") || filename.endsWith(".htm")) return "html";
    return "python";
}

function notebookSummaryFromText(text) {
    try {
        const notebook = JSON.parse(text);
        const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
        const markdown = cells.find((cell) => cell.cell_type === "markdown");
        const source = Array.isArray(markdown?.source) ? markdown.source.join("") : String(markdown?.source || "");
        return source.trim().replace(/\s+/gu, " ").slice(0, 220) || t("preview.notebookApproachBody");
    } catch {
        return t("preview.notebookApproachBody");
    }
}

function notebookCodeFromText(text) {
    try {
        const notebook = JSON.parse(text);
        const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
        const code = cells.find((cell) => cell.cell_type === "code");
        const source = Array.isArray(code?.source) ? code.source.join("") : String(code?.source || "");
        return source.trim() || text;
    } catch {
        return text;
    }
}

function renderHighlightedCode(text, language = "python") {
    const lines = String(text).replace(/\s+$/u, "").split("\n");
    return `
        <ol class="code-lines">
            ${lines.map((line, index) => `
                <li>
                    <span class="line-no">${index + 1}</span>
                    <code>${highlightLine(line, language)}</code>
                </li>
            `).join("")}
        </ol>
    `;
}

function highlightLine(line, language) {
    if (language === "json") return highlightJson(line);
    if (language === "html") return highlightHtml(line);
    return highlightPython(line);
}

function highlightPython(line) {
    const tokens = line.match(/#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|./g) || [];
    const keywords = new Set(["def", "class", "from", "import", "for", "if", "else", "elif", "return", "continue", "in", "as", "print", "with", "try", "except", "raise", "while", "True", "False", "None"]);
    return tokens.map((token, index) => {
        if (token.startsWith("#")) return `<span class="syntax-comment">${escapeHtml(token)}</span>`;
        if (token.startsWith("\"") || token.startsWith("'")) return `<span class="syntax-string">${escapeHtml(token)}</span>`;
        if (/^\d+$/u.test(token)) return `<span class="syntax-number">${escapeHtml(token)}</span>`;
        if (keywords.has(token)) return `<span class="syntax-keyword">${escapeHtml(token)}</span>`;
        if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(token) && nextNonSpaceToken(tokens, index) === "(") {
            return `<span class="syntax-function">${escapeHtml(token)}</span>`;
        }
        return escapeHtml(token);
    }).join("") || " ";
}

function highlightJson(line) {
    const tokens = line.match(/"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?|\s+|./g) || [];
    return tokens.map((token, index) => {
        if (token.startsWith("\"")) {
            const cls = nextNonSpaceToken(tokens, index) === ":" ? "syntax-keyword" : "syntax-string";
            return `<span class="${cls}">${escapeHtml(token)}</span>`;
        }
        if (/^(true|false|null)$/u.test(token)) return `<span class="syntax-keyword">${escapeHtml(token)}</span>`;
        if (/^-?\d+(?:\.\d+)?$/u.test(token)) return `<span class="syntax-number">${escapeHtml(token)}</span>`;
        return escapeHtml(token);
    }).join("") || " ";
}

function highlightHtml(line) {
    const tokens = line.match(/<!--.*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|&[A-Za-z0-9#]+;|\s+|./g) || [];
    return tokens.map((token) => {
        if (token.startsWith("<!--")) return `<span class="syntax-comment">${escapeHtml(token)}</span>`;
        if (/^<\/?[A-Za-z]/u.test(token)) return `<span class="syntax-keyword">${escapeHtml(token)}</span>`;
        if (token.startsWith("\"") || token.startsWith("'")) return `<span class="syntax-string">${escapeHtml(token)}</span>`;
        if (/^&[A-Za-z0-9#]+;$/u.test(token)) return `<span class="syntax-number">${escapeHtml(token)}</span>`;
        return escapeHtml(token);
    }).join("") || " ";
}

function nextNonSpaceToken(tokens, index) {
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        if (!/^\s+$/u.test(tokens[cursor])) return tokens[cursor];
    }
    return "";
}

async function copyVisiblePreview() {
    const text = state.previewTab === "logs"
        ? logInspectionModel().text
        : state.previewTab === "manifest"
            ? (manifestInspectionModel().text || JSON.stringify(expectedManifestSkeleton(), null, 2))
            : state.previewTab === "source"
                ? sourcePreviewText()
                : state.intent === "code_homework"
                    ? state.outputPreference === "ipynb" ? notebookCodeText() : codePreviewText(state.activeFile)
                    : primaryHtmlPreviewText() || state.run.outputRoot || artifactAccessNote();
    await copyText(text, t("run.previewCopied"));
}

function primaryHtmlPreviewText() {
    const artifact = findArtifactByRole(state.artifacts.items, "primaryHtml", { intent: state.intent });
    return artifact ? artifactText(artifact.path) : "";
}

async function copyText(text, message) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        state.notice = { message, tone: "success" };
    } catch {
        state.notice = { message: t("run.clipboardUnavailable"), tone: "error" };
    }
    render();
}

function revealRunFolder() {
    if (!state.run.outputRoot) return;
    copyText(state.run.outputRoot, t("run.pathRevealCopied"));
}

function openLocalPath(path) {
    if (!path) return;
    const url = path.startsWith("file://") ? path : `file://${path}`;
    window.open(url, "_blank", "noopener,noreferrer");
}

function artifactAbsolutePath(relativePath) {
    if (!state.run.outputRoot) return "";
    return `${state.run.outputRoot.replace(/\/$/u, "")}/${relativePath}`;
}

function artifactAccessNote() {
    if (state.artifacts.error) return state.artifacts.error;
    if (state.artifacts.loading) return t("source.artifactLoading");
    if (state.artifacts.loaded) return t("source.artifactLoaded");
    if (state.run.outputRoot) return t("source.artifactNoteReady");
    return t("source.artifactNotePending");
}

function runButtonLabel() {
    if (isActiveRunStatus(state.run.status)) return t("actions.running");
    if (state.run.status === "failed") return t("actions.runAgain");
    return t("actions.runArtifact");
}

function renderComposerRunStatus(isAuthenticated) {
    if (!isActiveRunStatus(state.run.status)) {
        return `<span class="run-note" data-run-note-shell>${escapeHtml(runNote(isAuthenticated))}</span>`;
    }
    return `
        <div class="comfort-progress" data-run-note-shell role="status" aria-live="polite" aria-label="${escapeHtml(t("composer.progressAria"))}">
            <div class="comfort-progress-head">
                <strong>${escapeHtml(t("composer.progressLabel"))}</strong>
                <span>${escapeHtml(stageLabel(state.run.stage))}</span>
            </div>
            <div class="comfort-progress-track" aria-hidden="true">
                <span class="comfort-progress-fill"></span>
            </div>
            <p>${escapeHtml(t("composer.progressNote"))}</p>
        </div>
    `;
}

function runNote(isAuthenticated) {
    if (!isAuthenticated) return t("composer.runNoteLogin");
    if (!state.taskText.trim()) return t("composer.runNoteBrief");
    if (state.files.some((file) => !file.uploadId)) return t("composer.runNoteUploads");
    if (isActiveRunStatus(state.run.status)) return t("composer.runNoteRunning");
    return t("composer.runNoteReady");
}

function codeStatusTitle() {
    if (state.run.status === "failed") return t("run.validationIssue");
    if (state.run.status === "succeeded") return t("run.artifactReady");
    if (isActiveRunStatus(state.run.status)) return t("run.generating");
    return t("run.rendererArmed");
}

function codeStatusDetail() {
    if (state.run.status === "failed") return state.run.errorCode || t("run.sourcePreserved");
    if (state.run.status === "succeeded") return state.run.outputRoot ? t("run.downloadOpenAvailable") : t("run.completed");
    if (isActiveRunStatus(state.run.status)) return stageLabel(state.run.stage);
    return t("run.syntaxPreview");
}

function normalizedStageBucket(stage, status) {
    if (status === "queued") return "route";
    if (status === "succeeded") {
        if (state.intent === "code_homework") return "validate";
        return "compile";
    }
    if (stage?.includes("context") || stage?.includes("upload")) return state.intent === "cheat_sheet" ? "ingest" : "context";
    if (stage?.includes("search") || stage?.includes("route")) return "route";
    if (stage?.includes("compile")) return "compile";
    if (stage?.includes("validate")) return "validate";
    if (stage?.includes("outline")) return "outline";
    if (stage?.includes("layout")) return "layout";
    if (stage?.includes("compress")) return "compress";
    if (stage?.includes("generate") || stage?.includes("source")) return state.intent === "beamer_slides" ? "write" : "generate";
    return getSelectedIntent().stages[0];
}

function stageLabel(stage) {
    const key = String(stage || "compose");
    const translated = t(`stages.${key}`);
    return translated === `stages.${key}` ? key.replaceAll("_", " ") : translated;
}

function uploadStatusLabel(item) {
    if (item.status === "uploaded") return t("uploads.uploaded");
    if (item.status === "uploading") return t("uploads.uploading");
    if (item.status === "failed") return t("uploads.failed");
    return formatBytes(item.size);
}

function fileKind(filename) {
    const ext = String(filename).split(".").pop()?.slice(0, 3).toUpperCase();
    return ext || "FILE";
}

function getInitialLocale() {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (isSupportedLocale(stored)) return stored;
    const browserLocale = navigator.language || "";
    if (browserLocale.toLowerCase().startsWith("zh")) {
        return browserLocale.toLowerCase().includes("tw") || browserLocale.toLowerCase().includes("hk")
            ? "zh-Hant"
            : "zh-Hans";
    }
    return DEFAULT_LOCALE;
}

function setLocale(locale) {
    const nextLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
    if (state.locale === nextLocale) return;
    state.locale = nextLocale;
    localStorage.setItem(LOCALE_KEY, nextLocale);
    state.course.message = "";
    state.course.tone = "neutral";
    refreshLocalizedHistory();
    if (state.run.status === "idle" && state.run.stage === "compose") {
        state.run.message = t("run.ready");
    }
    render();
}

function isSupportedLocale(locale) {
    return LOCALES.some((item) => item.id === locale);
}

function applyLocaleDocumentState() {
    document.documentElement.lang = state.locale;
    document.title = t("app.title");
}

function initialReadyHistory(locale) {
    return {
        id: "session-ready",
        kind: "system",
        status: "idle",
        title: translate(locale, "history.readyTitle"),
        message: translate(locale, "history.readyMessage"),
        timestamp: new Date().toISOString(),
    };
}

function refreshLocalizedHistory() {
    const ready = state.history.find((item) => item.id === "session-ready");
    if (!ready) return;
    ready.title = t("history.readyTitle");
    ready.message = t("history.readyMessage");
}

function intentText(intentId, key) {
    return t(`intents.${intentId}.${key}`);
}

function statusLabel(status) {
    const key = String(status || "idle");
    const translated = t(`status.${key}`);
    return translated === `status.${key}` ? key : translated;
}

function t(path, values = {}) {
    return translate(state.locale, path, values);
}

function translate(locale, path, values = {}) {
    const fallbackCatalog = messages[DEFAULT_LOCALE] || {};
    const catalog = messages[locale] || fallbackCatalog;
    const fallback = getMessageValue(fallbackCatalog, path);
    const raw = getMessageValue(catalog, path) ?? fallback ?? path;
    if (typeof raw !== "string") return path;
    return raw.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => String(values[key] ?? ""));
}

function getMessageValue(catalog, path) {
    return String(path).split(".").reduce((value, segment) => {
        if (value && Object.prototype.hasOwnProperty.call(value, segment)) return value[segment];
        return undefined;
    }, catalog);
}

function readStoredUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
        return null;
    }
}

function errorMessage(data, fallback) {
    const message = data?.error?.message || (typeof data?.detail === "string" ? data.detail : "") || (typeof data?.message === "string" ? data.message : "") || fallback;
    const code = data?.error?.code ? `${data.error.code}: ` : "";
    return safeDisplayMessage(`${code}${message}`);
}

function safeDisplayMessage(message) {
    return String(message || "")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]")
        .replace(/api[_-]?key["'\s:=]+[A-Za-z0-9._-]+/gi, "api_key [redacted]")
        .split("\n")
        .filter((line) => !/\s+at\s+/.test(line) && !/Traceback/.test(line))
        .slice(0, 3)
        .join(" ")
        .trim();
}

function sanitizeArtifactText(text) {
    return String(text || "")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted-token]")
        .replace(/(api[_-]?key["'\s:=]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
        .replace(/(authorization["'\s:=]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]");
}

function formatInt(value) {
    return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}

function contextStateLabel(level) {
    if (level === "critical") return t("context.critical");
    if (level === "warning") return t("context.warning");
    return t("context.ok");
}

function contextSourceLabel(source) {
    const normalized = String(source || "local").toLowerCase();
    if (normalized === "local") return t("context.local");
    if (normalized === "heuristic") return t("context.heuristic");
    if (normalized === "provider") return t("context.provider");
    return source;
}

function contextSummary(estimate) {
    if (estimate.warning_level === "critical") return t("context.criticalSummary");
    if (estimate.warning_level === "warning") return t("context.warningSummary");
    return t("context.ratioSummary", { percent: formatPercent(estimate.utilization_ratio) });
}

function contextAriaLabel(estimate) {
    return t("context.aria", {
        state: contextStateLabel(estimate.warning_level),
        percent: formatPercent(estimate.utilization_ratio),
        source: contextSourceLabel(estimate.source),
    });
}

function briefTitle(fallback) {
    const firstLine = state.taskText.trim().split("\n").find(Boolean) || "";
    const cleaned = firstLine.replace(/[^\w\s:,-]/g, "").trim();
    if (!cleaned) return fallback;
    return cleaned.length > 52 ? `${cleaned.slice(0, 49)}...` : cleaned;
}

function shortRunId(runId) {
    return String(runId || "").slice(0, 8) || "pending";
}

function formatHistoryTime(timestamp) {
    try {
        return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
    } catch {
        return "";
    }
}

function timestampLabel() {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

function truncatePath(path) {
    const text = String(path || "");
    if (text.length <= 46) return text;
    return `...${text.slice(-43)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
