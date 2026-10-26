/* Clio — project form, sidebar list, search, detail/edit/delete.
   Projects live only in this browser's localStorage. Views are chosen by the URL hash:
     #/                      new project form
     #/project/<id>          project details
     #/project/<id>/edit     edit form */
(function () {
  "use strict";

  const { store, toast, setFieldError, focusFirstInvalid, refreshIcons } = window.Clio;

  const STORAGE_KEY = "clio.projects";
  const MIN_WORDS = 50;
  const MAX_KEYWORDS = 20;
  const MAX_KEYWORD_LENGTH = 50;

  const $ = (id) => document.getElementById(id);
  const form = $("project-form");
  const titleInput = $("title");
  const abstractInput = $("abstract");
  const keywordInput = $("keyword-input");
  const tagList = $("tag-list");
  const submitBtn = $("form-submit");
  const secondaryBtn = $("form-secondary");
  const searchInput = $("project-search-input");

  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  const normalize = (text) => text.replace(/\s+/g, " ").trim();

  /* ---------- Data ---------- */
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

  function loadProjects() {
    const raw = store.get(STORAGE_KEY, []);
    return Array.isArray(raw) ? raw.map(sanitize).filter(Boolean) : [];
  }

  let projects = loadProjects();

  function saveProjects() {
    if (!store.set(STORAGE_KEY, projects)) {
      toast("Couldn't save to browser storage. Changes will be lost on refresh.", "error");
    }
  }

  const findProject = (id) => projects.find((p) => p.id === id);

  function newId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Routing ---------- */
  function parseRoute() {
    const m = location.hash.match(/^#\/project\/([^/]+)(\/edit)?$/);
    if (!m) return { view: "new" };
    return { view: m[2] ? "edit" : "detail", id: decodeURIComponent(m[1]) };
  }

  let route = parseRoute();
  let currentHash = location.hash;
  let ignoreNextHashChange = false;

  function navigate(hash) {
    if (location.hash === hash || (hash === "#/" && !location.hash)) render();
    else location.hash = hash;
  }

  window.addEventListener("hashchange", () => {
    if (ignoreNextHashChange) {
      ignoreNextHashChange = false;
      return;
    }
    if (isDirty() && !window.confirm("You have unsaved changes. Leave this form?")) {
      ignoreNextHashChange = true;
      location.hash = currentHash || "#/";
      return;
    }
    render();
  });

  function render() {
    route = parseRoute();
    currentHash = location.hash;
    const project = route.id ? findProject(route.id) : null;

    if (route.view !== "new" && !project) {
      toast("That project doesn't exist in this browser.", "error");
      ignoreNextHashChange = true;
      location.hash = "#/";
      route = { view: "new" };
    }

    $("form-view").hidden = route.view === "detail";
    $("detail-view").hidden = route.view !== "detail";

    if (route.view === "detail") renderDetail(project);
    else loadForm(route.view === "edit" ? project : null);

    renderList();
    window.Clio.closeDrawer();
  }

  /* ---------- Sidebar list + search ---------- */
  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const matches = projects
      .filter((p) => !query
        || p.title.toLowerCase().includes(query)
        || p.keywords.some((k) => k.toLowerCase().includes(query)))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const list = $("project-list");
    list.innerHTML = "";
    matches.forEach((p) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "project-link";
      a.href = "#/project/" + encodeURIComponent(p.id);
      a.title = p.title;
      const active = p.id === route.id;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "page");
      a.innerHTML = '<i data-lucide="file-text"></i>';
      const span = document.createElement("span");
      span.className = "project-link__title";
      span.textContent = p.title;
      a.appendChild(span);
      li.appendChild(a);
      list.appendChild(li);
    });

    const empty = $("project-empty");
    empty.hidden = matches.length > 0;
    empty.querySelector("p").textContent = projects.length
      ? "No projects match “" + searchInput.value.trim() + "”."
      : "No projects yet. Create your first one!";
    $("project-count").textContent = projects.length ? String(projects.length) : "";
    refreshIcons();
  }

  searchInput.addEventListener("input", renderList);

  /* ---------- Keyword tags ---------- */
  let tags = [];

  function renderTags() {
    tagList.innerHTML = "";
    tags.forEach((tag, i) => {
      const li = document.createElement("li");
      li.className = "tag tag--removable";
      const span = document.createElement("span");
      span.textContent = tag;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag__remove";
      btn.dataset.index = String(i);
      btn.setAttribute("aria-label", "Remove keyword " + tag);
      btn.innerHTML = '<i data-lucide="x"></i>';
      li.append(span, btn);
      tagList.appendChild(li);
    });
    refreshIcons();
  }

  function addTag() {
    const value = normalize(keywordInput.value);
    if (!value) {
      setFieldError("keywords", "Type a keyword first.", keywordInput);
      return false;
    }
    if (value.length > MAX_KEYWORD_LENGTH) {
      setFieldError("keywords", "Keywords must be at most " + MAX_KEYWORD_LENGTH + " characters.", keywordInput);
      return false;
    }
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setFieldError("keywords", "“" + value + "” has already been added.", keywordInput);
      return false;
    }
    if (tags.length >= MAX_KEYWORDS) {
      setFieldError("keywords", "Use at most " + MAX_KEYWORDS + " keywords.", keywordInput);
      return false;
    }
    tags.push(value);
    keywordInput.value = "";
    setFieldError("keywords", "", keywordInput);
    renderTags();
    return true;
  }

  keywordInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      addTag();
    } else if (evt.key === "Backspace" && !keywordInput.value && tags.length) {
      tags.pop();
      renderTags();
    }
  });
  $("tag-add").addEventListener("click", () => { addTag(); keywordInput.focus(); });
  tagList.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".tag__remove");
    if (!btn) return;
    tags.splice(Number(btn.dataset.index), 1);
    renderTags();
    keywordInput.focus();
  });

  /* ---------- Form ---------- */
  let editingId = null;
  let cleanSnapshot = "";

  const snapshot = () => JSON.stringify([titleInput.value, abstractInput.value, tags, keywordInput.value.trim()]);
  const isDirty = () => !$("form-view").hidden && snapshot() !== cleanSnapshot;
  const markClean = () => { cleanSnapshot = snapshot(); };

  function updateWordCount() {
    const count = wordCount(abstractInput.value);
    const counter = $("word-count");
    counter.textContent = count + " / " + MIN_WORDS + " words";
    const low = count > 0 && count < MIN_WORDS;
    counter.classList.toggle("is-low", low);
    counter.classList.toggle("is-ok", count >= MIN_WORDS);
    $("word-hint").classList.toggle("is-warning", low);
  }

  function clearErrors() {
    setFieldError("title", "");
    setFieldError("abstract", "");
    setFieldError("keywords", "", keywordInput);
  }

  function loadForm(project) {
    editingId = project ? project.id : null;
    titleInput.value = project ? project.title : "";
    abstractInput.value = project ? project.abstract : "";
    keywordInput.value = "";
    tags = project ? project.keywords.slice() : [];
    renderTags();
    clearErrors();
    updateWordCount();
    $("form-title").textContent = project ? "Edit Project" : "New Project";
    submitBtn.textContent = project ? "Save changes" : "Enter";
    secondaryBtn.textContent = project ? "Cancel" : "Clear";
    markClean();
  }

  function validate() {
    const title = normalize(titleInput.value);
    setFieldError("title",
      !title ? "Please enter a project title."
        : title.length < 5 ? "The title should be at least 5 characters long."
          : "");

    const count = wordCount(abstractInput.value);
    setFieldError("abstract", count >= MIN_WORDS ? ""
      : "Please write at least " + MIN_WORDS + " words to ensure the TF-IDF vectorizer has sufficient lexical depth ("
        + count + "/" + MIN_WORDS + " so far).");

    // A keyword typed but not yet added still counts.
    const keywordsOk = keywordInput.value.trim() ? addTag() : true;
    if (keywordsOk && !tags.length) setFieldError("keywords", "Add at least one key domain term.", keywordInput);
    else if (keywordsOk) setFieldError("keywords", "", keywordInput);

    return !form.querySelector(".field--invalid");
  }

  titleInput.addEventListener("input", () => { if (normalize(titleInput.value).length >= 5) setFieldError("title", ""); });
  abstractInput.addEventListener("input", () => {
    updateWordCount();
    if (wordCount(abstractInput.value) >= MIN_WORDS) setFieldError("abstract", "");
  });

  let submitting = false;
  form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    if (submitting) return;  // guards against double-clicks
    if (!validate()) {
      focusFirstInvalid(form);
      return;
    }
    submitting = true;
    submitBtn.disabled = true;

    const data = { title: normalize(titleInput.value), abstract: abstractInput.value.trim(), keywords: tags.slice() };
    const now = Date.now();

    if (editingId) {
      const project = findProject(editingId);
      Object.assign(project, data, { updatedAt: now });
      saveProjects();
      markClean();
      toast("Project updated.", "success");
      navigate("#/project/" + encodeURIComponent(project.id));
    } else {
      projects.push({ id: newId(), ...data, createdAt: now, updatedAt: now });
      saveProjects();
      loadForm(null);
      renderList();
      toast("“" + data.title + "” saved.", "success");
      titleInput.focus();
    }

    setTimeout(() => { submitting = false; submitBtn.disabled = false; }, 400);
  });

  secondaryBtn.addEventListener("click", () => {
    if (editingId) {
      navigate("#/project/" + encodeURIComponent(editingId));
      return;
    }
    if (isDirty() && !window.confirm("Discard the unsaved project details? Saved projects won't be affected.")) return;
    loadForm(null);
    titleInput.focus();
  });

  /* ---------- Detail ---------- */
  const fmt = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  function renderDetail(project) {
    editingId = null;
    $("detail-title").textContent = project.title;
    $("detail-meta").textContent = "Created " + fmt(project.createdAt) + " · Updated " + fmt(project.updatedAt)
      + " · " + wordCount(project.abstract) + " words";
    $("detail-abstract").textContent = project.abstract;
    const list = $("detail-tags");
    list.innerHTML = "";
    project.keywords.forEach((k) => {
      const li = document.createElement("li");
      li.className = "tag";
      const span = document.createElement("span");
      span.textContent = k;
      li.appendChild(span);
      list.appendChild(li);
    });
  }

  $("detail-edit").addEventListener("click", () => navigate("#/project/" + encodeURIComponent(route.id) + "/edit"));

  $("detail-delete").addEventListener("click", () => {
    const project = findProject(route.id);
    if (!project || !window.confirm("Delete “" + project.title + "”? This cannot be undone.")) return;
    projects = projects.filter((p) => p.id !== project.id);
    saveProjects();
    toast("“" + project.title + "” deleted.", "success");
    navigate("#/");
  });

  /* "New Project" when already on the new form: just focus it. */
  document.querySelector("[data-new-project]").addEventListener("click", (evt) => {
    if (route.view === "new") {
      evt.preventDefault();
      window.Clio.closeDrawer();
      titleInput.focus();
    }
  });

  document.getElementById("project-list").addEventListener("click", (evt) => {
    if (evt.target.closest(".project-link")) window.Clio.closeDrawer();
  });

  window.addEventListener("beforeunload", (evt) => {
    if (isDirty()) {
      evt.preventDefault();
      evt.returnValue = "";
    }
  });

  // Keep several open tabs in sync.
  window.addEventListener("storage", (evt) => {
    if (evt.key !== STORAGE_KEY) return;
    projects = loadProjects();
    if (route.id && !findProject(route.id)) navigate("#/");
    else renderList();
  });

  render();
})();
