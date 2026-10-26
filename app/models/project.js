/* Clio — what a project is: its shape and validation rules. No storage, no DOM. */
(function () {
  "use strict";

  const MIN_WORDS = 50;
  const MIN_TITLE_LENGTH = 5;
  const MAX_KEYWORDS = 20;
  const MAX_KEYWORD_LENGTH = 50;

  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  const normalize = (text) => text.replace(/\s+/g, " ").trim();

  /* Returns a clean project, or null when stored data is unusable. */
  function sanitize(p) {
    if (!p || typeof p.id !== "string" || typeof p.title !== "string" || typeof p.abstract !== "string") return null;
    return {
      id: p.id,
      title: p.title,
      abstract: p.abstract,
      keywords: Array.isArray(p.keywords) ? p.keywords.filter((k) => typeof k === "string") : [],
      createdAt: Number(p.createdAt) || Date.now(),
      updatedAt: Number(p.updatedAt) || Number(p.createdAt) || Date.now(),
    };
  }

  /* ---------- Validation (returns an error message, or "") ---------- */
  function titleError(title) {
    title = normalize(title);
    return !title ? "Please enter a project title."
      : title.length < MIN_TITLE_LENGTH ? "The title should be at least " + MIN_TITLE_LENGTH + " characters long."
        : "";
  }

  function abstractError(abstract) {
    const count = wordCount(abstract);
    return count >= MIN_WORDS ? ""
      : "Please write at least " + MIN_WORDS + " words to ensure the TF-IDF vectorizer has sufficient lexical depth ("
        + count + "/" + MIN_WORDS + " so far).";
  }

  function keywordError(value, existing) {
    if (!value) return "Type a keyword first.";
    if (value.length > MAX_KEYWORD_LENGTH) return "Keywords must be at most " + MAX_KEYWORD_LENGTH + " characters.";
    if (existing.some((t) => t.toLowerCase() === value.toLowerCase())) return "“" + value + "” has already been added.";
    if (existing.length >= MAX_KEYWORDS) return "Use at most " + MAX_KEYWORDS + " keywords.";
    return "";
  }

  window.Clio.Project = {
    MIN_WORDS,
    wordCount,
    normalize,
    sanitize,
    titleError,
    abstractError,
    keywordError,
  };
})();
