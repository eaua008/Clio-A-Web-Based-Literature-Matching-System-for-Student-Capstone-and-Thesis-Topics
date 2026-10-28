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
      const rel = e.target.closest(".result__rel");
      if (rel) {
        const pressed = rel.getAttribute("aria-pressed") !== "true";
        rel.parentElement.querySelectorAll(".result__rel").forEach((b) => b.setAttribute("aria-pressed", String(b === rel && pressed)));
        return;
      }
      const copy = e.target.closest("[data-copy-citation]");
      if (copy) {
        const label = copy.querySelector("span");
        if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.citation).then(() => {
          label.textContent = "Copied";
          setTimeout(() => { label.textContent = "Copy citation"; }, 1500);
        }).catch(() => {});
        return;
      }
      const head = e.target.closest(".result__head");
      if (!head) return;
      const item = head.parentElement;
      const open = item.classList.toggle("is-open");
      head.setAttribute("aria-expanded", String(open));
      item.querySelector(".result__body").hidden = !open;
    });
  }

    /* Header wording; a backend can send its own study.similarity. */
  similarity(study) {
    if (study.similarity) return this.escape(study.similarity);
    const score = Number(study.score);
    return score >= 50 ? "High similarity" : score >= 20 ? "Medium similarity" : "Low similarity";
  }

  /* Wraps the shared terms found in the abstract in <mark>; the text is escaped piece by piece. */
  highlight(text, terms) {
    if (!text) return "—";
    if (!terms.length) return this.escape(text);
    const pattern = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
    return text.split(pattern).map((part, n) => (n % 2 ? `<mark>${this.escape(part)}</mark>` : this.escape(part))).join("");
  }

  body(study, project, isSample, i) {
    const val = (v) => (v === undefined || v === null || v === "" ? "—" : this.escape(Array.isArray(v) ? v.join(", ") : v));
    const abstract = String(study.abstract || study.summary || "");
    const words = [...new Set(project.keywords.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
    const given = Array.isArray(study.sharedTerms) ? study.sharedTerms : (study.sharedTerms ? String(study.sharedTerms).split(/\s*,\s*/) : null);
    const shared = given || words.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(abstract));
    const missing = words.filter((w) => !shared.some((t) => t.toLowerCase() === w));
    const details = study.details || {};
    const chips = (list, cls) => list.map((t) => `<span class="${cls}">${this.escape(t)}</span>`).join("");
    const citation = !isSample && study.title ? [study.authors, study.year ? `(${study.year})` : "", `${study.title}.`, study.source ? `${study.source}.` : ""].filter(Boolean).join(" ") : "";
    const url = /^https?:\/\//i.test(study.url || "") ? study.url : "";
    const soon = ' disabled title="Available once real matching is connected"';
    return `
      <div class="result__flag"><span class="result__flag-label">Why flagged (shared terms):</span>${shared.length ? chips(shared, "result__term") : `<span class="result__none">${isSample ? "Not computed yet" : "None"}</span>`}</div>
      <div class="result__meta">
        ${study.source ? `<span class="result__chip">${this.escape(study.source)}</span>` : ""}
        ${study.kind ? `<span class="result__chip result__chip--line">${this.escape(study.kind)}</span>` : ""}
        ${study.year ? `<span class="result__dot">${this.escape(study.year)}</span>` : ""}
        ${study.authors ? `<span class="result__dot">${this.escape(study.authors)}</span>` : ""}
        ${isSample ? '<span class="result__badge">Sample placeholder — not a real study</span>' : ""}
      </div>
      <div>
        <p class="result__label">Abstract</p>
        <p class="result__abstract">${this.highlight(abstract, shared)}</p>
      </div>
      <div class="result__panels">
        <div class="result__panel">
          <p class="result__label">In your project, not in this study</p>
          <div class="result__tags">${missing.length ? chips(missing, "result__tag") : '<span class="result__none">None</span>'}</div>
          <p class="result__hint">These are candidates for your difference argument.</p>
        </div>
        <div class="result__panel">
          <p class="result__label">Details</p>
          <dl class="result__details">
            <div><dt>Study type</dt><dd>${val(details.studyType)}</dd></div>
            <div><dt>Cited by</dt><dd>${val(details.citedBy)}</dd></div>
            <div><dt>Access</dt><dd>${val(details.access)}</dd></div>
            <div><dt>Setting</dt><dd>${val(details.setting)}</dd></div>
          </dl>
        </div>
      </div>
      <div>
        <p class="result__label" id="result-rel-${i}">How does this relate to your project?</p>
        <div class="result__rels" role="group" aria-labelledby="result-rel-${i}">
          ${["Duplicate", "Similar", "Related background", "Not relevant"].map((r) => `<button type="button" class="result__rel" aria-pressed="false">${r}</button>`).join("")}
        </div>
      </div>
      <div>
        <label class="result__diff-label" for="result-diff-${i}">How My Work Differs (Student Defense Argument):</label>
        <textarea class="result__diff" id="result-diff-${i}" rows="3" placeholder="e.g. While this paper uses high-pressure pneumatic solenoids, our project develops a low-power micro-stepper flipper gate that runs on an 18W solar battery for...">${study.difference && !isSample ? this.escape(study.difference) : ""}</textarea>
      </div>
      <div class="result__actions">
        ${url ? `<a class="result__btn result__btn--primary" href="${this.escape(url)}" target="_blank" rel="noopener noreferrer"><span>Open source</span><i data-lucide="external-link"></i></a>` : `<button type="button" class="result__btn result__btn--primary"${soon}><span>Open source</span><i data-lucide="external-link"></i></button>`}
        <button type="button" class="result__btn" data-copy-citation data-citation="${this.escape(citation)}"${citation ? "" : soon}><i data-lucide="copy"></i><span>Copy citation</span></button>
        <button type="button" class="result__btn"${soon}>Find more like this</button>
        <button type="button" class="result__btn"${soon}>Add to literature review</button>
      </div>
      <p class="result__foot">Matching is by shared wording (TF-IDF). A high score means similar text, not proof of duplication. Patent results are not a legal opinion on patentability.</p>
    `;
  }

  /* match: { isSample, studies, error? } from ClioApi.relatedStudies(). */
  show(project, match) {
    this.note.textContent = match.error || (match.isSample ? this.sampleNote : "");
    this.list.innerHTML = match.studies.map((s, i) => `
      <li class="result">
        <button type="button" class="result__head" aria-expanded="false" aria-controls="result-body-${i}">
          <span class="result__title">#${i + 1} ${this.escape(s.title)}</span>
          <span class="result__sim">${this.similarity(s)}</span>
          <span class="result__score"${match.isSample ? ' title="Placeholder score, not a real TF-IDF result"' : ""}>${this.escape(s.score)}% TF-IDF Score</span>
          <i data-lucide="chevron-down"></i>
        </button>
        <div class="result__body" id="result-body-${i}" hidden>
          ${this.body(s, project, match.isSample, i)}
        </div>
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
