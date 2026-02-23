import React, { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
import { generateWithDeepSeek } from "./deepseekClient.js";
import {
  REVIEW_SHEET_PROMPT,
  STUDY_SHEET_PROMPT,
  CONCEPT_MAP_PROMPT,
  buildUserMessageWithNotes
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
  conceptMap: ""
};

export default function App() {
  const [files, setFiles] = useState([]);
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [outputSelection, setOutputSelection] = useState({
    reviewSheet: false,
    studySheet: false,
    conceptMap: false
  });
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

      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);

      const newFiles = [];
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

  const rescanFiles = useCallback(async () => {
    setGlobalError("");

    if (!directoryHandle && files.length === 0) {
      setGlobalError("Nothing to rescan yet. Load files first.");
      return;
    }

    try {
      const updated = [];

      if (directoryHandle) {
        for await (const [name, entry] of directoryHandle.entries()) {
          if (entry.kind === "file" && isSupportedFile(name)) {
            const file = await entry.getFile();
            const existing = files.find(
              (f) => f.source === "folder" && f.name === name
            );

            updated.push(
              existing
                ? {
                    ...existing,
                    fileObject: file,
                    status: "idle",
                    error: ""
                  }
                : {
                    id: `${entry.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
                    name,
                    source: "folder",
                    handle: entry,
                    fileObject: file,
                    status: "idle",
                    error: "",
                    text: "",
                    outputs: { ...initialOutputs }
                  }
            );
          }
        }
      }

      const uploaded = files.filter((f) => f.source === "upload");
      const combined = [...uploaded, ...updated];
      setFiles(combined);
      const stillSelected = combined.find((f) => f.id === selectedFileId);
      if (!stillSelected) {
        const first = combined[0]?.id || null;
        setSelectedFileId(first);
        setSelectedFileIds(first ? [first] : []);
      }
    } catch (err) {
      setGlobalError(err?.message || "Failed to rescan files.");
    }
  }, [directoryHandle, files, selectedFileId]);

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
        selection.reviewSheet || selection.studySheet || selection.conceptMap;
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
      outputSelection.conceptMap;
    if (!selectedAny) {
      setGlobalError("Please select at least one output type.");
      return;
    }

    const targetIds =
      selectedFileIds && selectedFileIds.length
        ? selectedFileIds
        : [selectedFile.id];

    setIsProcessing(true);

    try {
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
    } finally {
      setIsProcessing(false);
    }
  }, [files, outputSelection, processOutputsForFile, selectedFile, selectedFileIds, updateFileStatus]);

  const handleDownload = useCallback(
    (typeKey) => {
      if (!selectedFile) return;
      const content = selectedFile.outputs[typeKey];
      if (!content) {
        setGlobalError("Nothing to download for this output type yet.");
        return;
      }
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix =
        typeKey === "reviewSheet"
          ? "review"
          : typeKey === "studySheet"
          ? "study"
          : "concept-map";
      a.href = url;
      a.download = `${selectedFile.name.replace(/\.[^.]+$/, "")}-${suffix}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [selectedFile]
  );

  const handleDownloadPdf = useCallback(
    (typeKey) => {
      if (!selectedFile) return;
      const content = selectedFile.outputs[typeKey];
      if (!content) {
        setGlobalError("Nothing to download for this output type yet.");
        return;
      }

      const suffix =
        typeKey === "reviewSheet"
          ? "review"
          : typeKey === "studySheet"
          ? "study"
          : "concept-map";

      const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
      const title = `${baseName} – ${suffix.replace("-", " ")}`;

      const doc = new jsPDF({
        unit: "pt",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const marginTop = 60;
      const marginBottom = 60;

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, marginX, marginTop);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);

      const availableWidth = pageWidth - marginX * 2;
      const wrappedLines = doc.splitTextToSize(content, availableWidth);

      let cursorY = marginTop + 24;

      wrappedLines.forEach((line) => {
        if (cursorY > pageHeight - marginBottom) {
          doc.addPage();
          cursorY = marginTop;
        }
        doc.text(line, marginX, cursorY);
        cursorY += 14;
      });

      doc.save(`${baseName}-${suffix}.pdf`);
    },
    [selectedFile, setGlobalError]
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
              className="btn secondary"
              onClick={rescanFiles}
            >
              Rescan
            </button>

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
                  onClick={() => handleDownload("reviewSheet")}
                  disabled={!selectedFile || !selectedFile.outputs.reviewSheet}
                >
                  Download Review Sheet (.md)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadPdf("reviewSheet")}
                  disabled={!selectedFile || !selectedFile.outputs.reviewSheet}
                >
                  Review Sheet (.pdf)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownload("studySheet")}
                  disabled={!selectedFile || !selectedFile.outputs.studySheet}
                >
                  Download Study Sheet (.md)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadPdf("studySheet")}
                  disabled={!selectedFile || !selectedFile.outputs.studySheet}
                >
                  Study Sheet (.pdf)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownload("conceptMap")}
                  disabled={!selectedFile || !selectedFile.outputs.conceptMap}
                >
                  Download Concept Map (.md)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadPdf("conceptMap")}
                  disabled={!selectedFile || !selectedFile.outputs.conceptMap}
                >
                  Concept Map (.pdf)
                </button>
              </div>
            </div>

            {!selectedFile ? (
              <div className="empty-state large">
                Select a file to view generated study materials.
              </div>
            ) : (
              <PreviewTabs file={selectedFile} />
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

function PreviewTabs({ file }) {
  const [activeTab, setActiveTab] = useState("review");

  const tabContent = useMemo(() => {
    if (activeTab === "review") return file.outputs.reviewSheet;
    if (activeTab === "study") return file.outputs.studySheet;
    return file.outputs.conceptMap;
  }, [activeTab, file.outputs]);

  const tabIsEmpty = !tabContent;

  return (
    <div className="tabs-root">
      <div className="tabs-header">
        <button
          type="button"
          className={
            "tab" + (activeTab === "review" ? " tab-active" : "")
          }
          onClick={() => setActiveTab("review")}
        >
          Review Sheet
        </button>
        <button
          type="button"
          className={
            "tab" + (activeTab === "study" ? " tab-active" : "")
          }
          onClick={() => setActiveTab("study")}
        >
          Study Sheet
        </button>
        <button
          type="button"
          className={
            "tab" + (activeTab === "concept" ? " tab-active" : "")
          }
          onClick={() => setActiveTab("concept")}
        >
          Concept Map
        </button>
      </div>

      <div className="tabs-body markdown-body">
        {tabIsEmpty ? (
          <div className="empty-state">
            Nothing generated yet for this view. Run{" "}
            <span className="mono">Process</span> with this output type selected.
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

