/* Clio — Sidebar: logo, New Project, search and project list. */
class Sidebar {
  render() {
    return `
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar" aria-label="Projects navigation">
        <div class="sidebar__top">
          <a href="#/" class="brand" aria-label="Clio home" data-nav>
            <img src="assets/images/logo.png" alt="" width="58" height="74">
            <span class="brand__name" aria-hidden="true">lio</span>
          </a>
          <div class="sidebar__tools">
            <button type="button" class="icon-btn" data-search-toggle aria-label="Search projects" aria-haspopup="dialog" aria-controls="search-modal" aria-expanded="false" title="Search projects (Ctrl+K)">
              <i data-lucide="search"></i>
            </button>
            <button type="button" class="icon-btn" data-sidebar-toggle aria-label="Collapse sidebar" aria-controls="sidebar" aria-expanded="true" title="Collapse sidebar">
              <i data-lucide="panel-left"></i>
            </button>
          </div>
        </div>

        <a href="#/" class="new-project-btn" data-nav data-new-project>
          <span>New Project</span><i data-lucide="circle-plus"></i>
        </a>

        <div class="sidebar__search" id="project-search" hidden>
          <label for="project-search-input" class="visually-hidden">Search projects by title or keyword</label>
          <i data-lucide="search" class="sidebar__search-icon"></i>
          <input id="project-search-input" type="search" placeholder="Search title or keyword…" autocomplete="off">
        </div>

        <div class="sidebar__section">
          <h2 class="sidebar__heading">Projects</h2>
          <span class="sidebar__count" id="project-count"></span>
        </div>

        <div class="project-list-wrap">
          <ul class="project-list" id="project-list" role="list"></ul>
          <div class="empty-state" id="project-empty" hidden>
            <i data-lucide="folder-open"></i>
            <p></p>
          </div>
        </div>
      </aside>
      <div class="sidebar-backdrop" data-sidebar-close hidden></div>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
