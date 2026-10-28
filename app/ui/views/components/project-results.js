/* Clio — Related studies results view. Shows sample placeholders until TF-IDF matching is connected (see ClioApi). */
class ProjectResults {
  constructor() {
    this.sampleNote = "Sample data — similarity matching is not implemented yet; scores are placeholders, not real TF-IDF results.";
    this.reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  }

  render() {
    return `
      <!-- Related studies results -->
      <section class="results-wrap" id="results-view" aria-label="Related studies" hidden>
        <div class="results">
          <p class="results__note">${this.sampleNote}</p>
          <ol class="results__list" id="results-list"></ol>
        </div>
      </section>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
    this.main = document.getElementById("main-content");
    this.view = document.getElementById("results-view");
    this.list = document.getElementById("results-list");
    this.note = this.view.querySelector(".results__note");
    this.formView = document.getElementById("form-view");
    this.spacer = document.querySelector(".topbar__spacer");
    this.list.addEventListener("click", (e) => {
      const head = e.target.closest(".result__head");
      if (!head) return;
      const item = head.parentElement;
      const open = item.classList.toggle("is-open");
      head.setAttribute("aria-expanded", String(open));
      item.querySelector(".result__body").hidden = !open;
    });
  }

  detail(label, value) {
    return `<div class="result__row"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  /* Sample rows: placeholder details, labelled as such. */
  sampleDetails(project) {
    return [
      ["Source", "Sample placeholder — no study database connected"],
      ["Year", "—"],
      ["Authors", "—"],
      ["Summary", "Sample placeholder — no real study was matched."],
      ["Shared terms", `Not computed. Your keywords: ${this.escape(project.keywords.join(", "))}`],
      ["How your study differs", "Available once real matching is connected."],
    ];
  }

  /* Rows returned by the backend matcher. */
  studyDetails(study) {
    const text = (value) => (value === undefined || value === null || value === "" ? "—" : this.escape(Array.isArray(value) ? value.join(", ") : value));
    return [
      ["Source", text(study.source)],
      ["Year", text(study.year)],
      ["Authors", text(study.authors)],
      ["Summary", text(study.summary)],
      ["Shared terms", text(study.sharedTerms)],
      ["How your study differs", text(study.difference)],
    ];
  }

  /* match: { isSample, studies, error? } from ClioApi.relatedStudies(). */
  show(project, match) {
    this.note.textContent = match.error || (match.isSample ? this.sampleNote : "");
    this.list.innerHTML = match.studies.map((s, i) => `
      <li class="result">
        <button type="button" class="result__head" aria-expanded="false" aria-controls="result-body-${i}">
          <span class="result__title">#${i + 1} ${this.escape(s.title)}</span>
          <span class="result__score"${match.isSample ? ' title="Placeholder score, not a real TF-IDF result"' : ""}>${this.escape(s.score)}% TF-IDF Score</span>
          <i data-lucide="chevron-down"></i>
        </button>
        <dl class="result__body" id="result-body-${i}" hidden>
          ${(match.isSample ? this.sampleDetails(project) : this.studyDetails(s)).map(([label, value]) => this.detail(label, value)).join(`
          `)}
        </dl>
      </li>
    `).join("");

    if (!this.title) {
      this.title = document.createElement("h1");
      this.title.className = "topbar__title";
      this.title.id = "topbar-title";
    }
    this.title.textContent = project.title;
    if (!this.title.isConnected) this.spacer.before(this.title);

    this.move(() => {
      this.main.classList.add("is-results");
      this.view.hidden = false;
    });
    Icons.refresh();
  }

  hide() {
    if (this.title) this.title.remove();
    this.move(() => {
      this.main.classList.remove("is-results");
      this.view.hidden = true;
    });
  }

  /* Glides the same form element from its old spot to its new one (FLIP); skipped for reduced motion. */
  move(change) {
    const before = this.formView.getBoundingClientRect();
    change();
    if (this.reduceMotion.matches || !this.formView.animate) return;
    const after = this.formView.getBoundingClientRect();
    const dx = before.left - after.left, dy = before.top - after.top;
    if (!dx && !dy) return;
    if (this.animation) this.animation.cancel();
    this.animation = this.formView.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .7, .2, 1)" });
  }

  escape(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
}
