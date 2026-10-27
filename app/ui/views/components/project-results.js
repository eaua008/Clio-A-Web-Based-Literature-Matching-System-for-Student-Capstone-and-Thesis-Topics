/* Clio — Related studies results view. Sample placeholders until TF-IDF matching is implemented. */
class ProjectResults {
  render() {
    return `
      <!-- Related studies results -->
      <section class="results-wrap" id="results-view" hidden>
        <div class="results">
          <p class="results__note">Sample data — similarity matching is not implemented yet; scores are placeholders, not real TF-IDF results.</p>
          <ol class="results__list" id="results-list"></ol>
        </div>
      </section>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
