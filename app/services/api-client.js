/* Clio — the only place the frontend talks to the Python backend.
   No backend is connected yet: CLIO_CONFIG.apiBase is null, so every call resolves to
   { ok: false, notConnected: true } and nothing leaves the browser.

   To connect the backend, set before the scripts load, e.g.
     <script>window.CLIO_CONFIG = { apiBase: "/api" };</script>
   and make the endpoints below accept and return JSON:
     POST {apiBase}/auth/login/    { email, password }                -> { user }
     POST {apiBase}/auth/signup/   { name, email, password }          -> { user }
     POST {apiBase}/matches/       { title, abstract, keywords }      -> { studies: [{ title, score, source, year, authors, summary, sharedTerms, difference }] }
   Errors should return a non-2xx status with { message } (and optionally { errors: { field: message } }). */
class ApiClient {
  constructor(config = window.CLIO_CONFIG || {}) {
    this.base = config.apiBase ? String(config.apiBase).replace(/\/+$/, "") : null;
    this.timeoutMs = config.timeoutMs || 15000;
  }

  get connected() {
    return Boolean(this.base);
  }

  /* Django's CSRF cookie, sent back as a header on POST. */
  csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  async post(path, body) {
    if (!this.connected) return { ok: false, notConnected: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.base}${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRFToken": this.csrfToken() },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, status: response.status, message: data.message || "The server couldn't complete the request.", errors: data.errors || {} };
      return { ok: true, data };
    } catch (error) {
      return { ok: false, message: error.name === "AbortError" ? "The server took too long to respond." : "Couldn't reach the server. Check your connection and try again." };
    } finally {
      clearTimeout(timer);
    }
  }
}

/* Clio — backend operations used by the controllers. */
class ClioApi {
  constructor(client = new ApiClient()) {
    this.client = client;
  }

  login(email, password) {
    return this.client.post("/auth/login/", { email, password });
  }

  signup(name, email, password) {
    return this.client.post("/auth/signup/", { name, email, password });
  }

  /* Related studies for a project. Until matching is connected this returns clearly labelled
     sample placeholders (isSample: true), never scores presented as real TF-IDF results. */
  async relatedStudies(project) {
    const result = await this.client.post("/matches/", { title: project.title, abstract: project.abstract, keywords: project.keywords });
    if (result.ok) return { isSample: false, studies: result.data.studies || [] };
    if (!result.notConnected) return { isSample: false, studies: [], error: result.message };
    return {
      isSample: true,
      studies: [2.1, 1.9, 1.6, 1.2, 0.6].map((score, i) => ({ title: `Related Study Title ${i + 1}`, score })),
    };
  }
}
