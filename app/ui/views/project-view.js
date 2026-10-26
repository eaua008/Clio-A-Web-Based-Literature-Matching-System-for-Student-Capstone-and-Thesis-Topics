/* Clio — project form, keyword tags, sidebar list and detail view (drawing only). */
(function () {
  "use strict";

  const { refreshIcons } = window.Clio;

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("project-form"),
    title: $("title"),
    abstract: $("abstract"),
    keyword: $("keyword-input"),
    tagList: $("tag-list"),
    tagAdd: $("tag-add"),
    submit: $("form-submit"),
    secondary: $("form-secondary"),
    search: $("project-search-input"),
    list: $("project-list"),
    detailEdit: $("detail-edit"),
    detailDelete: $("detail-delete"),
    newProject: document.querySelector("[data-new-project]"),
  };

  const fmt = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  window.Clio.ProjectView = {
    els,

    /* "new" and "edit" show the form; "detail" shows the project. */
    showView(view) {
      $("form-view").hidden = view === "detail";
      $("detail-view").hidden = view !== "detail";
    },

    isFormVisible: () => !$("form-view").hidden,

    renderList(matches, total, query, activeId) {
      els.list.innerHTML = "";
      matches.forEach((p) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "project-link";
        a.href = "#/project/" + encodeURIComponent(p.id);
        a.title = p.title;
        const active = p.id === activeId;
        a.classList.toggle("is-active", active);
        if (active) a.setAttribute("aria-current", "page");
        a.innerHTML = '<i data-lucide="file-text"></i>';
        const span = document.createElement("span");
        span.className = "project-link__title";
        span.textContent = p.title;
        a.appendChild(span);
        li.appendChild(a);
        els.list.appendChild(li);
      });

      const empty = $("project-empty");
      empty.hidden = matches.length > 0;
      empty.querySelector("p").textContent = total
        ? "No projects match “" + query.trim() + "”."
        : "No projects yet. Create your first one!";
      $("project-count").textContent = total ? String(total) : "";
      refreshIcons();
    },

    renderTags(tags) {
      els.tagList.innerHTML = "";
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
        els.tagList.appendChild(li);
      });
      refreshIcons();
    },

    renderWordCount(count, min) {
      const counter = $("word-count");
      counter.textContent = count + " / " + min + " words";
      const low = count > 0 && count < min;
      counter.classList.toggle("is-low", low);
      counter.classList.toggle("is-ok", count >= min);
      $("word-hint").classList.toggle("is-warning", low);
    },

    /* Fill the form for editing, or empty it for a new project. */
    fillForm(project) {
      els.title.value = project ? project.title : "";
      els.abstract.value = project ? project.abstract : "";
      els.keyword.value = "";
      $("form-title").textContent = project ? "Edit Project" : "New Project";
      els.submit.textContent = project ? "Save changes" : "Enter";
      els.secondary.textContent = project ? "Cancel" : "Clear";
    },

    setSubmitting(busy) {
      els.submit.disabled = busy;
    },

    hasErrors: () => Boolean(els.form.querySelector(".field--invalid")),

    renderDetail(project, words) {
      $("detail-title").textContent = project.title;
      $("detail-meta").textContent = "Created " + fmt(project.createdAt) + " · Updated " + fmt(project.updatedAt)
        + " · " + words + " words";
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
    },
  };
})();
