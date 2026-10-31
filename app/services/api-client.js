/* Clio — the only place the frontend talks to the Python backend.
   CLIO_CONFIG.apiBase (core/config.js) points at the Flask backend. If it is empty, every call
   resolves to { ok: false, notConnected: true } and the page shows labelled sample studies.
   Endpoints (all JSON; errors are non-2xx with { message, errors? }):
     POST  {apiBase}/matches/                          guest match, nothing saved
     GET   {apiBase}/projects/                         signed-in user's projects
     POST  {apiBase}/projects/                         match and save
     GET   {apiBase}/projects/<id>/                    one saved project with its matches
     PATCH {apiBase}/projects/<id>/matches/<studyId>/  { relation, difference } */
class ApiClient {
  constructor(config = window.CLIO_CONFIG || {}, getToken = () => null) {
    this.base = config.apiBase ? String(config.apiBase).replace(/\/+$/, "") : null;
    this.timeoutMs = config.timeoutMs || 15000;
    this.getToken = getToken;
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

  /* Sends the Supabase access token (if signed in) so Flask knows who the user is. */
  async send(method, path, body) {
    if (!this.connected) return { ok: false, notConnected: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetch(`${this.base}${path}`, {
        method,
        credentials: "omit",
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

/* Clio — Supabase Auth over its REST API (no SDK, no extra script).
   Set supabaseUrl and supabaseAnonKey in core/config.js. The anon key is public by design; real
   protection is row level security in the database. NEVER put the service_role key in the frontend.
   The session lives in memory only (never localStorage / cookies), so a page reload signs the user out
   and a script injected later can't read a stored token. Errors are reworded on purpose so the
   messages never reveal whether an email address already has an account. */
class SupabaseAuth {
  constructor(config = window.CLIO_CONFIG || {}) {
    const url = String(config.supabaseUrl || "").trim().replace(/\/+$/, "");
    this.url = /^https:\/\/[^\s/]+$/i.test(url) ? url : null;
    this.key = String(config.supabaseAnonKey || "").trim() || null;
    this.timeoutMs = config.timeoutMs || 15000;
    this.session = null;
  }

  get connected() {
    return Boolean(this.url && this.key);
  }

  get signedIn() {
    return Boolean(this.session);
  }

  async call(path, body, token, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json", apikey: this.key, ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      const method = options.method || "POST";
      const response = await fetch(`${this.url}${path}`, {
        method, headers, body: method === "GET" ? undefined : JSON.stringify(body || {}),
        credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      return response.ok ? { ok: true, data } : { ok: false, status: response.status, data };
    } catch (error) {
      return { ok: false, network: true, aborted: error.name === "AbortError" };
    } finally {
      clearTimeout(timer);
    }
  }

  /* Turns a failed response into { ok:false, message, errors } for the form. */
  fail(result, view) {
    if (result.network) return { ok: false, message: result.aborted ? "The server took too long to respond." : "Couldn't reach the server. Check your connection and try again." };
    const code = String((result.data && (result.data.error_code || result.data.error)) || "");
    if (result.status === 429 || /rate_limit/.test(code)) return { ok: false, message: "Too many attempts. Please wait a minute and try again." };
    if (code === "email_not_confirmed") return { ok: false, message: "Confirm your email first. We sent you a link when you signed up." };
    if (code === "weak_password") return { ok: false, message: "That password is too weak.", errors: { password: "Choose a stronger password: at least 8 characters, not only numbers." } };
    if (code === "signup_disabled") return { ok: false, message: "New sign-ups are turned off right now." };
    if (view === "login") return { ok: false, message: "Incorrect email or password." };
    if (result.status >= 500) return { ok: false, message: "The server couldn't complete the request." };
    return { ok: false, message: "We couldn't create an account with those details. If you already have one, sign in instead." };
  }

  /* Keeps the tokens in memory and returns only what the UI needs. */
  adopt(data) {
    this.session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    const user = data.user || {};
    const meta = user.user_metadata || {};
    return { id: user.id, email: user.email || "", name: String(meta.full_name || "").trim() };
  }

  async login(email, password) {
    const result = await this.call("/auth/v1/token?grant_type=password", { email, password });
    if (!result.ok) return this.fail(result, "login");
    return { ok: true, data: { user: this.adopt(result.data) } };
  }

  async signup(name, email, password) {
    const result = await this.call("/auth/v1/signup", { email, password, data: { full_name: name } });
    if (!result.ok) return this.fail(result, "signup");
    if (result.data.access_token) return { ok: true, data: { user: this.adopt(result.data) } };
    return { ok: true, data: { user: null, needsConfirmation: true } };
  }

  async logout() {
    const token = this.session && this.session.accessToken;
    this.session = null;
    if (token) await this.call("/auth/v1/logout?scope=local", {}, token);
    return { ok: true };
  }
}

/* Clio — backend operations used by the controllers. */
class ClioApi {
  constructor(auth = new SupabaseAuth(), client = new ApiClient(window.CLIO_CONFIG || {}, () => auth.session && auth.session.accessToken)) {
    this.client = client;
    this.auth = auth;
  }

  login(email, password) {
    if (this.auth.connected) return this.auth.login(email, password);
    return this.client.post("/auth/login/", { email, password });
  }

  signup(name, email, password) {
    if (this.auth.connected) return this.auth.signup(name, email, password);
    return this.client.post("/auth/signup/", { name, email, password });
  }

  logout() {
    return this.auth.connected ? this.auth.logout() : Promise.resolve({ ok: true });
  }

  get signedIn() {
    return this.auth.connected && this.auth.signedIn;
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