import React, { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateWithDeepSeek } from "./deepseekClient.js";
import {
  REVIEW_SHEET_PROMPT,
  STUDY_SHEET_PROMPT,
  CONCEPT_MAP_PROMPT,
  MULTI_NOTE_OUTLINE_PROMPT,
  REVIEW_QUESTIONS_PROMPT,
  buildUserMessageWithNotes,
  buildUserMessageWithMultipleNotes
} from "./prompts.js";

const SUPPORT_EXTENSIONS = [".txt", ".md"];

function isSupportedFile(name) {
  const lower = name.toLowerCase();
  return SUPPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function getApiStatus(apiError, isOnline) {
  if (!navigator.onLine || !isOnline) return "offline";
  if (apiError) return "error";
  return "ready";
}

const initialOutputs = {
  reviewSheet: "",
  studySheet: "",
  conceptMap: "",
  reviewQuestions: ""
};

export default function App() {
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [outputSelection, setOutputSelection] = useState({
    reviewSheet: false,
    studySheet: false,
    conceptMap: false,
    reviewQuestions: false,
    multiNoteOutline: false
  });
  const [multiNoteOutlineContent, setMultiNoteOutlineContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [apiError, setApiError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apiStatus = useMemo(
    () => getApiStatus(apiError, true),
    [apiError]
  );

  const handleFolderSelect = useCallback(async () => {
    setGlobalError("");
    try {
      if (!window.showDirectoryPicker) {
        setGlobalError("Folder selection is not supported in this browser (File System Access API). Please use 'Upload File' instead.");
        return;
      }

      const newFiles = [];
      const handle = await window.showDirectoryPicker();
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === "file" && isSupportedFile(name)) {
          const file = await entry.getFile();
          newFiles.push({
            id: `${entry.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
            name,
            source: "folder",
            handle: entry,
            fileObject: file,
            status: "idle",
            error: "",
            text: "",
            outputs: { ...initialOutputs }
          });
        }
      }

      if (newFiles.length === 0) {
        setGlobalError("No supported files (.txt, .md) found in the selected folder.");
      }

      setFiles(newFiles);
      const firstId = newFiles[0]?.id || null;
      setSelectedFileId(firstId);
      setSelectedFileIds(firstId ? [firstId] : []);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setGlobalError(err?.message || "Failed to open folder.");
    }
  }, []);

  const handleFileUpload = useCallback(async (event) => {
    setGlobalError("");
    const fileList = Array.from(event.target.files || []);
    if (!fileList.length) return;

    const newFiles = [];
    const unsupported = [];

    for (const file of fileList) {
      if (!isSupportedFile(file.name)) {
        unsupported.push(file.name);
        continue;
      }
      newFiles.push({
        id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        source: "upload",
        handle: null,
        fileObject: file,
        status: "idle",
        error: "",
        text: "",
        outputs: { ...initialOutputs }
      });
    }

    if (unsupported.length) {
      setGlobalError(`Unsupported file types (only .txt, .md): ${unsupported.join(", ")}`);
    }

    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (!selectedFileId && combined[0]) {
        setSelectedFileId(combined[0].id);
        setSelectedFileIds([combined[0].id]);
      }
      return combined;
    });
    event.target.value = "";
  }, [selectedFileId]);

  const ensureFileTextLoaded = useCallback(
    async (fileItem) => {
      if (fileItem.text) return fileItem.text;
      if (!fileItem.fileObject) {
        throw new Error("File content is not available in memory.");
      }
      const text = await readTextFile(fileItem.fileObject);
      if (!text.trim()) {
        throw new Error("File is empty.");
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, text } : f
        )
      );
      return text;
    },
    []
  );

  const updateFileStatus = useCallback((id, patch) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }, []);

  const processOutputsForFile = useCallback(
    async (fileItem, selection) => {
      const selectedAny =
        selection.reviewSheet ||
        selection.studySheet ||
        selection.conceptMap ||
        selection.reviewQuestions;
      if (!selectedAny) {
        throw new Error("Please select at least one output type.");
      }

      const text = await ensureFileTextLoaded(fileItem);

      const newOutputs = { ...fileItem.outputs };

      const userMessage = buildUserMessageWithNotes(text);

      if (selection.reviewSheet) {
        const content = await generateWithDeepSeek(
          REVIEW_SHEET_PROMPT,
          userMessage
        );
        newOutputs.reviewSheet = content;
      }

      if (selection.studySheet) {
        const content = await generateWithDeepSeek(
          STUDY_SHEET_PROMPT,
          userMessage
        );
        newOutputs.studySheet = content;
      }

      if (selection.conceptMap) {
        const content = await generateWithDeepSeek(
          CONCEPT_MAP_PROMPT,
          userMessage
        );
        newOutputs.conceptMap = content;
      }

      if (selection.reviewQuestions) {
        const content = await generateWithDeepSeek(
          REVIEW_QUESTIONS_PROMPT,
          userMessage
        );
        newOutputs.reviewQuestions = content;
      }

      updateFileStatus(fileItem.id, {
        outputs: newOutputs
      });
    },
    [ensureFileTextLoaded, updateFileStatus]
  );

  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) || null,
    [files, selectedFileId]
  );

  const handleToggleFileCheckbox = useCallback(
    (fileId) => {
      setSelectedFileIds((prev) => {
        const exists = prev.includes(fileId);
        if (exists) {
          const next = prev.filter((id) => id !== fileId);
          return next;
        }
        return [...prev, fileId];
      });
    },
    []
  );

  const handleProcessSelected = useCallback(async () => {
    setGlobalError("");
    setApiError("");
    if (!selectedFile) {
      setGlobalError("No file selected. Please choose a file from the list first.");
      return;
    }

    const selectedAny =
      outputSelection.reviewSheet ||
      outputSelection.studySheet ||
      outputSelection.conceptMap ||
      outputSelection.reviewQuestions ||
      outputSelection.multiNoteOutline;
    if (!selectedAny) {
      setGlobalError("Please select at least one output type.");
      return;
    }

    const targetIds =
      selectedFileIds && selectedFileIds.length
        ? selectedFileIds
        : [selectedFile.id];

    if (outputSelection.multiNoteOutline && targetIds.length < 2) {
      setGlobalError("Multi-note outline requires at least 2 files. Check two or more files in the list.");
      return;
    }

    setIsProcessing(true);
    setMultiNoteOutlineContent((prev) => (outputSelection.multiNoteOutline && targetIds.length >= 2 ? "" : prev));

    try {
      if (
        outputSelection.reviewSheet ||
        outputSelection.studySheet ||
        outputSelection.conceptMap ||
        outputSelection.reviewQuestions
      ) {
        for (const id of targetIds) {
          const file = files.find((f) => f.id === id);
          if (!file) continue;

          updateFileStatus(id, { status: "processing", error: "" });
          try {
            await processOutputsForFile(file, outputSelection);
            updateFileStatus(id, { status: "done" });
          } catch (err) {
            const message = err?.message || "Failed to process file.";
            updateFileStatus(id, { status: "error", error: message });
            if (message.toLowerCase().includes("deepseek")) {
              setApiError(message);
            }
          }
        }
      }

      if (outputSelection.multiNoteOutline && targetIds.length >= 2) {
        try {
          const entries = [];
          for (const id of targetIds) {
            const file = files.find((f) => f.id === id);
            if (!file) continue;
            const text = await ensureFileTextLoaded(file);
            entries.push({ name: file.name, text });
          }
          if (entries.length >= 2) {
            const userMessage = buildUserMessageWithMultipleNotes(entries);
            const content = await generateWithDeepSeek(
              MULTI_NOTE_OUTLINE_PROMPT,
              userMessage
            );
            setMultiNoteOutlineContent(content);
          }
        } catch (err) {
          const message = err?.message || "Failed to generate multi-note outline.";
          setGlobalError(message);
          if (message.toLowerCase().includes("deepseek")) {
            setApiError(message);
          }
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [files, outputSelection, processOutputsForFile, selectedFile, selectedFileIds, updateFileStatus, ensureFileTextLoaded]);

  const handleDownloadHtml = useCallback(
    (typeKey) => {
      let content;
      let suffix;
      let baseName;
      let title;

      if (typeKey === "multiNoteOutline") {
        content = multiNoteOutlineContent;
        if (!content) {
          setGlobalError("Generate a multi-note outline first (select 2+ files and Multi-note outline).");
          return;
        }
        suffix = "multi-note-outline";
        baseName = "multi-note-outline";
        title = "Multi-note outline";
      } else {
        if (!selectedFile) return;
        content = selectedFile.outputs[typeKey];
        if (!content) {
          setGlobalError("Nothing to download for this output type yet.");
          return;
        }
        suffix =
          typeKey === "reviewSheet"
            ? "review"
            : typeKey === "studySheet"
            ? "study"
            : typeKey === "conceptMap"
            ? "concept-map"
            : "review-questions";
        baseName = selectedFile.name.replace(/\.[^.]+$/, "");
        title = `${baseName} – ${suffix.replace("-", " ")}`;
      }

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f5;
        color: #111827;
      }
      body.dark {
        background: #020617;
        color: #e5e7eb;
      }
      .page {
        max-width: 900px;
        margin: 2rem auto 3rem;
        padding: 1.5rem 1.75rem 1.75rem;
        border-radius: 1rem;
        background: white;
        color: #111827;
        box-shadow: 0 22px 50px rgba(15, 23, 42, 0.2);
      }
      body.dark .page {
        background: #020617;
        color: #e5e7eb;
        box-shadow: 0 22px 50px rgba(15, 23, 42, 0.8);
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .page-title {
        font-size: 1.4rem;
        font-weight: 600;
      }
      .page-meta {
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .markdown-body {
        font-size: 0.95rem;
        line-height: 1.6;
      }
      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3,
      .markdown-body h4 {
        font-weight: 600;
        padding: 0.5rem 0.75rem;
        margin-left: -0.75rem;
        margin-right: -0.75rem;
        padding-left: 0.75rem;
        border-radius: 0.4rem;
      }
      .markdown-body h1 {
        font-size: 1.4rem;
        margin-top: 2rem;
        margin-bottom: 0.85rem;
        background: rgba(59, 130, 246, 0.12);
        border-left: 4px solid #2563eb;
        color: #1e40af;
      }
      .markdown-body h1:first-child { margin-top: 0; }
      .markdown-body h2 {
        font-size: 1.2rem;
        margin-top: 1.75rem;
        margin-bottom: 0.65rem;
        background: rgba(34, 197, 94, 0.1);
        border-left: 4px solid #059669;
        color: #047857;
      }
      .markdown-body h3 {
        font-size: 1.05rem;
        margin-top: 1.4rem;
        margin-bottom: 0.5rem;
        background: rgba(239, 68, 68, 0.08);
        border-left: 4px solid #dc2626;
        color: #b91c1c;
      }
      .markdown-body h4 {
        font-size: 0.98rem;
        font-style: italic;
        margin-top: 1.15rem;
        margin-bottom: 0.45rem;
        background: rgba(148, 163, 184, 0.12);
        border-left: 3px solid #64748b;
        color: #475569;
      }
      body.dark .markdown-body h1 {
        background: rgba(59, 130, 246, 0.2);
        border-left-color: #3b82f6;
        color: #93c5fd;
      }
      body.dark .markdown-body h2 {
        background: rgba(34, 197, 94, 0.15);
        border-left-color: #10b981;
        color: #6ee7b7;
      }
      body.dark .markdown-body h3 {
        background: rgba(239, 68, 68, 0.15);
        border-left-color: #ef4444;
        color: #fca5a5;
      }
      body.dark .markdown-body h4 {
        background: rgba(148, 163, 184, 0.2);
        border-left-color: #94a3b8;
        color: #cbd5e1;
      }
      .markdown-body p {
        margin: 0.7rem 0;
        line-height: 1.55;
      }
      .markdown-body ul,
      .markdown-body ol {
        margin: 0.75rem 0 0.85rem 1.5rem;
        padding-left: 0.5rem;
      }
      .markdown-body ul {
        list-style-type: disc;
      }
      .markdown-body ul ul {
        list-style-type: circle;
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
      }
      .markdown-body ol {
        list-style-type: decimal;
      }
      .markdown-body li {
        margin: 0.35rem 0;
        line-height: 1.5;
        padding-left: 0.25rem;
      }
      .markdown-body li > p:first-child {
        margin-top: 0;
      }
      .markdown-body strong {
        font-weight: 600;
      }
      .markdown-body em {
        font-style: italic;
      }
      .markdown-body code {
        background: rgba(15, 23, 42, 0.06);
        border-radius: 0.3rem;
        padding: 0.08rem 0.25rem;
        font-size: 0.85rem;
      }
      body.dark .markdown-body code {
        background: rgba(15, 23, 42, 0.9);
      }
      .markdown-body pre {
        background: rgba(15, 23, 42, 0.05);
        border-radius: 0.5rem;
        padding: 0.55rem 0.75rem;
        overflow-x: auto;
        font-size: 0.85rem;
      }
      body.dark .markdown-body pre {
        background: rgba(15, 23, 42, 0.95);
      }
      .markdown-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0 1.25rem;
        font-size: 0.9rem;
      }
      .markdown-body th,
      .markdown-body td {
        border: 1px solid rgba(148, 163, 184, 0.4);
        padding: 0.5rem 0.65rem;
        text-align: left;
      }
      .markdown-body th {
        background: rgba(15, 23, 42, 0.06);
        font-weight: 600;
      }
      body.dark .markdown-body th {
        background: rgba(255, 255, 255, 0.06);
      }
      body.dark .markdown-body th,
      body.dark .markdown-body td {
        border-color: rgba(148, 163, 184, 0.3);
      }
      @media print {
        body {
          background: white !important;
        }
        .page {
          box-shadow: none;
          margin: 0;
          border-radius: 0;
        }
      }
      @media (max-width: 640px) {
        .page {
          margin-inline: 0.9rem;
          padding-inline: 1.1rem;
        }
        .page-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body class="light">
    <main class="page">
      <header class="page-header">
        <div class="page-title">${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <div class="page-meta">Generated study material</div>
      </header>
      <article class="markdown-body" id="content"></article>
    </main>
    <script>
      const md = ${JSON.stringify(content)};
      function escapeHtml(str) {
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      function applyBoldItalic(str) {
        return str
          .replace(/\\*\\*\\*([^*]*?)\\*\\*\\*/g, "<strong><em>$1</em></strong>")
          .replace(/\\*\\*([^*]*?)\\*\\*/g, "<strong>$1</strong>")
          .replace(/\\*([^*]+?)\\*/g, "<em>$1</em>");
      }
      function formatInline(str) {
        return applyBoldItalic(escapeHtml(str));
      }
      function parseTableRow(line) {
        const cells = line.split("|").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
        return cells.length > 0 ? cells : null;
      }
      function isTableSeparator(line) {
        return /^\\|?[\\s\\-:]+(\\|[\\s\\-:]+)*\\|?$/.test(line.trim());
      }
      function renderMarkdownBasic(md) {
        const lines = md.split(/\\r?\\n/);
        let html = "";
        let inList = false;
        let inOl = false;
        let needCloseLi = false;
        const flushList = () => {
          if (inList) { html += "</ul>"; inList = false; }
          if (needCloseLi) { html += "</li>"; needCloseLi = false; }
          if (inOl) { html += "</ol>"; inOl = false; }
        };
        for (var i = 0; i < lines.length; i++) {
          const line = lines[i].trimEnd();
          if (!line.trim()) {
            flushList();
            html += "<p></p>";
            continue;
          }
          if (/^#{1,6}\\s+/.test(line)) {
            flushList();
            const level = line.match(/^#{1,6}/)[0].length;
            const text = formatInline(line.replace(/^#{1,6}\\s+/, ""));
            html += "<h" + level + ">" + text + "</h" + level + ">";
            continue;
          }
          if (/^\\d+\\.\\s+/.test(line)) {
            const text = formatInline(line.replace(/^\\d+\\.\\s+/, ""));
            if (inList) { html += "</ul>"; inList = false; }
            if (needCloseLi) { html += "</li>"; needCloseLi = false; }
            if (!inOl) { html += "<ol>"; inOl = true; }
            html += "<li>" + text;
            needCloseLi = true;
            continue;
          }
          if (/^[-*]\\s+/.test(line)) {
            const text = formatInline(line.replace(/^[-*]\\s+/, ""));
            if (inOl && needCloseLi && !inList) {
              html += "<ul>";
              inList = true;
            } else if (!inList) {
              if (needCloseLi) { html += "</li>"; needCloseLi = false; }
              if (inOl) { html += "</ol>"; inOl = false; }
              html += "<ul>";
              inList = true;
            }
            html += "<li>" + text + "</li>";
            continue;
          }
          if (/^\\|.+\\|$/.test(line)) {
            const next = lines[i + 1];
            if (next && isTableSeparator(next)) {
              flushList();
              html += "<table>";
              var headerCells = parseTableRow(line);
              if (headerCells) {
                html += "<thead><tr>";
                for (var c = 0; c < headerCells.length; c++) {
                  html += "<th>" + formatInline(headerCells[c]) + "</th>";
                }
                html += "</tr></thead><tbody>";
              }
              i += 2;
              while (i < lines.length && /^\\|.+\\|$/.test(lines[i].trim())) {
                var rowCells = parseTableRow(lines[i]);
                if (rowCells) {
                  html += "<tr>";
                  for (var d = 0; d < rowCells.length; d++) {
                    html += "<td>" + formatInline(rowCells[d]) + "</td>";
                  }
                  html += "</tr>";
                }
                i++;
              }
              html += "</tbody></table>";
              i--;
              continue;
            }
          }
          flushList();
          html += "<p>" + formatInline(line) + "</p>";
        }
        flushList();
        return html;
      }
      document.getElementById("content").innerHTML = renderMarkdownBasic(md);
    </script>
  </body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = typeKey === "multiNoteOutline" ? "multi-note-outline.html" : `${baseName}-${suffix}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [selectedFile, multiNoteOutlineContent, setGlobalError]
  );

  const renderStatusBadge = (file) => {
    let label = "Idle";
    let cls = "badge badge-idle";
    if (file.status === "processing") {
      label = "Processing…";
      cls = "badge badge-processing";
    } else if (file.status === "done") {
      label = "Done";
      cls = "badge badge-done";
    } else if (file.status === "error") {
      label = "Error";
      cls = "badge badge-error";
    }
    return <span className={cls}>{label}</span>;
  };

  const renderApiStatusBadge = () => {
    let label = "Ready";
    let cls = "badge badge-api-ready";
    if (apiStatus === "offline") {
      label = "Offline (API calls disabled)";
      cls = "badge badge-api-offline";
    } else if (apiStatus === "error") {
      label = "API Error";
      cls = "badge badge-api-error";
    }
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-title">
          <span className="logo-dot" />
          <div>
            <div className="app-title-main">Local Notes → Study Materials</div>
            <div className="app-title-sub">Local-first psychology study assistant</div>
          </div>
        </div>
        <div className="app-header-right">
          {renderApiStatusBadge()}
          <button
            type="button"
            className="btn secondary"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="control-panel">
          <div className="control-row">
            <button
              type="button"
              className="btn primary"
              onClick={handleFolderSelect}
            >
              Select Folder
            </button>

            <label className="btn secondary file-input-label">
              Upload File
              <input
                type="file"
                multiple
                accept=".txt,.md"
                onChange={handleFileUpload}
              />
            </label>

            <button
              type="button"
              className="btn accent"
              onClick={handleProcessSelected}
              disabled={isProcessing || !selectedFile}
            >
              {isProcessing ? "Processing…" : "Process"}
            </button>
          </div>

          <div className="control-row outputs-row">
            <span className="outputs-label">Output types:</span>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={outputSelection.reviewSheet}
                onChange={(e) =>
                  setOutputSelection((prev) => ({
                    ...prev,
                    reviewSheet: e.target.checked
                  }))
                }
              />
              Review Sheet
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={outputSelection.studySheet}
                onChange={(e) =>
                  setOutputSelection((prev) => ({
                    ...prev,
                    studySheet: e.target.checked
                  }))
                }
              />
              One-Page Study Sheet
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={outputSelection.conceptMap}
                onChange={(e) =>
                  setOutputSelection((prev) => ({
                    ...prev,
                    conceptMap: e.target.checked
                  }))
                }
              />
              Text-Based Concept Map
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={outputSelection.reviewQuestions}
                onChange={(e) =>
                  setOutputSelection((prev) => ({
                    ...prev,
                    reviewQuestions: e.target.checked
                  }))
                }
              />
              Review Questions
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={outputSelection.multiNoteOutline}
                onChange={(e) =>
                  setOutputSelection((prev) => ({
                    ...prev,
                    multiNoteOutline: e.target.checked
                  }))
                }
              />
              Multi-note outline (2+ files)
            </label>
          </div>

          {globalError && (
            <div className="alert alert-error">
              {globalError}
            </div>
          )}
        </section>

        <section className="content-layout">
          <aside className="file-list-panel">
            <div className="panel-header">
              <h2>Files</h2>
              <span className="panel-meta">
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            </div>
            <div className="file-list">
              {!files.length && (
                <div className="empty-state">
                  Load a folder or upload notes to begin.
                </div>
              )}
              {files.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={
                    "file-row" +
                    (file.id === selectedFileId ? " file-row-selected" : "")
                  }
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <div className="file-row-main">
                    <div className="file-row-main-left">
                      <input
                        type="checkbox"
                        className="file-select-checkbox"
                        checked={selectedFileIds.includes(file.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleFileCheckbox(file.id);
                        }}
                      />
                      <span className="file-name">{file.name}</span>
                    </div>
                    {renderStatusBadge(file)}
                  </div>
                  {file.error && (
                    <div className="file-error">{file.error}</div>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <section className="preview-panel">
            <div className="panel-header preview-header">
              <h2>Preview</h2>
              <div className="download-buttons">
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("reviewSheet")}
                  disabled={!selectedFile || !selectedFile.outputs.reviewSheet}
                >
                  Review Sheet (web page)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("studySheet")}
                  disabled={!selectedFile || !selectedFile.outputs.studySheet}
                >
                  Study Sheet (web page)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("conceptMap")}
                  disabled={!selectedFile || !selectedFile.outputs.conceptMap}
                >
                  Concept Map (web page)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("reviewQuestions")}
                  disabled={!selectedFile || !selectedFile.outputs.reviewQuestions}
                >
                  Review Questions (web page)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("multiNoteOutline")}
                  disabled={!multiNoteOutlineContent}
                >
                  Multi-note outline (web page)
                </button>
              </div>
            </div>

            {!selectedFile && !multiNoteOutlineContent ? (
              <div className="empty-state large">
                Select a file to view generated study materials.
              </div>
            ) : (
              <PreviewTabs
                file={selectedFile}
                multiNoteOutlineContent={multiNoteOutlineContent}
              />
            )}
          </section>
        </section>
      </main>

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function PreviewTabs({ file, multiNoteOutlineContent }) {
  const hasMultiNote = Boolean(multiNoteOutlineContent);
  const [activeTab, setActiveTab] = useState(hasMultiNote ? "multiNote" : "review");

  const tabContent = useMemo(() => {
    if (activeTab === "multiNote") return multiNoteOutlineContent || "";
    if (!file) return "";
    if (activeTab === "review") return file.outputs?.reviewSheet ?? "";
    if (activeTab === "study") return file.outputs?.studySheet ?? "";
    if (activeTab === "concept") return file.outputs?.conceptMap ?? "";
    if (activeTab === "questions") return file.outputs?.reviewQuestions ?? "";
    return "";
  }, [activeTab, file, multiNoteOutlineContent]);

  const tabIsEmpty = !tabContent;

  return (
    <div className="tabs-root">
      <div className="tabs-header">
        <button
          type="button"
          className={"tab" + (activeTab === "review" ? " tab-active" : "")}
          onClick={() => setActiveTab("review")}
        >
          Review Sheet
        </button>
        <button
          type="button"
          className={"tab" + (activeTab === "study" ? " tab-active" : "")}
          onClick={() => setActiveTab("study")}
        >
          Study Sheet
        </button>
        <button
          type="button"
          className={"tab" + (activeTab === "concept" ? " tab-active" : "")}
          onClick={() => setActiveTab("concept")}
        >
          Concept Map
        </button>
        <button
          type="button"
          className={"tab" + (activeTab === "questions" ? " tab-active" : "")}
          onClick={() => setActiveTab("questions")}
        >
          Review Questions
        </button>
        {hasMultiNote && (
          <button
            type="button"
            className={"tab" + (activeTab === "multiNote" ? " tab-active" : "")}
            onClick={() => setActiveTab("multiNote")}
          >
            Multi-note outline
          </button>
        )}
      </div>

      <div className="tabs-body markdown-body">
        {tabIsEmpty ? (
          <div className="empty-state">
            {activeTab === "multiNote"
              ? "Select 2+ files, check Multi-note outline, and click Process."
              : "Nothing generated yet for this view. Run "}
            {activeTab !== "multiNote" && (
              <>
                <span className="mono">Process</span> with this output type selected.
              </>
            )}
          </div>
        ) : (
          <ReactMarkdown>{tabContent}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="settings-text">
            This app is local-first:
          </p>
          <ul className="settings-list">
            <li>Source files never leave your device.</li>
            <li>Only extracted text is sent to DeepSeek when you explicitly run processing.</li>
            <li>No automatic uploads or background processing.</li>
            <li>Works offline except for API calls.</li>
          </ul>
          <p className="settings-text">
            To configure the DeepSeek API key, open{" "}
            <span className="mono">src/deepseekClient.js</span>, set{" "}
            <span className="mono">DEEPSEEK_API_KEY</span> at the top, then rebuild or restart the dev server.
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

