/* Clio — Sidebar project navigation: project list, search dialog and collapse rail.
   Signed-in users' projects are saved by the backend and loaded after sign-in.
   Guests' projects live in memory for this page visit only. */
class ProjectNav {
  constructor(results, api) {
    this.results = results;
    this.api = api;
    this.form = null;
    this.projects = [];
    this.activeId = null;
    this.list = document.getElementById("project-list");
    this.count = document.getElementById("project-count");
    this.empty = document.getElementById("project-empty");
    this.app = document.querySelector(".app");
    this.authModal = document.getElementById("auth-modal");
    this.searchEmpty = document.getElementById("search-empty");
    this.search = document.getElementById("search-modal");
    this.searchInput = document.getElementById("search-input");
    this.searchResults = document.getElementById("search-results");
    this.searchToggle = document.querySelector("[data-search-toggle]");
    this.sidebarToggle = document.querySelector("[data-sidebar-toggle]");
    this.drawerOpener = document.querySelector("[data-sidebar-open]");
    this.backdrop = document.querySelector("[data-sidebar-close]");
    this.opener = null;
    this.highlight = -1;
  }

  bind(form) {
    this.form = form;
    document.querySelector("[data-new-project]").addEventListener("click", (e) => {
      e.preventDefault();
      this.form.clear();
      this.closeDrawer();
    });
    if (this.drawerOpener) this.drawerOpener.addEventListener("click", () => this.openDrawer());
    if (this.backdrop) this.backdrop.addEventListener("click", () => this.closeDrawer());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.documentElement.classList.contains("sidebar-open")) this.closeDrawer(true);
    });
    this.list.addEventListener("click", (e) => {
      const remove = e.target.closest("[data-delete-project]");
      if (remove) return this.remove(remove.dataset.deleteProject);
      const link = e.target.closest("[data-project-id]");
      if (!link) return;
      e.preventDefault();
      this.open(link.dataset.projectId);
      this.closeDrawer();
    });

    this.searchToggle.addEventListener("click", () => this.openSearch(this.searchToggle));
    this.sidebarToggle.addEventListener("click", () => this.toggleSidebar());
    this.searchInput.addEventListener("input", () => this.renderSearch());
    this.search.addEventListener("click", (e) => {
      if (e.target.closest("[data-search-close]")) return this.closeSearch();
      const option = e.target.closest("[data-project-id]");
      if (option) this.pick(option.dataset.projectId);
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (!this.authModal.hidden) return;
        e.preventDefault();
        return this.search.hidden ? this.openSearch(document.activeElement) : this.searchInput.focus();
      }
      if (!this.search.hidden) this.onSearchKey(e);
    });
    document.addEventListener("clio:signed-in", () => this.loadSaved());
    document.addEventListener("clio:signed-out", () => this.finishRestore(null));
    this.render();
  }

  /* Puts the user's saved projects in the list, then reopens the project that was open before a refresh. */
  async loadSaved() {
    const root = document.documentElement;
    root.classList.add("projects-pending");
    try {
      const saved = await this.api.listProjects();
      const unsaved = this.projects.filter((p) => !p.saved);
      this.projects = [...unsaved, ...saved.map((p) => ({ id: p.id, title: p.title, saved: true, match: null }))];
      this.render();
    } finally {
      root.classList.remove("projects-pending");
    }
    await this.finishRestore(this.linkedProjectId());
  }

  /* The project id in the address (#/projects/<id>), if any. */
  linkedProjectId() {
    const found = location.hash.match(/^#\/projects\/([^/]+)$/);
    return found ? decodeURIComponent(found[1]) : null;
  }

  /* Reopens the linked project if it is one of the user's; otherwise clears the address. */
  async finishRestore(id) {
    try {
      if (id && this.projects.some((p) => p.id === id)) await this.open(id);
      else if (location.hash.startsWith("#/projects/")) this.remember(null);
    } finally {
      document.documentElement.classList.remove("project-pending");
    }
  }

  /* Puts the open saved project in the address bar, so a refresh can reopen it. Guest projects aren't saved, so they get no address. */
  remember(id) {
    const project = id && this.projects.find((p) => p.id === id);
    const address = project && project.saved ? `#/projects/${encodeURIComponent(id)}` : location.pathname + location.search;
    history.replaceState(null, "", address);
  }

  async open(id) {
    const project = this.projects.find((p) => p.id === id);
    if (project.saved && !project.match) {
      this.form.fill(project.abstract ? project : { title: project.title, abstract: "", keywords: [] });
      this.select(project.id);
      this.results.loading(project, "Loading saved results…");
      const loaded = await this.api.loadProject(id);
      if (loaded.error) return this.results.show(project, { studies: [], error: loaded.error });
      Object.assign(project, loaded.project, { match: loaded.match });
    }
    this.form.fill(project);
    this.results.show(project, project.match);
    this.select(project.id);
  }

  /* match: the related-studies result shown for this project, reused when it is selected again.
     A saved project (match.projectId) updates its entry when it is already listed, otherwise it is a new entry. */
  add(project, match) {
    const listed = match.projectId && this.projects.find((p) => p.id === match.projectId);
    if (listed) {
      Object.assign(listed, project, { match, id: match.projectId, saved: true });
      this.activeId = match.projectId;
      this.remember(match.projectId);
      return this.render();
    }
    if (match.projectId) {
      this.projects.unshift({ ...project, match, id: match.projectId, saved: true });
      this.activeId = match.projectId;
      this.remember(match.projectId);
      return this.render();
    }
    const active = this.projects.find((p) => p.id === this.activeId && !p.saved);
    if (active) Object.assign(active, project, { match });
    else this.projects.unshift({ ...project, match, id: `p${Date.now()}` });
    this.activeId = active ? active.id : this.projects[0].id;
    this.render();
  }

  /* Asks first in an in-page dialog (the browser's confirm() is blocked in some browsers, e.g. VS Code's
     Live Preview). Saved projects are deleted from the account; guest projects only leave the list. */
  remove(id) {
    const project = this.projects.find((p) => p.id === id);
    if (!project) return;
    const dialog = this.deleteDialog();
    dialog.querySelector("[data-delete-name]").textContent = project.title;
    dialog.querySelector("[data-delete-error]").textContent = "";
    const confirm = dialog.querySelector("[data-delete-confirm]");
    confirm.disabled = false;
    confirm.textContent = "Delete";
    dialog.onconfirm = async () => {
      if (project.saved) {
        confirm.disabled = true;
        confirm.textContent = "Deleting…";
        const result = await this.api.deleteProject(id);
        if (!result.ok) {
          confirm.disabled = false;
          confirm.textContent = "Delete";
          dialog.querySelector("[data-delete-error]").textContent = result.message || "Couldn't delete this project.";
          return;
        }
      }
      dialog.close();
      this.projects = this.projects.filter((p) => p.id !== id);
      if (this.activeId === id) this.form.clear();
      this.render();
    };
    dialog.showModal();
    dialog.querySelector("[data-delete-cancel]").focus();
  }

  /* Built once, on first use. Text is set with textContent, never as HTML. */
  deleteDialog() {
    if (this.dialog) return this.dialog;
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "delete-title");
    dialog.innerHTML = `
      <h2 class="confirm-dialog__title" id="delete-title">Delete project?</h2>
      <p class="confirm-dialog__text">“<strong data-delete-name></strong>” and its matched studies, labels and notes will be deleted. This can't be undone.</p>
      <p class="confirm-dialog__error" data-delete-error role="alert"></p>
      <div class="confirm-dialog__actions">
        <button type="button" class="btn btn--ghost btn--small" data-delete-cancel>Cancel</button>
        <button type="button" class="btn btn--danger btn--small" data-delete-confirm>Delete</button>
      </div>`;
    dialog.querySelector("[data-delete-cancel]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-delete-confirm]").addEventListener("click", () => dialog.onconfirm && dialog.onconfirm());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
    this.dialog = dialog;
    return dialog;
  }

  /* Moves the highlight only; the list itself is unchanged. */
  select(id) {
    this.activeId = id;
    this.remember(id);
    this.list.querySelectorAll(".project-link").forEach((link) => {
      const isActive = link.dataset.projectId === id;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  render() {
    this.list.innerHTML = this.projects.map((p) => `
      <li><a href="#/" class="project-link${p.id === this.activeId ? " is-active" : ""}" data-project-id="${p.id}"${p.id === this.activeId ? ' aria-current="page"' : ""}>
        <i data-lucide="file-text"></i><span class="project-link__title"></span>
      </a><button type="button" class="project-delete" data-delete-project="${p.id}" title="Delete project"><i data-lucide="trash-2"></i></button></li>
    `).join("");
    this.list.querySelectorAll(".project-link").forEach((el, i) => {
      el.querySelector(".project-link__title").textContent = this.projects[i].title;
      el.title = this.projects[i].title;
      el.nextElementSibling.setAttribute("aria-label", `Delete project ${this.projects[i].title}`);
    });
    this.count.textContent = this.projects.length || "";
    this.empty.hidden = this.projects.length > 0;
    this.empty.querySelector("p").textContent = this.api.signedIn
      ? "No projects yet. Projects you enter are saved to your account."
      : "No projects yet. Projects you enter appear here for this visit only. Sign in to save them.";
    Icons.refresh();
  }

  /* Search dialog */
  openSearch(opener) {
    this.opener = opener;
    this.search.hidden = false;
    this.searchToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    this.app.inert = true;
    this.searchInput.value = "";
    this.renderSearch();
    this.searchInput.focus();
  }

  closeSearch() {
    if (this.search.hidden) return;
    this.search.hidden = true;
    this.searchToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
    this.app.inert = false;
    if (this.opener && this.opener.isConnected && this.opener.focus) this.opener.focus();
  }

  pick(id) {
    this.open(id);
    this.opener = this.list.querySelector(`[data-project-id="${id}"]`) || this.opener;
    this.closeSearch();
  }

  matches() {
    const query = this.searchInput.value.trim().toLowerCase();
    return this.projects.filter((p) => p.title.toLowerCase().includes(query));
  }

  renderSearch() {
    const found = this.matches();
    this.highlight = found.length ? 0 : -1;
    this.searchResults.innerHTML = found.map((p, i) => `
      <li id="search-option-${i}" class="search-dialog__option" role="option" data-project-id="${p.id}" aria-selected="${i === 0}">
        <i data-lucide="file-text"></i><span></span>${p.id === this.activeId ? '<em class="search-dialog__current">Current</em>' : ""}
      </li>
    `).join("");
    this.searchResults.querySelectorAll("span").forEach((el, i) => { el.textContent = found[i].title; });
    this.searchResults.hidden = !found.length;
    this.searchEmpty.textContent = found.length ? ""
      : this.projects.length ? `No projects match “${this.searchInput.value.trim()}”.`
      : "No projects yet. Projects you enter this visit will appear here.";
    this.markHighlight();
    Icons.refresh();
  }

  markHighlight() {
    const options = [...this.searchResults.children];
    options.forEach((el, i) => el.setAttribute("aria-selected", String(i === this.highlight)));
    if (options[this.highlight]) {
      this.searchInput.setAttribute("aria-activedescendant", options[this.highlight].id);
      options[this.highlight].scrollIntoView({ block: "nearest" });
    } else this.searchInput.removeAttribute("aria-activedescendant");
  }

  onSearchKey(e) {
    const options = [...this.searchResults.children];
    if (e.key === "Escape") { e.preventDefault(); this.closeSearch(); }
    else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && options.length) {
      e.preventDefault();
      this.highlight = (this.highlight + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      this.markHighlight();
    } else if (e.key === "Enter" && options[this.highlight]) {
      e.preventDefault();
      this.pick(options[this.highlight].dataset.projectId);
    } else if (e.key === "Tab") {
      const items = [this.searchInput, ...this.search.querySelectorAll("button")];
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  }

  /* Mobile drawer: the menu button in the top bar slides the sidebar in over the page. */
  openDrawer() {
    document.documentElement.classList.add("sidebar-open");
    if (this.backdrop) this.backdrop.hidden = false;
    if (this.drawerOpener) this.drawerOpener.setAttribute("aria-expanded", "true");
    const first = document.querySelector("#sidebar [data-new-project]");
    if (first) first.focus();
  }

  /* refocus: put focus back on the menu button (when closed with Escape). */
  closeDrawer(refocus = false) {
    if (!document.documentElement.classList.contains("sidebar-open")) return;
    document.documentElement.classList.remove("sidebar-open");
    if (this.backdrop) this.backdrop.hidden = true;
    if (this.drawerOpener) {
      this.drawerOpener.setAttribute("aria-expanded", "false");
      if (refocus) this.drawerOpener.focus();
    }
  }

  /* Collapse / expand rail (desktop only; the toggle is hidden on mobile) */
  toggleSidebar() {
    const collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    this.sidebarToggle.setAttribute("aria-label", label);
    this.sidebarToggle.title = label;
    this.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  }
}