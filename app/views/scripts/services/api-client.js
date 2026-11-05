/* Clio — the only place the frontend talks to the Python backend.
   CLIO_CONFIG.apiBase (scripts/config.js) points at the Flask backend. If it is empty, every call
   resolves to { ok: false, notConnected: true } and the page shows an error.

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
     PUT   {apiBase}/projects/<id>/                    match the edited project again, keep its labels
     DELETE {apiBase}/projects/<id>/                   delete a project and its matches
     PATCH {apiBase}/projects/<id>/matches/<studyId>/  { relation, difference } */
class ApiClient {
  constructor(config = window.CLIO_CONFIG || {}) {
    this.base = config.apiBase ? String(config.apiBase).replace(/\/+$/, "") : null;
    this.timeoutMs = config.timeoutMs || 30000;
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

  put(path, body) {
    return this.send("PUT", path, body);
  }

  delete(path) {
    return this.send("DELETE", path);
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

/* Clio — backend operations used by the controllers.
   Flask first. When the page is served without Flask (GitHub Pages, Live Preview), restore() finds
   that {apiBase}/auth/me/ doesn't answer and every call goes to SupabaseDirect (scripts/services/supabase-direct.js)
   instead, which talks to Supabase straight from the browser. */
class ClioApi {
  constructor(client = new ApiClient(), fallback = typeof SupabaseDirect === "function" ? new SupabaseDirect() : null) {
    this.client = client;
    this.user = null;
    this.fallback = fallback && fallback.connected ? fallback : null;
    this.direct = !client.connected ? this.fallback : null;
  }

  get connected() {
    return this.client.connected || Boolean(this.fallback);
  }

  get signedIn() {
    return this.direct ? this.direct.signedIn : Boolean(this.user);
  }

  /* True when Flask answers {apiBase}/auth/me/ with JSON; a static host answers 404/405 or an HTML page. */
  async flaskAnswers() {
    if (!this.client.connected) return false;
    try {
      const response = await fetch(`${this.client.base}/auth/me/`, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
      return response.ok && (response.headers.get("content-type") || "").includes("application/json");
    } catch (error) {
      return false;
    }
  }

  /* Remembers the user from a successful login or sign-up response. */
  adopt(result) {
    if (result.ok && result.data && result.data.user) this.user = result.data.user;
    return result;
  }

  async login(email, password) {
    if (this.direct) return this.direct.login(email, password);
    return this.adopt(await this.client.post("/auth/login/", { email, password }));
  }

  async signup(name, email, password) {
    if (this.direct) return this.direct.signup(name, email, password);
    return this.adopt(await this.client.post("/auth/signup/", { name, email, password }));
  }

  async logout() {
    if (this.direct) return this.direct.logout();
    this.user = null;
    await this.client.post("/auth/logout/", {});
    return { ok: true };
  }

  /* On page load: asks Flask whether the cookies still hold a session. Returns the user or null. */
  async restore() {
    if (!this.direct && this.fallback && !(await this.flaskAnswers())) this.direct = this.fallback;
    if (this.direct) return this.direct.restore();
    const result = await this.client.get("/auth/me/");
    this.user = result.ok && result.data.user ? result.data.user : null;
    return this.user;
  }

  /* Related studies for a project, or { studies: [], error } when matching can't be reached. */
  async relatedStudies(project, savedId = null) {
    if (this.direct) return this.direct.relatedStudies(project, savedId);
    const body = { title: project.title, abstract: project.abstract, keywords: project.keywords, limit: 30 };
    /* Signed in: the backend matches AND saves the project (updating savedId when given). Guest: it only matches. */
    const result = !this.signedIn ? await this.client.post("/matches/", body)
      : savedId ? await this.client.put(`/projects/${encodeURIComponent(savedId)}/`, body)
      : await this.client.post("/projects/", body);
    if (result.ok) return { studies: result.data.studies || [], projectId: result.data.project ? result.data.project.id : null };
    return { studies: [], error: result.notConnected ? "No matching service is configured, so related studies can't be loaded." : result.message, errors: result.errors || {} };
  }

  /* The signed-in user's saved projects: [{ id, title, createdAt }]. */
  async listProjects() {
    if (this.direct) return this.direct.listProjects();
    const result = await this.client.get("/projects/");
    return result.ok ? result.data.projects || [] : [];
  }

  /* One saved project with its matches, in the same shape as relatedStudies(). */
  async loadProject(id) {
    if (this.direct) return this.direct.loadProject(id);
    const result = await this.client.get(`/projects/${encodeURIComponent(id)}/`);
    if (!result.ok) return { error: result.message };
    return { project: result.data.project, match: { studies: result.data.studies || [], projectId: id } };
  }

  /* Deletes a saved project and its matches. Returns { ok } or { ok: false, message }. */
  async deleteProject(id) {
    if (this.direct) return this.direct.deleteProject(id);
    const result = await this.client.delete(`/projects/${encodeURIComponent(id)}/`);
    return result.ok ? { ok: true } : result;
  }

  /* Saves the relevance label and/or the "how my work differs" note. Returns { ok, warnings, message, errors }. */
  async saveLabel(projectId, studyId, changes) {
    if (this.direct) return this.direct.saveLabel(projectId, studyId, changes);
    const result = await this.client.patch(`/projects/${encodeURIComponent(projectId)}/matches/${encodeURIComponent(studyId)}/`, changes);
    return result.ok ? { ok: true, warnings: result.data.warnings || [] } : result;
  }
}