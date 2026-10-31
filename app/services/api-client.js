/* Clio — the only place the frontend talks to the Python backend.
   CLIO_CONFIG.apiBase (core/config.js) points at the Flask backend. If it is empty, every call
   resolves to { ok: false, notConnected: true } and the page shows labelled sample studies.

   Sign-in goes through Flask too. Flask keeps the session in HttpOnly cookies, so page scripts never
   see a token and a page refresh keeps the user signed in. Every write sends the X-Clio-Request
   header; Flask refuses writes without it, so other websites can't use the cookies.

   Endpoints (all JSON; errors are non-2xx with { message, errors? }):
     POST  {apiBase}/auth/login/                       { email, password } -> { user }
     POST  {apiBase}/auth/signup/                      { name, email, password } -> { user } or { needsConfirmation }
     POST  {apiBase}/auth/logout/
     GET   {apiBase}/auth/me/                          -> { user } (null when signed out)
     POST  {apiBase}/matches/                          guest match, nothing saved
     GET   {apiBase}/projects/                         signed-in user's projects
     POST  {apiBase}/projects/                         match and save
     GET   {apiBase}/projects/<id>/                    one saved project with its matches
     PATCH {apiBase}/projects/<id>/matches/<studyId>/  { relation, difference } */
class ApiClient {
  constructor(config = window.CLIO_CONFIG || {}) {
    this.base = config.apiBase ? String(config.apiBase).replace(/\/+$/, "") : null;
    this.timeoutMs = config.timeoutMs || 15000;
  }

  get connected() {
    return Boolean(this.base);
  }

  get(path) {
    return this.send("GET", path);
  }

  post(path, body) {
    return this.send("POST", path, body);
  }

  patch(path, body) {
    return this.send("PATCH", path, body);
  }

  async send(method, path, body) {
    if (!this.connected) return { ok: false, notConnected: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = { Accept: "application/json" };
    if (method !== "GET") headers["X-Clio-Request"] = "1";
    if (body !== undefined) headers["Content-Type"] = "application/json";
    try {
      const response = await fetch(`${this.base}${path}`, {
        method,
        credentials: "same-origin", /* sends the session cookies to our own backend only */
        cache: "no-store",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
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
    this.user = null;
  }

  get connected() {
    return this.client.connected;
  }

  get signedIn() {
    return Boolean(this.user);
  }

  /* Remembers the user from a successful login or sign-up response. */
  adopt(result) {
    if (result.ok && result.data && result.data.user) this.user = result.data.user;
    return result;
  }

  async login(email, password) {
    return this.adopt(await this.client.post("/auth/login/", { email, password }));
  }

  async signup(name, email, password) {
    return this.adopt(await this.client.post("/auth/signup/", { name, email, password }));
  }

  async logout() {
    this.user = null;
    await this.client.post("/auth/logout/", {});
    return { ok: true };
  }

  /* On page load: asks Flask whether the cookies still hold a session. Returns the user or null. */
  async restore() {
    const result = await this.client.get("/auth/me/");
    this.user = result.ok && result.data.user ? result.data.user : null;
    return this.user;
  }

  /* Related studies for a project. Until matching is connected this returns clearly labelled
     sample placeholders (isSample: true), never scores presented as real TF-IDF results. */
  async relatedStudies(project) {
    const body = { title: project.title, abstract: project.abstract, keywords: project.keywords };
    /* Signed in: the backend matches AND saves the project. Guest: it only matches. */
    const result = await this.client.post(this.signedIn ? "/projects/" : "/matches/", body);
    if (result.ok) return { isSample: false, studies: result.data.studies || [], projectId: result.data.project ? result.data.project.id : null };
    if (!result.notConnected) return { isSample: false, studies: [], error: result.message, errors: result.errors || {} };
    return {
      isSample: true,
      studies: [
        ["Soil-Moisture Irrigation Controller", 2.1],
        ["Sensor-Based Greenhouse Water Management", 1.9],
        ["Solar-Powered Pump for Small Farms", 1.6],
        ["Wi-Fi Crop Monitoring Dashboard", 1.2],
        ["Low-Cost Weather Station for Agriculture", 0.6],
      ].map(([name, score], i) => ({
        title: `Sample Study ${i + 1}: ${name}`,
        score,
        source: "Local School Theses",
        kind: "Sample",
        year: 2022,
        authors: "Sample author",
        abstract: "Sample placeholder text. A real abstract from the matched study will appear here once matching is connected.",
        details: { studyType: "Not stated", citedBy: "—", access: "Not stated", setting: "Not stated" },
      })),
    };
  }

  /* The signed-in user's saved projects: [{ id, title, createdAt }]. */
  async listProjects() {
    const result = await this.client.get("/projects/");
    return result.ok ? result.data.projects || [] : [];
  }

  /* One saved project with its matches, in the same shape as relatedStudies(). */
  async loadProject(id) {
    const result = await this.client.get(`/projects/${encodeURIComponent(id)}/`);
    if (!result.ok) return { error: result.message };
    return { project: result.data.project, match: { isSample: false, studies: result.data.studies || [], projectId: id } };
  }

  /* Saves the relevance label and/or the "how my work differs" note. Returns { ok, warnings, message, errors }. */
  async saveLabel(projectId, studyId, changes) {
    const result = await this.client.patch(`/projects/${encodeURIComponent(projectId)}/matches/${encodeURIComponent(studyId)}/`, changes);
    return result.ok ? { ok: true, warnings: result.data.warnings || [] } : result;
  }
}