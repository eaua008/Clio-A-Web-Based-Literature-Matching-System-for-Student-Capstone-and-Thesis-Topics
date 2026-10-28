/* Clio — Enter button: keyword tags, word count, validation, then shows the related studies results. */
class EnterButton {
  constructor(results, nav, api) {
    this.results = results;
    this.nav = nav;
    this.api = api;
    this.busy = false;
    this.minWords = 50;
    this.abstract = document.getElementById("abstract");
    this.wordCount = document.getElementById("word-count");
    this.form = document.getElementById("project-form");
    this.tagList = document.getElementById("tag-list");
    this.keywordInput = document.getElementById("keyword-input");
    this.addButton = document.getElementById("tag-add");
  }

  bind() {
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });
    document.getElementById("form-secondary").addEventListener("click", () => this.clear());
    this.abstract.addEventListener("input", () => this.countWords());

    this.keywordInput.addEventListener("input", () => { this.addButton.hidden = !this.keywordInput.value.trim(); });
    this.keywordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.keywordInput.value.trim()) { e.preventDefault(); this.addTyped(); }
      if (e.key === "Backspace" && !this.keywordInput.value && this.tagList.lastElementChild) this.tagList.lastElementChild.remove();
    });
    this.addButton.addEventListener("click", () => { this.addTyped(); this.keywordInput.focus(); });
    this.tagList.addEventListener("click", (e) => {
      const remove = e.target.closest(".tag__remove");
      if (remove) { remove.closest("li").remove(); this.keywordInput.focus(); }
    });
    this.countWords();
  }

  async submit() {
    if (this.busy) return;
    const project = this.read();
    if (!this.validate(project)) return;
    if (this.keywordInput.value.trim()) this.addTyped();
    this.busy = true;
    try {
      const match = await this.api.relatedStudies(project);
      this.results.show(project, match);
      this.nav.add(project, match);
    } finally {
      this.busy = false;
    }
  }

  words(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  countWords() {
    const count = this.words(this.abstract.value);
    const el = this.wordCount;
    el.textContent = `${count} / ${this.minWords} words`;
    el.classList.toggle("is-low", count > 0 && count < this.minWords);
    el.classList.toggle("is-ok", count >= this.minWords);
  }

  tags() {
    return [...this.tagList.querySelectorAll("li")].map((li) => li.dataset.keyword);
  }

  addTag(keyword) {
    if (this.tags().some((k) => k.toLowerCase() === keyword.toLowerCase())) return;
    const li = document.createElement("li");
    li.className = "tag tag--removable";
    li.dataset.keyword = keyword;
    li.innerHTML = `<span></span><button type="button" class="tag__remove"><i data-lucide="x"></i></button>`;
    li.querySelector("span").textContent = keyword;
    li.querySelector("button").setAttribute("aria-label", `Remove keyword ${keyword}`);
    this.tagList.append(li);
    Icons.refresh();
  }

  addTyped() {
    this.keywordInput.value.split(",").map((k) => k.trim()).filter(Boolean).forEach((k) => this.addTag(k));
    this.keywordInput.value = "";
    this.addButton.hidden = true;
    this.setError("keywords", "");
  }

  read() {
    const typed = this.keywordInput.value.split(",").map((k) => k.trim());
    return {
      title: document.getElementById("title").value.trim(),
      abstract: document.getElementById("abstract").value.trim(),
      keywords: [...new Set([...this.tags(), ...typed].filter(Boolean))],
    };
  }

  /* Fills the form from a project; used when a sidebar entry is selected. */
  fill(project) {
    document.getElementById("title").value = project.title;
    document.getElementById("abstract").value = project.abstract;
    this.tagList.innerHTML = "";
    project.keywords.forEach((k) => this.addTag(k));
    this.keywordInput.value = "";
    this.addButton.hidden = true;
    this.countWords();
    ["title", "abstract", "keywords"].forEach((name) => this.setError(name, ""));
  }

  clear() {
    this.fill({ title: "", abstract: "", keywords: [] });
    this.results.hide();
    this.nav.select(null);
    document.getElementById("title").focus();
  }

  setError(name, message) {
    const el = document.querySelector(`[data-error-for="${name}"]`);
    el.textContent = message;
    el.closest(".field").classList.toggle("field--invalid", Boolean(message));
    document.getElementById(name === "keywords" ? "keyword-input" : name).setAttribute("aria-invalid", String(Boolean(message)));
  }

  validate(project) {
    const words = this.words(project.abstract);
    const errors = {
      title: project.title ? "" : "Please enter a project / capstone title.",
      abstract: !project.abstract ? "Please enter a detailed abstract / technical summary."
        : words < this.minWords ? `Abstract must be at least ${this.minWords} words (currently ${words}).` : "",
      keywords: project.keywords.length ? "" : "Please enter at least one key domain term or keyword.",
    };
    Object.entries(errors).forEach(([name, message]) => this.setError(name, message));
    const first = Object.keys(errors).find((name) => errors[name]);
    if (first) document.getElementById(first === "keywords" ? "keyword-input" : first).focus();
    return !first;
  }
}
