import assert from "node:assert/strict";
import { test } from "node:test";

import { LOCALES, messages } from "../src/locales.js";
import {
    DEFAULT_MODEL_PROFILE,
    UPLOAD_ACCEPT_ATTRIBUTE,
    applyWorkbenchInteraction,
    buildRunRequest,
    canSubmitRun,
    clampPdfPage,
    findArtifactByRole,
    isHtmlArtifact,
    isActiveRunStatus,
    isTextArtifact,
    normalizeActiveCodeFile,
    normalizeArtifactMetadata,
    normalizeCourseMetadata,
    optionsForIntent,
    outputPreferenceForIntent,
    resolveSelectedCourseId,
} from "../src/workbench-core.js";

const requiredLocaleKeys = [
    "app.title",
    "actions.runArtifact",
    "controls.artifactType",
    "controls.searchMode.auto",
    "course.label",
    "course.defaultTitle",
    "course.contextDisabled",
    "course.create",
    "course.rename",
    "course.archive",
    "auth.kicker",
    "auth.email",
    "intents.code_homework.label",
    "intents.essay_latex.label",
    "intents.beamer_slides.label",
    "intents.cheat_sheet.label",
    "preview.tabs.manifest",
    "preview.stageProgress",
    "preview.sourceTitle",
    "preview.logsTitle",
    "preview.manifestTitle",
    "preview.pdfRendererError",
    "preview.pdfLoading",
    "preview.nextPage",
    "preview.previousPage",
    "composer.progressLabel",
    "composer.progressNote",
    "composer.progressAria",
    "stages.repair_source",
    "model.defaultHelp",
    "model.provider",
    "model.contextWindow",
    "model.streaming",
    "context.warningLabel",
];

test("locale catalogs include the required workbench keys", () => {
    for (const locale of LOCALES) {
        for (const key of requiredLocaleKeys) {
            assert.equal(typeof messageAt(messages[locale.id], key), "string", `${locale.id}:${key}`);
            assert.notEqual(messageAt(messages[locale.id], key).trim(), "", `${locale.id}:${key}`);
        }
    }
});

test("artifact interactions reset preview state and normalize controls", () => {
    let state = {
        intent: "code_homework",
        previewTab: "logs",
        fieldErrors: { task_text: "required" },
        activeFile: "README.md",
        outputPreference: "py",
        searchMode: "auto",
        targetPages: 2,
    };

    state = applyWorkbenchInteraction(state, { type: "selectIntent", intent: "cheat_sheet" });
    assert.equal(state.intent, "cheat_sheet");
    assert.equal(state.previewTab, "primary");
    assert.deepEqual(state.fieldErrors, {});

    state = applyWorkbenchInteraction(state, { type: "selectSearchMode", searchMode: "manual" });
    assert.equal(state.searchMode, "auto");

    state = applyWorkbenchInteraction(state, { type: "selectOutputPreference", outputPreference: "ipynb" });
    assert.equal(state.outputPreference, "ipynb");
    assert.equal(state.activeFile, "solution.ipynb");

    state = applyWorkbenchInteraction(state, { type: "setTargetPages", targetPages: "3.6" });
    assert.equal(state.targetPages, 4);
});

test("run payload builder preserves backend contract fields", () => {
    const cheatSheet = buildRunRequest({
        promptText: "Compress these lecture slides.",
        intent: "cheat_sheet",
        outputPreference: "ipynb",
        searchMode: "on",
        modelProfileId: "default-qwen",
        courseId: "course_ml",
        uploadIds: ["upl_1", "", "upl_2"],
        targetPages: 2,
    });

    assert.deepEqual(cheatSheet, {
        task_text: "Compress these lecture slides.",
        intent: "cheat_sheet",
        output_preference: "pdf",
        search_mode: "on",
        model_profile_id: "default-qwen",
        course_id: "course_ml",
        upload_ids: ["upl_1", "upl_2"],
        options: { target_pages: 2, paper_size: "A4", density: "dense" },
    });

    const revision = buildRunRequest({
        promptText: "Add comments to the solution.",
        intent: "code_homework",
        outputPreference: "ipynb",
        searchMode: "off",
        revisionOfRunId: "run_prior",
    });

    assert.equal(revision.output_preference, "ipynb");
    assert.equal(revision.course_id, null);
    assert.equal(revision.revision_of_run_id, "run_prior");
    assert.deepEqual(revision.options, {});
});

test("course helpers hide archived courses and keep the default selectable", () => {
    const courses = normalizeCourseMetadata([
        {
            id: "course_ml",
            title: "Machine Learning",
            is_default: false,
            is_archived: false,
            context_enabled: true,
        },
        {
            id: "course_default",
            title: "Just Asking",
            is_default: true,
            is_archived: false,
            context_enabled: false,
        },
        {
            id: "course_old",
            title: "Old Course",
            is_default: false,
            is_archived: true,
            context_enabled: true,
        },
    ]);

    assert.deepEqual(courses.map((course) => course.id), ["course_default", "course_ml"]);
    assert.equal(courses[0].contextEnabled, false);
    assert.equal(resolveSelectedCourseId(courses, "course_ml"), "course_ml");
    assert.equal(resolveSelectedCourseId(courses, "course_old"), "course_default");
});

test("default Qwen profile only omits the API key", () => {
    assert.equal(DEFAULT_MODEL_PROFILE.provider, "openai_compatible");
    assert.equal(DEFAULT_MODEL_PROFILE.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
    assert.equal(DEFAULT_MODEL_PROFILE.model, "qwen3.6-flash");
    assert.equal(DEFAULT_MODEL_PROFILE.contextWindowHint, 1000000);
    assert.equal(DEFAULT_MODEL_PROFILE.supportsStreaming, true);
    assert.equal(Object.hasOwn(DEFAULT_MODEL_PROFILE, "apiKey"), false);
});

test("upload accept attribute covers phase-1 file types", () => {
    for (const accepted of [".txt", ".md", ".py", ".ipynb", ".pdf", "application/pdf"]) {
        assert.equal(UPLOAD_ACCEPT_ATTRIBUTE.includes(accepted), true, accepted);
    }
});

test("submission and artifact helpers match workbench expectations", () => {
    assert.equal(canSubmitRun({
        isAuthenticated: true,
        taskText: "Write the answer.",
        runStatus: "idle",
    }), true);
    assert.equal(canSubmitRun({
        isAuthenticated: true,
        taskText: "Write the answer.",
        runStatus: "running",
    }), false);
    assert.equal(canSubmitRun({
        isAuthenticated: false,
        taskText: "Write the answer.",
        runStatus: "idle",
    }), false);

    assert.equal(outputPreferenceForIntent("essay_latex", "ipynb"), "pdf");
    assert.equal(outputPreferenceForIntent("code_homework", "ipynb"), "ipynb");
    assert.deepEqual(optionsForIntent("cheat_sheet", 0), {
        target_pages: 1,
        paper_size: "A4",
        density: "dense",
    });
    assert.equal(normalizeActiveCodeFile("py", "solution.ipynb"), "solution.py");
});

test("run motion status is active only for queued and running states", () => {
    for (const status of ["queued", "running"]) {
        assert.equal(isActiveRunStatus(status), true, status);
    }
    for (const status of ["idle", "ready", "succeeded", "failed", "cancelled", "", null]) {
        assert.equal(isActiveRunStatus(status), false, String(status));
    }
});

test("artifact metadata helpers pick real preview files by role", () => {
    const artifacts = normalizeArtifactMetadata([
        { path: "/output/solution.py", kind: "script", media_type: "text/x-python", size_bytes: 24 },
        { path: "logs/generation.log", kind: "log", media_type: "text/plain" },
        { path: "manifest.json", kind: "manifest", media_type: "application/json" },
        { path: "output/main.html", kind: "source", media_type: "text/html" },
        { path: "output/main.pdf", kind: "pdf", media_type: "application/pdf" },
        { path: "", kind: "source" },
    ]);

    assert.equal(artifacts.length, 5);
    assert.equal(artifacts[0].path, "output/solution.py");
    assert.equal(findArtifactByRole(artifacts, "primaryCode", { activeFile: "solution.py" })?.path, "output/solution.py");
    assert.equal(findArtifactByRole(artifacts, "log")?.path, "logs/generation.log");
    assert.equal(findArtifactByRole(artifacts, "manifest")?.path, "manifest.json");
    assert.equal(findArtifactByRole(artifacts, "source", { intent: "essay_latex" })?.path, "output/main.html");
    assert.equal(findArtifactByRole(artifacts, "primaryHtml", { intent: "essay_latex" })?.path, "output/main.html");
    assert.equal(findArtifactByRole(artifacts, "primaryPdf")?.path, "output/main.pdf");
    assert.equal(isTextArtifact(artifacts[3]), true);
    assert.equal(isHtmlArtifact(artifacts[3]), true);
});

test("pdf page navigation clamps to valid preview pages", () => {
    assert.equal(clampPdfPage(0, 12), 1);
    assert.equal(clampPdfPage(4.8, 12), 4);
    assert.equal(clampPdfPage(30, 12), 12);
    assert.equal(clampPdfPage("bad", 12), 1);
    assert.equal(clampPdfPage(2, 0), 1);
});

function messageAt(catalog, path) {
    return path.split(".").reduce((value, segment) => value?.[segment], catalog);
}
