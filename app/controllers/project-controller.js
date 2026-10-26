/* Clio — project routing, form, keyword tags, search, detail/edit/delete.
   Views are chosen by the URL hash:
     #/                      new project form
     #/project/<id>          project details
     #/project/<id>/edit     edit form */
(function () {
  "use strict";

  const { toast, setFieldError, focusFirstInvalid, Project, ProjectService: projects, ProjectView: view } = window.Clio;
  const els = view.els;

  function warnIfNotSaved(saved) {
    if (!saved) toast("Couldn't save to browser storage. Changes will be lost on refresh.", "error");
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
    const project = route.id ? projects.find(route.id) : null;

    if (route.view !== "new" && !project) {
      toast("That project doesn't exist in this browser.", "error");
      ignoreNextHashChange = true;
      location.hash = "#/";
      route = { view: "new" };
    }

    view.showView(route.view);
    if (route.view === "detail") {
      editingId = null;
      view.renderDetail(project, Project.wordCount(project.abstract));
    } else {
      loadForm(route.view === "edit" ? project : null);
    }

    renderList();
    window.Clio.closeDrawer();
  }

  /* ---------- Sidebar list + search ---------- */
  function renderList() {
    const query = els.search.value;
    view.renderList(projects.search(query), projects.all().length, query, route.id);
  }

  els.search.addEventListener("input", renderList);

  /* ---------- Keyword tags ---------- */
  let tags = [];

  function addTag() {
    const value = Project.normalize(els.keyword.value);
    const error = Project.keywordError(value, tags);
    setFieldError("keywords", error, els.keyword);
    if (error) return false;
    tags.push(value);
    els.keyword.value = "";
    view.renderTags(tags);
    return true;
  }

  els.keyword.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      addTag();
    } else if (evt.key === "Backspace" && !els.keyword.value && tags.length) {
      tags.pop();
      view.renderTags(tags);
    }
  });
  els.tagAdd.addEventListener("click", () => { addTag(); els.keyword.focus(); });
  els.tagList.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".tag__remove");
    if (!btn) return;
    tags.splice(Number(btn.dataset.index), 1);
    view.renderTags(tags);
    els.keyword.focus();
  });

  /* ---------- Form ---------- */
  let editingId = null;
  let cleanSnapshot = "";

  const snapshot = () => JSON.stringify([els.title.value, els.abstract.value, tags, els.keyword.value.trim()]);
  const isDirty = () => view.isFormVisible() && snapshot() !== cleanSnapshot;
  const markClean = () => { cleanSnapshot = snapshot(); };
  const updateWordCount = () => view.renderWordCount(Project.wordCount(els.abstract.value), Project.MIN_WORDS);

  function clearErrors() {
    setFieldError("title", "");
    setFieldError("abstract", "");
    setFieldError("keywords", "", els.keyword);
  }

  function loadForm(project) {
    editingId = project ? project.id : null;
    tags = project ? project.keywords.slice() : [];
    view.fillForm(project);
    view.renderTags(tags);
    clearErrors();
    updateWordCount();
    markClean();
  }

  function validate() {
    setFieldError("title", Project.titleError(els.title.value));
    setFieldError("abstract", Project.abstractError(els.abstract.value));

    // A keyword typed but not yet added still counts.
    const keywordsOk = els.keyword.value.trim() ? addTag() : true;
    if (keywordsOk && !tags.length) setFieldError("keywords", "Add at least one key domain term.", els.keyword);
    else if (keywordsOk) setFieldError("keywords", "", els.keyword);

    return !view.hasErrors();
  }

  els.title.addEventListener("input", () => {
    if (!Project.titleError(els.title.value)) setFieldError("title", "");
  });
  els.abstract.addEventListener("input", () => {
    updateWordCount();
    if (!Project.abstractError(els.abstract.value)) setFieldError("abstract", "");
  });

  let submitting = false;
  els.form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    if (submitting) return;  // guards against double-clicks
    if (!validate()) {
      focusFirstInvalid(els.form);
      return;
    }
    submitting = true;
    view.setSubmitting(true);

    const data = {
      title: Project.normalize(els.title.value),
      abstract: els.abstract.value.trim(),
      keywords: tags.slice(),
    };

    if (editingId) {
      const { project, saved } = projects.update(editingId, data);
      warnIfNotSaved(saved);
      markClean();
      toast("Project updated.", "success");
      navigate("#/project/" + encodeURIComponent(project.id));
    } else {
      warnIfNotSaved(projects.create(data).saved);
      loadForm(null);
      renderList();
      toast("“" + data.title + "” saved.", "success");
      els.title.focus();
    }

    setTimeout(() => { submitting = false; view.setSubmitting(false); }, 400);
  });

  els.secondary.addEventListener("click", () => {
    if (editingId) {
      navigate("#/project/" + encodeURIComponent(editingId));
      return;
    }
    if (isDirty() && !window.confirm("Discard the unsaved project details? Saved projects won't be affected.")) return;
    loadForm(null);
    els.title.focus();
  });

  /* ---------- Detail ---------- */
  els.detailEdit.addEventListener("click", () => navigate("#/project/" + encodeURIComponent(route.id) + "/edit"));

  els.detailDelete.addEventListener("click", () => {
    const project = projects.find(route.id);
    if (!project || !window.confirm("Delete “" + project.title + "”? This cannot be undone.")) return;
    warnIfNotSaved(projects.remove(project.id));
    toast("“" + project.title + "” deleted.", "success");
    navigate("#/");
  });

  /* "New Project" when already on the new form: just focus it. */
  els.newProject.addEventListener("click", (evt) => {
    if (route.view === "new") {
      evt.preventDefault();
      window.Clio.closeDrawer();
      els.title.focus();
    }
  });

  els.list.addEventListener("click", (evt) => {
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
    if (evt.key !== projects.STORAGE_KEY) return;
    projects.reload();
    if (route.id && !projects.find(route.id)) navigate("#/");
    else renderList();
  });

  render();
})();
