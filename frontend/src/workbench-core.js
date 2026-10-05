export const ARTIFACT_INTENTS = Object.freeze([
    "code_homework",
    "essay_latex",
    "beamer_slides",
    "cheat_sheet",
]);

export const SEARCH_MODES = Object.freeze(["auto", "on", "off"]);

export const UPLOAD_ACCEPT_ATTRIBUTE = ".txt,.md,.py,.ipynb,.pdf,text/plain,text/markdown,text/x-python,application/json,application/pdf";

export const DEFAULT_MODEL_PROFILE = Object.freeze({
    displayName: "Qwen Default",
    provider: "openai_compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-flash",
    contextWindowHint: 1000000,
    supportsStreaming: true,
});

export function applyWorkbenchInteraction(currentState, action) {
    const next = { ...currentState };
    if (action.type === "selectIntent") {
        next.intent = normalizeIntent(action.intent);
        next.previewTab = "primary";
        next.fieldErrors = {};
        next.activeFile = normalizeActiveCodeFile(next.outputPreference, next.activeFile);
    }
    if (action.type === "selectSearchMode") {
        next.searchMode = normalizeSearchMode(action.searchMode);
    }
    if (action.type === "selectOutputPreference") {
        next.outputPreference = normalizeCodeOutputPreference(action.outputPreference);
        next.activeFile = normalizeActiveCodeFile(next.outputPreference, next.activeFile);
    }
    if (action.type === "setTargetPages") {
        next.targetPages = normalizeTargetPages(action.targetPages);
        next.fieldErrors = { ...(next.fieldErrors || {}) };
        delete next.fieldErrors.target_pages;
    }
    return next;
}

export function normalizeIntent(intent) {
    return ARTIFACT_INTENTS.includes(intent) ? intent : "code_homework";
}

export function normalizeSearchMode(mode) {
    return SEARCH_MODES.includes(mode) ? mode : "auto";
}

export function normalizeCodeOutputPreference(preference) {
    return preference === "ipynb" ? "ipynb" : "py";
}

export function normalizeTargetPages(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 1;
    return Math.round(number);
}

export function normalizeActiveCodeFile(outputPreference, activeFile) {
    const files = outputPreference === "ipynb"
        ? ["solution.ipynb"]
        : ["solution.py", "tests.py", "README.md"];
    return files.includes(activeFile) ? activeFile : files[0];
}

export function canSubmitRun({ isAuthenticated, taskText, runStatus }) {
    return Boolean(
        isAuthenticated
        && String(taskText || "").trim()
        && !isActiveRunStatus(runStatus)
    );
}

export function isActiveRunStatus(runStatus) {
    return runStatus === "queued" || runStatus === "running";
}

export function outputPreferenceForIntent(intent, codeOutputPreference) {
    if (normalizeIntent(intent) === "code_homework") {
        return normalizeCodeOutputPreference(codeOutputPreference);
    }
    return "pdf";
}

export function optionsForIntent(intent, targetPages) {
    if (normalizeIntent(intent) !== "cheat_sheet") return {};
    return {
        target_pages: normalizeTargetPages(targetPages),
        paper_size: "A4",
        density: "dense",
    };
}

export function buildRunRequest({
    promptText,
    intent,
    outputPreference,
    searchMode,
    modelProfileId = null,
    courseId = null,
    uploadIds = [],
    targetPages = 1,
    revisionOfRunId = null,
}) {
    const normalizedIntent = normalizeIntent(intent);
    const payload = {
        task_text: String(promptText || ""),
        intent: normalizedIntent,
        output_preference: outputPreferenceForIntent(normalizedIntent, outputPreference),
        search_mode: normalizeSearchMode(searchMode),
        model_profile_id: modelProfileId || null,
        course_id: courseId || null,
        upload_ids: Array.isArray(uploadIds) ? uploadIds.filter(Boolean) : [],
        options: optionsForIntent(normalizedIntent, targetPages),
    };
    if (revisionOfRunId) payload.revision_of_run_id = revisionOfRunId;
    return payload;
}

export function normalizeCourseMetadata(rawCourses) {
    if (!Array.isArray(rawCourses)) return [];
    return rawCourses
        .map((course) => ({
            id: String(course?.id || ""),
            title: String(course?.title || "").trim(),
            isDefault: Boolean(course?.is_default),
            isArchived: Boolean(course?.is_archived),
            contextEnabled: Boolean(course?.context_enabled),
            contextUpdatedAt: course?.context_updated_at ? String(course.context_updated_at) : null,
        }))
        .filter((course) => course.id && course.title && !course.isArchived)
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
}

export function resolveSelectedCourseId(courses, selectedCourseId) {
    const selectable = Array.isArray(courses) ? courses.filter((course) => !course.isArchived) : [];
    if (selectable.some((course) => course.id === selectedCourseId)) return selectedCourseId;
    return selectable.find((course) => course.isDefault)?.id || selectable[0]?.id || "";
}

export function normalizeArtifactMetadata(rawArtifacts) {
    if (!Array.isArray(rawArtifacts)) return [];
    return rawArtifacts
        .map((artifact) => ({
            path: normalizeArtifactPath(artifact?.path),
            kind: String(artifact?.kind || ""),
            mediaType: String(artifact?.media_type || ""),
            sizeBytes: Number.isFinite(Number(artifact?.size_bytes)) ? Number(artifact.size_bytes) : null,
            url: String(artifact?.url || ""),
        }))
        .filter((artifact) => artifact.path);
}

export function findArtifactByRole(artifacts, role, { intent = "code_homework", outputPreference = "py", activeFile = "" } = {}) {
    const normalized = Array.isArray(artifacts) ? artifacts : [];
    if (role === "manifest") return findFirstByKindOrName(normalized, "manifest", "manifest.json");
    if (role === "log") {
        return findFirstByPath(normalized, preferredLogPaths(intent))
            || normalized.find((artifact) => artifact.kind === "log" || artifact.path.startsWith("logs/"))
            || null;
    }
    if (role === "source") {
        return findFirstByPath(normalized, preferredSourcePaths(intent, outputPreference, activeFile))
            || normalized.find((artifact) => sourceKinds().has(artifact.kind) && isTextArtifact(artifact))
            || null;
    }
    if (role === "primaryCode") {
        return findFirstByPath(normalized, preferredCodePaths(outputPreference, activeFile))
            || normalized.find((artifact) => ["script", "notebook", "source"].includes(artifact.kind) && isTextArtifact(artifact))
            || null;
    }
    if (role === "primaryPdf") {
        return normalized.find((artifact) => artifact.kind === "pdf" || artifact.mediaType === "application/pdf") || null;
    }
    if (role === "primaryHtml") {
        return findFirstByPath(normalized, preferredSourcePaths(intent, outputPreference, activeFile))
            || normalized.find((artifact) => isHtmlArtifact(artifact))
            || null;
    }
    return null;
}

export function clampPdfPage(page, pageCount) {
    const normalizedPage = Number(page);
    const normalizedCount = Number(pageCount);
    const safeCount = Number.isFinite(normalizedCount) && normalizedCount > 0 ? Math.floor(normalizedCount) : 1;
    if (!Number.isFinite(normalizedPage) || normalizedPage <= 1) return 1;
    return Math.min(Math.floor(normalizedPage), safeCount);
}

export function isTextArtifact(artifact) {
    const mediaType = artifact?.mediaType || artifact?.media_type || "";
    const path = artifact?.path || "";
    return Boolean(
        mediaType.startsWith("text/")
        || mediaType === "application/json"
        || path.endsWith(".json")
        || path.endsWith(".py")
        || path.endsWith(".ipynb")
        || path.endsWith(".md")
        || path.endsWith(".html")
        || path.endsWith(".htm")
        || path.endsWith(".log")
    );
}

export function isHtmlArtifact(artifact) {
    const mediaType = artifact?.mediaType || artifact?.media_type || "";
    const path = artifact?.path || "";
    return Boolean(
        mediaType === "text/html"
        || mediaType === "application/xhtml+xml"
        || path.endsWith(".html")
        || path.endsWith(".htm")
    );
}

function normalizeArtifactPath(path) {
    return String(path || "").replace(/^\/+/u, "");
}

function findFirstByKindOrName(artifacts, kind, filename) {
    return artifacts.find((artifact) => artifact.kind === kind || artifact.path === filename) || null;
}

function findFirstByPath(artifacts, paths) {
    const wanted = new Set(paths.filter(Boolean));
    return artifacts.find((artifact) => wanted.has(artifact.path)) || null;
}

function preferredCodePaths(outputPreference, activeFile) {
    if (outputPreference === "ipynb") return ["output/solution.ipynb"];
    return [`output/${activeFile || "solution.py"}`, "output/solution.py", "solution.py"];
}

function preferredSourcePaths(intent, outputPreference, activeFile) {
    if (intent === "code_homework") return preferredCodePaths(outputPreference, activeFile);
    if (intent === "beamer_slides") return ["output/slides.html", "slides.html"];
    if (intent === "cheat_sheet") return ["output/cheat-sheet.html", "cheat-sheet.html"];
    return ["output/main.html", "main.html"];
}

function preferredLogPaths(intent) {
    if (intent === "code_homework") return ["logs/generation.log", "generation.log"];
    return ["logs/convert.log", "logs/generation.log", "convert.log", "generation.log"];
}

function sourceKinds() {
    return new Set(["source", "script", "notebook"]);
}
