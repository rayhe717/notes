import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateWithDeepSeek } from "./deepseekClient.js";
import {
  REVIEW_SHEET_PROMPT,
  CONCEPT_MAP_PROMPT,
  MULTI_NOTE_OUTLINE_PROMPT,
  REVIEW_QUESTIONS_QUIZ_PROMPT,
  REVIEW_QUESTIONS_QUIZ_PROMPT_TWO_CORRECT,
  REVIEW_QUESTIONS_REGENERATE_PROMPT,
  REVIEW_QUESTIONS_REGENERATE_PROMPT_TWO_CORRECT,
  REVIEW_QUESTIONS_FEEDBACK_PROMPT,
  CLOZE_SHEET_PROMPT,
  CLOZE_FEEDBACK_PROMPT,
  buildUserMessageWithNotes,
  buildUserMessageWithMultipleNotes,
  buildQuizFeedbackUserMessage,
  buildClozeFeedbackUserMessage,
  buildRegenerateContextMessage
} from "./prompts.js";

function normalizeCorrectIndices(q) {
  if (Array.isArray(q.correctIndices) && q.correctIndices.length >= 1) {
    const indices = q.correctIndices
      .map((n) => Math.min(3, Math.max(0, parseInt(n, 10) || 0)))
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .sort((a, b) => a - b)
      .slice(0, 2);
    return indices.length >= 1 ? indices : [0];
  }
  const single = Math.min(3, Math.max(0, parseInt(q.correctIndex, 10) || 0));
  return [single];
}

function parseQuizJson(raw) {
  let str = String(raw).trim();
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) str = codeBlock[1].trim();
  const data = JSON.parse(str);
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list) || list.length === 0) return null;
  const questions = list.slice(0, 10).map((q) => ({
    question: q.question || "",
    options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
    correctIndices: normalizeCorrectIndices(q)
  })).filter((q) => q.question && q.options.length >= 2);
  return questions.length >= 1 ? questions : null;
}

const CLOZE_BLANK = "_____";

function parseClozeJson(raw) {
  let str = String(raw).trim();
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) str = codeBlock[1].trim();
  const data = JSON.parse(str);
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const normalized = [];
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    const heading = typeof sec.heading === "string" ? sec.heading : `Section ${s + 1}`;
    const items = Array.isArray(sec.items) ? sec.items : [];
    const sectionItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const text = typeof it.text === "string" ? it.text : "";
      const answer = typeof it.answer === "string" ? it.answer.trim() : "";
      if (!text.includes(CLOZE_BLANK) || !answer) continue;
      const alternatives = Array.isArray(it.alternatives)
        ? it.alternatives.map((a) => String(a).trim()).filter(Boolean)
        : [];
      sectionItems.push({ text, answer, alternatives });
    }
    if (sectionItems.length > 0) {
      normalized.push({ heading, items: sectionItems });
    }
  }
  return normalized.length >= 1 ? normalized : null;
}

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

function getDisplayNamesForFiles(fileList) {
  const byName = {};
  fileList.forEach((f) => {
    if (!byName[f.name]) byName[f.name] = [];
    byName[f.name].push(f.id);
  });
  const displayNames = {};
  fileList.forEach((f) => {
    const ids = byName[f.name];
    const idx = ids.indexOf(f.id);
    if (idx === 0) {
      displayNames[f.id] = f.name;
    } else {
      const lastDot = f.name.lastIndexOf(".");
      const base = lastDot > 0 ? f.name.slice(0, lastDot) : f.name;
      const ext = lastDot > 0 ? f.name.slice(lastDot) : "";
      displayNames[f.id] = `${base} (${idx})${ext}`;
    }
  });
  return displayNames;
}

const initialOutputs = {
  reviewSheet: "",
  conceptMap: "",
  reviewQuestionsQuiz: null,
  clozeSheet: null
};

const SESSION_STORAGE_KEY = "cursor-notes-state";

let initialSessionCache = null;
function getInitialSessionState() {
  if (initialSessionCache !== null) return initialSessionCache;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    initialSessionCache = raw ? JSON.parse(raw) : null;
  } catch {
    initialSessionCache = null;
  }
  return initialSessionCache;
}

function fileToStorable(f) {
  const { fileObject, handle, ...rest } = f;
  return rest;
}

export default function App() {
  const [files, setFiles] = useState(() => {
    const s = getInitialSessionState();
    return s && Array.isArray(s.files) ? s.files : [];
  });
  const filesRef = useRef(files);
  filesRef.current = files;
  const [selectedFileId, setSelectedFileId] = useState(() => {
    const s = getInitialSessionState();
    return s && s.selectedFileId != null ? s.selectedFileId : null;
  });
  const [selectedFileIds, setSelectedFileIds] = useState(() => {
    const s = getInitialSessionState();
    return s && Array.isArray(s.selectedFileIds) ? s.selectedFileIds : [];
  });
  const [outputSelection, setOutputSelection] = useState({
    reviewSheet: false,
    conceptMap: false,
    reviewQuestions: false,
    includeTwoCorrectQuestions: false,
    clozeSheet: false,
    multiNoteOutline: false
  });
  const [multiNoteOutlineContent, setMultiNoteOutlineContent] = useState(() => {
    const s = getInitialSessionState();
    return s && typeof s.multiNoteOutlineContent === "string" ? s.multiNoteOutlineContent : "";
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false);
  const [clozeExplainLoading, setClozeExplainLoading] = useState(null);
  const [globalError, setGlobalError] = useState("");
  const [apiError, setApiError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apiStatus = useMemo(
    () => getApiStatus(apiError, true),
    [apiError]
  );

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [files]
  );

  const fileDisplayNames = useMemo(
    () => getDisplayNamesForFiles(sortedFiles),
    [sortedFiles]
  );

  useEffect(() => {
    try {
      const state = {
        files: files.map(fileToStorable),
        multiNoteOutlineContent,
        selectedFileId,
        selectedFileIds
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // sessionStorage full or unavailable; ignore
    }
  }, [files, multiNoteOutlineContent, selectedFileId, selectedFileIds]);

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
          let text = "";
          try {
            text = await readTextFile(file);
          } catch (_) {
            // keep text empty on read error
          }
          newFiles.push({
            id: `${entry.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
            name,
            source: "folder",
            handle: entry,
            fileObject: file,
            status: "idle",
            error: "",
            text: text || "",
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
      let text = "";
      try {
        text = await readTextFile(file);
      } catch (_) {
        // keep text empty on read error
      }
      newFiles.push({
        id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        source: "upload",
        handle: null,
        fileObject: file,
        status: "idle",
        error: "",
        text: text || "",
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

  const updateFileStatus = useCallback((id, patch) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  }, []);

  const processOutputsForFile = useCallback(
    async (fileId, selection) => {
      const selectedAny =
        selection.reviewSheet ||
        selection.conceptMap ||
        selection.reviewQuestions ||
        selection.clozeSheet;
      if (!selectedAny) {
        throw new Error("Please select at least one output type.");
      }

      // Always look up the latest file from the ref to avoid stale closures
      const latestFile = filesRef.current.find((f) => f.id === fileId);
      if (!latestFile) throw new Error("File not found.");

      let text;
      if (latestFile.fileObject) {
        text = await readTextFile(latestFile.fileObject);
      } else if (latestFile.text) {
        text = latestFile.text;
      } else {
        throw new Error("File content is not available.");
      }
      if (!text.trim()) {
        throw new Error("File is empty.");
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, text } : f
        )
      );

      const freshFile = filesRef.current.find((f) => f.id === fileId);
      const newOutputs = { ...(freshFile || latestFile).outputs };

      const userMessage = buildUserMessageWithNotes(text);

      if (selection.reviewSheet) {
        const content = await generateWithDeepSeek(
          REVIEW_SHEET_PROMPT,
          userMessage
        );
        newOutputs.reviewSheet = content;
      }

      if (selection.conceptMap) {
        const content = await generateWithDeepSeek(
          CONCEPT_MAP_PROMPT,
          userMessage
        );
        newOutputs.conceptMap = content;
      }

      if (selection.reviewQuestions) {
        const quizPrompt = selection.includeTwoCorrectQuestions
          ? REVIEW_QUESTIONS_QUIZ_PROMPT_TWO_CORRECT
          : REVIEW_QUESTIONS_QUIZ_PROMPT;
        const content = await generateWithDeepSeek(quizPrompt, userMessage);
        const questions = parseQuizJson(content);
        newOutputs.reviewQuestionsQuiz = questions ? { questions } : { raw: content };
      }

      if (selection.clozeSheet) {
        const content = await generateWithDeepSeek(CLOZE_SHEET_PROMPT, userMessage);
        const sections = parseClozeJson(content);
        newOutputs.clozeSheet = sections ? { sections } : { raw: content };
      }

      updateFileStatus(fileId, {
        outputs: newOutputs
      });
    },
    [updateFileStatus]
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

  const handleDeleteSelected = useCallback(() => {
    const toRemove = new Set(
      selectedFileIds.length > 0 ? selectedFileIds : selectedFileId ? [selectedFileId] : []
    );
    if (toRemove.size === 0) return;
    const nextFiles = files.filter((f) => !toRemove.has(f.id));
    const newSelectedId =
      selectedFileId && nextFiles.some((f) => f.id === selectedFileId)
        ? selectedFileId
        : nextFiles[0]?.id ?? null;
    setFiles(nextFiles);
    setSelectedFileId(newSelectedId);
    setSelectedFileIds(newSelectedId ? [newSelectedId] : []);
    setGlobalError("");
  }, [files, selectedFileId, selectedFileIds]);

  const handleRefresh = useCallback(() => {
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        outputs: { ...initialOutputs },
        quizUserAnswers: undefined,
        quizFeedback: undefined,
        clozeUserInputs: undefined,
        clozeExplanations: undefined,
        clozeSubmittedBlanks: undefined,
        status: "idle",
        error: ""
      }))
    );
    setMultiNoteOutlineContent("");
    setOutputSelection({
      reviewSheet: false,
      conceptMap: false,
      reviewQuestions: false,
      includeTwoCorrectQuestions: false,
      clozeSheet: false,
      multiNoteOutline: false
    });
    const current = filesRef.current;
    const firstId = current[0]?.id ?? null;
    setSelectedFileId(firstId);
    setSelectedFileIds(firstId ? [firstId] : []);
    setGlobalError("");
  }, []);

  const handleProcessSelected = useCallback(async () => {
    setGlobalError("");
    setApiError("");

    const currentFiles = filesRef.current;
    const currentSelectedFile = currentFiles.find((f) => f.id === selectedFileId);
    if (!currentSelectedFile) {
      setGlobalError("No file selected. Please choose a file from the list first.");
      return;
    }

    const selectedAny =
      outputSelection.reviewSheet ||
      outputSelection.conceptMap ||
      outputSelection.reviewQuestions ||
      outputSelection.clozeSheet ||
      outputSelection.multiNoteOutline;
    if (!selectedAny) {
      setGlobalError("Please select at least one output type.");
      return;
    }

    const targetIds =
      selectedFileIds && selectedFileIds.length
        ? [...selectedFileIds]
        : [currentSelectedFile.id];

    if (outputSelection.multiNoteOutline && targetIds.length < 2) {
      setGlobalError("Multi-note outline requires at least 2 files. Check two or more files in the list.");
      return;
    }

    setIsProcessing(true);
    setMultiNoteOutlineContent((prev) => (outputSelection.multiNoteOutline && targetIds.length >= 2 ? "" : prev));

    try {
      if (
        outputSelection.reviewSheet ||
        outputSelection.conceptMap ||
        outputSelection.reviewQuestions ||
        outputSelection.clozeSheet
      ) {
        for (const id of targetIds) {
          const file = filesRef.current.find((f) => f.id === id);
          if (!file) continue;

          updateFileStatus(id, { status: "processing", error: "" });
          try {
            await processOutputsForFile(id, outputSelection);
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
            const file = filesRef.current.find((f) => f.id === id);
            if (!file) continue;
            let text;
            if (file.fileObject) {
              text = await readTextFile(file.fileObject);
            } else {
              text = file.text || "";
            }
            if (text.trim()) entries.push({ name: file.name, text });
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
  }, [selectedFileId, selectedFileIds, outputSelection, processOutputsForFile, updateFileStatus]);

  const handleQuizAnswer = useCallback((fileId, questionIndex, optionIndex, multiSelect) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const current = f.quizUserAnswers || Array(10).fill(null);
        const next = [...current];
        if (multiSelect) {
          const existing = Array.isArray(current[questionIndex])
            ? current[questionIndex]
            : current[questionIndex] != null
            ? [current[questionIndex]]
            : [];
          const set = new Set(existing);
          if (set.has(optionIndex)) set.delete(optionIndex);
          else set.add(optionIndex);
          next[questionIndex] = [...set].sort((a, b) => a - b);
        } else {
          next[questionIndex] = optionIndex;
        }
        return { ...f, quizUserAnswers: next };
      })
    );
  }, []);

  const handleSubmitQuiz = useCallback(
    async (fileId) => {
      const file = filesRef.current.find((f) => f.id === fileId);
      if (!file?.outputs?.reviewQuestionsQuiz?.questions) return;
      const questions = file.outputs.reviewQuestionsQuiz.questions;
      const userAnswers = file.quizUserAnswers || [];
      const anyAnswered = userAnswers.some((a, i) => {
        if (i >= questions.length) return false;
        if (a == null) return false;
        return Array.isArray(a) ? a.length > 0 : true;
      });
      if (!anyAnswered) {
        updateFileStatus(fileId, {
          quizFeedback: "Select your answers above, then click Submit to get feedback on wrong ones."
        });
        return;
      }
      const wrongEntries = [];
      const labels = ["A", "B", "C", "D"];
      const formatOptions = (opts, indices) =>
        (Array.isArray(indices) ? indices : [indices])
          .map((idx) => `${labels[idx]}) ${(opts[idx] || "").trim()}`)
          .join("; ");
      const formatLetters = (indices) =>
        (Array.isArray(indices) ? indices : [indices])
          .map((idx) => labels[idx])
          .join(" and ");
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const chosen = userAnswers[i];
        if (chosen == null) continue;
        const userIndices = Array.isArray(chosen) ? chosen : [chosen];
        const correctIndices = q.correctIndices ?? (q.correctIndex != null ? [q.correctIndex] : []);
        const match =
          userIndices.length === correctIndices.length &&
          userIndices.every((idx) => correctIndices.includes(idx));
        if (!match) {
          const optionTexts = (q.options || [])
            .map((opt, idx) => `${labels[idx]}) ${(opt || "").trim()}`)
            .filter((line) => line.length > 2)
            .join("\n");
          wrongEntries.push({
            questionNumber: i + 1,
            question: q.question,
            correctLetters: formatLetters(correctIndices),
            userLetters: formatLetters(userIndices),
            correctText: formatOptions(q.options, correctIndices),
            userText: formatOptions(q.options, userIndices),
            optionTexts
          });
        }
      }
      setIsSubmittingQuiz(true);
      setGlobalError("");
      setApiError("");
      try {
        const feedback =
          wrongEntries.length === 0
            ? "All correct! Well done."
            : await generateWithDeepSeek(
                REVIEW_QUESTIONS_FEEDBACK_PROMPT,
                buildQuizFeedbackUserMessage(wrongEntries)
              );
        updateFileStatus(fileId, { quizFeedback: feedback });
      } catch (err) {
        const message = err?.message || "Failed to get feedback.";
        setGlobalError(message);
        if (message.toLowerCase().includes("deepseek")) setApiError(message);
      } finally {
        setIsSubmittingQuiz(false);
      }
    },
    [updateFileStatus]
  );

  const handleRegenerateQuiz = useCallback(
    async (fileId) => {
      const file = filesRef.current.find((f) => f.id === fileId);
      if (!file) return;
      let text;
      if (file.fileObject) {
        text = await readTextFile(file.fileObject);
      } else {
        text = file.text || "";
      }
      if (!text.trim()) {
        setGlobalError("File content is not available.");
        return;
      }
      const previousQuestions = file.outputs?.reviewQuestionsQuiz?.questions;
      const previousAnswers = file.quizUserAnswers;
      const contextMessage =
        Array.isArray(previousQuestions) &&
        previousQuestions.length > 0 &&
        previousAnswers != null
          ? buildRegenerateContextMessage(previousQuestions, previousAnswers)
          : "";
      const userMessage =
        contextMessage.trim() === ""
          ? buildUserMessageWithNotes(text)
          : buildUserMessageWithNotes(text) +
            "\n\n--- REGENERATION CONTEXT ---\n" +
            contextMessage;

      setIsRegeneratingQuiz(true);
      setGlobalError("");
      setApiError("");
      const currentFile = filesRef.current.find((f) => f.id === fileId);
      updateFileStatus(fileId, {
        status: "processing",
        error: "",
        outputs: { ...(currentFile || file).outputs, reviewQuestionsQuiz: null },
        quizUserAnswers: undefined,
        quizFeedback: undefined
      });
      const regenPrompt = outputSelection.includeTwoCorrectQuestions
        ? REVIEW_QUESTIONS_REGENERATE_PROMPT_TWO_CORRECT
        : REVIEW_QUESTIONS_REGENERATE_PROMPT;
      try {
        const content = await generateWithDeepSeek(
          regenPrompt,
          userMessage
        );
        const questions = parseQuizJson(content);
        if (questions) {
          const latest = filesRef.current.find((f) => f.id === fileId);
          updateFileStatus(fileId, {
            status: "done",
            outputs: { ...(latest || file).outputs, reviewQuestionsQuiz: { questions } }
          });
        } else {
          setGlobalError("Could not parse new questions. Try again.");
          updateFileStatus(fileId, { status: "done" });
        }
      } catch (err) {
        const message = err?.message || "Failed to regenerate quiz.";
        setGlobalError(message);
        if (message.toLowerCase().includes("deepseek")) setApiError(message);
        updateFileStatus(fileId, { status: "error", error: message });
      } finally {
        setIsRegeneratingQuiz(false);
      }
    },
    [outputSelection.includeTwoCorrectQuestions, updateFileStatus]
  );

  const getClozeFlatItems = useCallback((sections) => {
    if (!Array.isArray(sections)) return [];
    const flat = [];
    sections.forEach((sec) => {
      (sec.items || []).forEach((it) => flat.push(it));
    });
    return flat;
  }, []);

  const handleClozeInput = useCallback((fileId, blankIndex, value) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const sections = f.outputs?.clozeSheet?.sections;
        const flat = getClozeFlatItems(sections);
        const len = flat.length;
        if (blankIndex < 0 || blankIndex >= len) return f;
        const current = Array.isArray(f.clozeUserInputs) ? f.clozeUserInputs : [];
        const arr = current.length >= len ? [...current] : [...current, ...Array(len - current.length).fill(null)];
        const next = [...arr];
        next[blankIndex] = value;
        return { ...f, clozeUserInputs: next };
      })
    );
  }, [getClozeFlatItems]);

  const handleClozeSubmitBlank = useCallback((fileId, blankIndex) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const current = Array.isArray(f.clozeSubmittedBlanks) ? f.clozeSubmittedBlanks : [];
        if (current.includes(blankIndex)) return f;
        return { ...f, clozeSubmittedBlanks: [...current, blankIndex] };
      })
    );
  }, []);

  const handleClozeExplain = useCallback(
    async (fileId, blankIndex) => {
      const file = filesRef.current.find((f) => f.id === fileId);
      const sections = file?.outputs?.clozeSheet?.sections;
      const flat = getClozeFlatItems(sections);
      const item = flat[blankIndex];
      const userInput = (file?.clozeUserInputs || [])[blankIndex];
      if (!item || userInput == null || String(userInput).trim() === "") return;
      const key = `${fileId}-${blankIndex}`;
      setClozeExplainLoading(key);
      try {
        const userMessage = buildClozeFeedbackUserMessage(
          item.text,
          item.answer,
          String(userInput).trim()
        );
        const explanation = await generateWithDeepSeek(CLOZE_FEEDBACK_PROMPT, userMessage);
        updateFileStatus(fileId, {
          clozeExplanations: {
            ...(file?.clozeExplanations || {}),
            [blankIndex]: explanation.trim()
          }
        });
      } catch (err) {
        const message = err?.message || "Failed to get explanation.";
        updateFileStatus(fileId, {
          clozeExplanations: {
            ...(file?.clozeExplanations || {}),
            [blankIndex]: `Error: ${message}`
          }
        });
        if (message.toLowerCase().includes("deepseek")) setApiError(message);
      } finally {
        setClozeExplainLoading(null);
      }
    },
    [getClozeFlatItems, updateFileStatus]
  );

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
            : typeKey === "clozeSheet"
            ? "fill-in-the-blank"
            : "concept-map";
        baseName = selectedFile.name.replace(/\.[^.]+$/, "");
        title = `${baseName} – ${suffix.replace(/-/g, " ")}`;
      }

      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      if (typeKey === "clozeSheet") {
        if (!content?.sections) {
          setGlobalError("No fill-in-the-blank sheet to download (generate one first).");
          return;
        }
        const clozeParts = [];
        content.sections.forEach((sec) => {
          clozeParts.push(`<h3 class="cloze-heading">${escapeHtml(sec.heading)}</h3><ul class="cloze-list">`);
          (sec.items || []).forEach((it) => {
            const safe = escapeHtml(it.text);
            clozeParts.push(`<li class="cloze-item">${safe}</li>`);
          });
          clozeParts.push("</ul>");
        });
        const clozeBody = clozeParts.join("");
        const clozeHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width:device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui,sans-serif; max-width: 900px; margin: 2rem auto; padding: 1rem; }
      .cloze-heading { font-size: 1.1rem; margin: 1rem 0 0.5rem; }
      .cloze-list { list-style: none; padding: 0; }
      .cloze-item { margin-bottom: 0.75rem; line-height: 1.6; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <div class="cloze-root">${clozeBody}</div>
  </body>
</html>`;
        const blob = new Blob([clozeHtml], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}-${suffix}.html`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (typeof content !== "string") {
        setGlobalError("Nothing to download for this output type yet.");
        return;
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
            <button
              type="button"
              className="btn secondary"
              onClick={handleRefresh}
              disabled={isProcessing || !files.length}
              title="Clear all generated material and reset selection to first file"
            >
              Refresh
            </button>
          </div>

          <div className="outputs-section">
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
                  checked={outputSelection.conceptMap}
                  onChange={(e) =>
                    setOutputSelection((prev) => ({
                      ...prev,
                      conceptMap: e.target.checked
                    }))
                  }
                />
                Concept Map
              </label>
              <span className="checkbox-group-inline">
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
                {outputSelection.reviewQuestions && (
                  <span className="sub-option-inline">
                    <label className="checkbox-label sub-checkbox">
                      <input
                        type="checkbox"
                        checked={outputSelection.includeTwoCorrectQuestions}
                        onChange={(e) =>
                          setOutputSelection((prev) => ({
                            ...prev,
                            includeTwoCorrectQuestions: e.target.checked
                          }))
                        }
                      />
                      incl. two-correct
                    </label>
                  </span>
                )}
              </span>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={outputSelection.clozeSheet}
                  onChange={(e) =>
                    setOutputSelection((prev) => ({
                      ...prev,
                      clozeSheet: e.target.checked
                    }))
                  }
                />
                Fill-in-the-blank
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
          </div>

          {globalError && (
            <div className="alert alert-error">
              {globalError}
            </div>
          )}
        </section>

        <section className="content-layout">
          <aside className="file-list-panel">
            <div className="panel-header panel-header-with-actions">
              <div className="panel-title-row">
                <h2>Files</h2>
                <span className="panel-meta">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              </div>
              <button
                type="button"
                className="btn tiny btn-remove"
                onClick={handleDeleteSelected}
                disabled={
                  !files.length ||
                  (selectedFileIds.length === 0 && !selectedFileId)
                }
                title="Remove selected file(s) from the list"
              >
                Delete selected
              </button>
            </div>
            <div className="file-list">
              {!files.length && (
                <div className="empty-state">
                  Load a folder or upload notes to begin.
                </div>
              )}
              {sortedFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={
                    "file-row" +
                    (file.id === selectedFileId ? " file-row-selected" : "")
                  }
                  onClick={() => {
                    setSelectedFileId(file.id);
                    setSelectedFileIds([file.id]);
                  }}
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
                      <span className="file-name">
                        {fileDisplayNames[file.id] ?? file.name}
                      </span>
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
                  onClick={() => handleDownloadHtml("conceptMap")}
                  disabled={!selectedFile || !selectedFile.outputs.conceptMap}
                >
                  Concept Map (web page)
                </button>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => handleDownloadHtml("clozeSheet")}
                  disabled={!selectedFile || !selectedFile.outputs.clozeSheet?.sections}
                >
                  Fill-in-the-blank (web page)
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
                key={selectedFile?.id ?? "none"}
                file={selectedFile}
                multiNoteOutlineContent={multiNoteOutlineContent}
                onQuizAnswer={handleQuizAnswer}
                onSubmitQuiz={handleSubmitQuiz}
                onRegenerateQuiz={handleRegenerateQuiz}
                isSubmittingQuiz={isSubmittingQuiz}
                isRegeneratingQuiz={isRegeneratingQuiz}
                onClozeInput={handleClozeInput}
                onClozeSubmitBlank={handleClozeSubmitBlank}
                onClozeExplain={handleClozeExplain}
                clozeExplainLoading={clozeExplainLoading}
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

function PreviewTabs({
  file,
  multiNoteOutlineContent,
  onQuizAnswer,
  onSubmitQuiz,
  onRegenerateQuiz,
  isSubmittingQuiz,
  isRegeneratingQuiz,
  onClozeInput,
  onClozeSubmitBlank,
  onClozeExplain,
  clozeExplainLoading
}) {
  const hasMultiNote = Boolean(multiNoteOutlineContent);
  const [activeTab, setActiveTab] = useState(hasMultiNote ? "multiNote" : "review");

  const quizData = file?.outputs?.reviewQuestionsQuiz;
  const quizQuestions = quizData?.questions;
  const quizParseFailed = quizData?.raw != null && !quizQuestions;

  const clozeData = file?.outputs?.clozeSheet;
  const clozeSections = clozeData?.sections;
  const clozeParseFailed = clozeData?.raw != null && !clozeSections;
  const showCloze = activeTab === "cloze" && Array.isArray(clozeSections) && clozeSections.length > 0;

  const tabContent = useMemo(() => {
    if (activeTab === "multiNote") return multiNoteOutlineContent || "";
    if (!file) return "";
    if (activeTab === "review") return file.outputs?.reviewSheet ?? "";
    if (activeTab === "concept") return file.outputs?.conceptMap ?? "";
    return "";
  }, [activeTab, file, multiNoteOutlineContent]);

  const isQuizTab = activeTab === "questions";
  const isClozeTab = activeTab === "cloze";
  const showQuiz = isQuizTab && Array.isArray(quizQuestions) && quizQuestions.length > 0;
  const tabIsEmpty = isQuizTab
    ? !showQuiz && !quizParseFailed
    : isClozeTab
    ? !showCloze && !clozeParseFailed
    : !tabContent;

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
        <button
          type="button"
          className={"tab" + (activeTab === "cloze" ? " tab-active" : "")}
          onClick={() => setActiveTab("cloze")}
        >
          Fill-in-the-blank
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
        {isQuizTab && isRegeneratingQuiz && !showQuiz ? (
          <div className="quiz-empty">
            <p className="empty-state">Regenerating review questions…</p>
          </div>
        ) : showQuiz ? (
          <Quiz
            fileId={file.id}
            questions={quizQuestions}
            userAnswers={file.quizUserAnswers || []}
            feedback={file.quizFeedback}
            onSelectAnswer={onQuizAnswer}
            onSubmit={onSubmitQuiz}
            onRegenerate={onRegenerateQuiz}
            isSubmitting={isSubmittingQuiz}
            isRegenerating={isRegeneratingQuiz}
          />
        ) : showCloze ? (
          <ClozeSheet
            fileId={file.id}
            sections={clozeSections}
            userInputs={file.clozeUserInputs || []}
            submittedBlanks={file.clozeSubmittedBlanks || []}
            explanations={file.clozeExplanations || {}}
            onInput={onClozeInput}
            onSubmitBlank={onClozeSubmitBlank}
            onRequestExplain={onClozeExplain}
            explainLoadingKey={clozeExplainLoading}
          />
        ) : isQuizTab && quizParseFailed ? (
          <div className="quiz-empty">
            <p className="empty-state">Couldn&apos;t parse 10 questions from the response.</p>
            <button
              type="button"
              className="btn accent"
              onClick={() => onRegenerateQuiz(file.id)}
              disabled={isRegeneratingQuiz}
            >
              {isRegeneratingQuiz ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        ) : isClozeTab && clozeParseFailed ? (
          <div className="quiz-empty">
            <p className="empty-state">Couldn&apos;t parse the fill-in-the-blank sheet from the response.</p>
          </div>
        ) : tabIsEmpty ? (
          <div className="empty-state">
            {activeTab === "multiNote"
              ? "Select 2+ files, check Multi-note outline, and click Process."
              : isQuizTab
              ? "Check Review Questions and click Process to generate 10 quiz questions."
              : isClozeTab
              ? "Check Fill-in-the-blank and click Process to generate the sheet."
              : "Nothing generated yet for this view. Run "}
            {!isQuizTab && activeTab !== "multiNote" && !isClozeTab && (
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

function isClozeAnswerCorrect(value, answer, alternatives) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  const a = answer.trim().toLowerCase();
  if (v === a) return true;
  const alt = (alternatives || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (alt.some((x) => x === v)) return true;
  return false;
}

function ClozeSheet({
  fileId,
  sections,
  userInputs,
  submittedBlanks,
  explanations,
  onInput,
  onSubmitBlank,
  onRequestExplain,
  explainLoadingKey
}) {
  const flatItems = useMemo(() => {
    const out = [];
    (sections || []).forEach((sec) => {
      (sec.items || []).forEach((it) => out.push({ ...it, sectionHeading: sec.heading }));
    });
    return out;
  }, [sections]);

  const submittedSet = useMemo(
    () => new Set(Array.isArray(submittedBlanks) ? submittedBlanks : []),
    [submittedBlanks]
  );

  let globalIndex = 0;
  return (
    <div className="cloze-root">
      {(sections || []).map((sec, sIdx) => (
        <section key={sIdx} className="cloze-section">
          <h3 className="cloze-heading">{sec.heading}</h3>
          <ul className="cloze-list">
            {(sec.items || []).map((it, iIdx) => {
              const blankIndex = globalIndex++;
              const userVal = userInputs[blankIndex] ?? "";
              const correct = isClozeAnswerCorrect(userVal, it.answer, it.alternatives);
              const isSubmitted = submittedSet.has(blankIndex);
              const hasAttempt = String(userVal).trim() !== "";
              const isWrong = isSubmitted && hasAttempt && correct === false;
              const showCorrect = isSubmitted && correct === true;
              const parts = it.text.split(CLOZE_BLANK);
              const explainLoading = explainLoadingKey === `${fileId}-${blankIndex}`;
              const explanation = explanations[blankIndex];

              return (
                <li key={blankIndex} className="cloze-item">
                  <span className="cloze-sentence">
                    {parts[0]}
                    <input
                      type="text"
                      className={
                        "cloze-input" +
                        (showCorrect ? " cloze-input-correct" : "") +
                        (isWrong ? " cloze-input-incorrect" : "")
                      }
                      value={userVal}
                      onChange={(e) => onInput(fileId, blankIndex, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onSubmitBlank(fileId, blankIndex);
                        }
                      }}
                      placeholder=""
                      aria-label={`Blank ${blankIndex + 1}`}
                    />
                    {parts[1]}
                  </span>
                  {isWrong && (
                    <div className="cloze-feedback">
                      <span className="cloze-correct-answer">Correct answer: {it.answer}</span>
                      <button
                        type="button"
                        className="btn tiny cloze-explain-btn"
                        onClick={() => onRequestExplain(fileId, blankIndex)}
                        disabled={explainLoading}
                      >
                        {explainLoading ? "…" : "Explain"}
                      </button>
                      {explanation && (
                        <p className="cloze-explanation">{explanation}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Quiz({
  fileId,
  questions,
  userAnswers,
  feedback,
  onSelectAnswer,
  onSubmit,
  onRegenerate,
  isSubmitting,
  isRegenerating
}) {
  const labels = ["A", "B", "C", "D"];
  return (
    <div className="quiz-root">
      <ol className="quiz-list">
        {questions.map((q, qIndex) => {
          const correctIndices = q.correctIndices ?? (q.correctIndex != null ? [q.correctIndex] : []);
          const multiSelect = correctIndices.length > 1;
          const isSelected = (oIndex) =>
            multiSelect
              ? Array.isArray(userAnswers[qIndex]) && userAnswers[qIndex].includes(oIndex)
              : userAnswers[qIndex] === oIndex;
          return (
            <li key={qIndex} className="quiz-item">
              <div className="quiz-question">
                {q.question}
                {multiSelect && (
                  <span className="quiz-multi-hint"> (select 2)</span>
                )}
              </div>
              <div className="quiz-options">
                {q.options.map((opt, oIndex) => (
                  <button
                    key={oIndex}
                    type="button"
                    className={
                      "quiz-option" +
                      (isSelected(oIndex) ? " quiz-option-selected" : "")
                    }
                    onClick={() => onSelectAnswer(fileId, qIndex, oIndex, multiSelect)}
                  >
                    <span className="quiz-option-label">{labels[oIndex]}</span>
                    <span className="quiz-option-text">{opt}</span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="quiz-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => onSubmit(fileId)}
          disabled={isSubmitting || isRegenerating}
        >
          {isSubmitting ? "Submitting…" : "Submit"}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => onRegenerate(fileId)}
          disabled={isSubmitting || isRegenerating}
        >
          {isRegenerating ? "Regenerating…" : "Regenerate (new 10 questions)"}
        </button>
      </div>
      {feedback && (
        <div className="quiz-feedback">
          <h4 className="quiz-feedback-title">Feedback</h4>
          <ReactMarkdown>{feedback}</ReactMarkdown>
        </div>
      )}
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

