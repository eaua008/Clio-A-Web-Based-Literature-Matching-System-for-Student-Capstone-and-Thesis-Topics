/* Clio — New / edit project form. */
class ProjectForm {
  render() {
    return `
      <!-- New / edit project form -->
      <section class="panel-wrap" id="form-view">
        <form class="panel project-form" id="project-form" novalidate>
          <h1 class="visually-hidden" id="form-title">New Project</h1>

          <div class="field">
            <label for="title">Project / Capstone Title <span class="req" aria-hidden="true">*</span></label>
            <input type="text" id="title" name="title" maxlength="200" autocomplete="off" required
                   placeholder="e.g. Low-Cost Opto-Mechanical Seedling and Grain Sorter" aria-describedby="title-error">
            <p class="field__error" id="title-error" data-error-for="title"></p>
          </div>

          <div class="field">
            <label for="abstract">Detailed Abstract / Technical Summary <span class="req" aria-hidden="true">*</span></label>
            <textarea id="abstract" name="abstract" rows="7" maxlength="10000" required
                      placeholder="Enter your comprehensive project abstract here. The abstracts must be at least 50 words, because too little text produces meaningless matches. Describe the concrete problem, components, sensors, mechanism, algorithms, and performance goals…"
                      aria-describedby="abstract-meta abstract-error"></textarea>
            <div class="field__meta" id="abstract-meta">
              <span class="word-hint" id="word-hint">
                <i data-lucide="info"></i>
                Please write at least 50 words to ensure the TF-IDF vectorizer has sufficient lexical depth.
              </span>
              <span class="word-count visually-hidden" id="word-count" aria-live="polite">0 / 50 words</span>
            </div>
            <p class="field__error" id="abstract-error" data-error-for="abstract"></p>
          </div>

          <div class="field">
            <label for="keyword-input">Key Domain Terms &amp; Keywords <span class="req" aria-hidden="true">*</span></label>
            <div class="keyword-box">
              <ul class="tags" id="tag-list" aria-label="Added keywords"></ul>
              <div class="keyword-entry">
                <input type="text" id="keyword-input" maxlength="50" autocomplete="off"
                       placeholder="Type keyword and press Add (e.g. grain sorter, optical sensor)" aria-describedby="keywords-help keywords-error">
                <button type="button" class="btn btn--primary btn--small" id="tag-add" hidden>Add</button>
              </div>
            </div>
            <p class="field__help visually-hidden" id="keywords-help">Press Enter or click Add to add each keyword.</p>
            <p class="field__error" id="keywords-error" data-error-for="keywords"></p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn--primary btn--small btn--wide" id="form-submit">Enter</button>
            <button type="button" class="btn btn--primary btn--small btn--wide" id="form-secondary">Clear</button>
          </div>
        </form>
      </section>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
