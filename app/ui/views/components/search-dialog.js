/* Clio — Search projects dialog (Ctrl+K / Cmd+K). Searches only the projects listed in the sidebar. */
class SearchDialog {
  render() {
    return `
      <!-- Search projects dialog -->
      <div class="modal search-modal" id="search-modal" hidden>
        <div class="modal__overlay" data-search-close></div>
        <div class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <h2 class="visually-hidden" id="search-title">Search projects</h2>
          <div class="search-dialog__bar">
            <i data-lucide="search"></i>
            <label for="search-input" class="visually-hidden">Search projects by title</label>
            <input id="search-input" type="search" placeholder="Search projects by title…" autocomplete="off"
                   role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list">
            <button type="button" class="icon-btn" data-search-close aria-label="Close search"><i data-lucide="x"></i></button>
          </div>
          <ul class="search-dialog__results" id="search-results" role="listbox" aria-label="Matching projects"></ul>
          <p class="search-dialog__empty" id="search-empty" role="status" aria-live="polite"></p>
        </div>
      </div>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
