/* Clio — Project detail view. */
class ProjectDetail {
  render() {
    return `
      <!-- Project detail -->
      <section class="panel-wrap" id="detail-view" hidden>
        <article class="panel project-detail">
          <header class="project-detail__head">
            <h1 class="panel__title" id="detail-title"></h1>
            <div class="project-detail__actions">
              <button type="button" class="btn btn--small btn--outline" id="detail-edit"><i data-lucide="pencil"></i> Edit</button>
              <button type="button" class="btn btn--small btn--danger" id="detail-delete"><i data-lucide="trash-2"></i> Delete</button>
            </div>
          </header>
          <p class="project-detail__meta" id="detail-meta"></p>
          <h2 class="project-detail__label">Detailed Abstract / Technical Summary</h2>
          <p class="project-detail__abstract" id="detail-abstract"></p>
          <h2 class="project-detail__label">Key Domain Terms &amp; Keywords</h2>
          <ul class="tags" id="detail-tags"></ul>
        </article>
      </section>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
