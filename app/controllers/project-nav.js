/* Clio — Sidebar project navigation: project list, search dialog and collapse rail.
   Projects live in memory for this page visit only: no persistence layer exists yet,
   so nothing here is saved and a reload clears the list. */
class ProjectNav {
  constructor(results) {
    this.results = results;
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
    this.opener = null;
    this.highlight = -1;
  }

  bind(form) {
    this.form = form;
    document.querySelector("[data-new-project]").addEventListener("click", (e) => {
      e.preventDefault();
      this.form.clear();
    });
    this.list.addEventListener("click", (e) => {
      const link = e.target.closest("[data-project-id]");
      if (!link) return;
      e.preventDefault();
      this.open(link.dataset.projectId);
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
    this.render();
  }

  open(id) {
    const project = this.projects.find((p) => p.id === id);
    this.form.fill(project);
    this.results.show(project, project.match);
    this.select(project.id);
  }

  /* match: the related-studies result shown for this project, reused when it is selected again. */
  add(project, match) {
    const active = this.projects.find((p) => p.id === this.activeId);
    if (active) Object.assign(active, project, { match });
    else this.projects.unshift({ ...project, match, id: `p${Date.now()}` });
    this.activeId = active ? active.id : this.projects[0].id;
    this.render();
  }

  /* Moves the highlight only; the list itself is unchanged. */
  select(id) {
    this.activeId = id;
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
      </a></li>
    `).join("");
    this.list.querySelectorAll(".project-link").forEach((el, i) => {
      el.querySelector(".project-link__title").textContent = this.projects[i].title;
      el.title = this.projects[i].title;
    });
    this.count.textContent = this.projects.length || "";
    this.empty.hidden = this.projects.length > 0;
    this.empty.querySelector("p").textContent = "No projects yet. Projects you enter appear here for this visit only; they aren't saved.";
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

  /* Collapse / expand rail (desktop only; the toggle is hidden on mobile) */
  toggleSidebar() {
    const collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    this.sidebarToggle.setAttribute("aria-label", label);
    this.sidebarToggle.title = label;
    this.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  }
}
