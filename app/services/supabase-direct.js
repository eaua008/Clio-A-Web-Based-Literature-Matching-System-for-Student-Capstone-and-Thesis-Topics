/* Clio — the same operations as the Flask backend, done straight against Supabase from the browser.
   Used when the page is served without Flask (GitHub Pages, Live Preview): ClioApi switches to it on
   page load when {apiBase}/auth/me/ doesn't answer.

   - Sign-in: Supabase Auth REST with the public anon/publishable key from core/config.js.
   - Data: PostgREST as the signed-in user, so row level security allows only their own rows.
   - Matching: the TF-IDF function match_studies() in the database (database/03_functions.sql).
   The session is kept in sessionStorage, so a refresh keeps the user signed in and closing the tab
   signs them out. NEVER put the service_role key in the frontend. */
class SupabaseDirect {
  static RELATIONS = ["Duplicate", "Similar", "Related background", "Not relevant"];
  static MAX_NOTE = 5000;
  static STORE = "clio.session";
  static STUDY = "id,title,source_type,source_name,year,authors,abstract,keywords,url,study_type,cited_by,access,setting";
  static KINDS = { paper: "Paper", patent: "Patent", github: "GitHub project", local_thesis: "Local thesis" };

  constructor(config = window.CLIO_CONFIG || {}) {
    const url = String(config.supabaseUrl || "").trim().replace(/\/+$/, "");
    this.url = /^https:\/\/[^\s/]+$/i.test(url) ? url : null;
    this.key = String(config.supabaseAnonKey || "").trim() || null;
    this.timeoutMs = config.timeoutMs || 15000;
    this.session = null;
    this.user = null;
    this.scores = {}; /* projectId -> { studyId: score }, for the label warnings */
  }

  get connected() {
    return Boolean(this.url && this.key);
  }

  get signedIn() {
    return Boolean(this.user);
  }

  async call(method, path, body, token, prefer) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = { Accept: "application/json", apikey: this.key };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    try {
      const response = await fetch(`${this.url}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      return response.ok ? { ok: true, data } : { ok: false, status: response.status, data: data || {} };
    } catch (error) {
      return { ok: false, network: true, aborted: error.name === "AbortError" };
    } finally {
      clearTimeout(timer);
    }
  }

  failure(result, fallback) {
    if (result.network) return { ok: false, message: result.aborted ? "The server took too long to respond." : "Couldn't reach the server. Check your connection and try again." };
    if (result.status === 429) return { ok: false, message: "Too many attempts. Please wait a minute and try again." };
    return { ok: false, status: result.status, message: fallback, errors: {} };
  }

  /* ---- session ---- */

  remember(data) {
    this.session = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
    const user = data.user || {};
    const meta = user.user_metadata || {};
    this.user = { id: user.id, email: user.email || "", name: String(meta.full_name || "").trim() };
    try { sessionStorage.setItem(SupabaseDirect.STORE, JSON.stringify({ refreshToken: this.session.refreshToken })); } catch (e) { /* storage blocked: memory only */ }
    return this.user;
  }

  forget() {
    this.session = null;
    this.user = null;
    try { sessionStorage.removeItem(SupabaseDirect.STORE); } catch (e) { /* nothing stored */ }
  }

  async refresh(refreshToken) {
    const result = await this.call("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: refreshToken });
    if (result.ok && result.data.access_token) { this.remember(result.data); return true; }
    if (!result.network) this.forget();
    return false;
  }

  /* The access token, renewed a minute before it expires (one renewal at a time). */
  async token() {
    if (!this.session) return null;
    if (Date.now() < this.session.expiresAt - 60000) return this.session.accessToken;
    this.renewing = this.renewing || this.refresh(this.session.refreshToken).finally(() => { this.renewing = null; });
    await this.renewing;
    return this.session ? this.session.accessToken : null;
  }

  async rest(method, path, body, prefer) {
    const token = await this.token();
    if (!token) return { ok: false, status: 401, data: {} };
    return this.call(method, `/rest/v1${path}`, body, token, prefer);
  }

  /* ---- auth: same results as the Flask /api/auth/ endpoints ---- */

  async login(email, password) {
    const result = await this.call("POST", "/auth/v1/token?grant_type=password", { email, password });
    if (result.ok) return { ok: true, data: { user: this.remember(result.data) } };
    const code = String((result.data && (result.data.error_code || result.data.error)) || "");
    if (code === "email_not_confirmed") return { ok: false, message: "Confirm your email first. We sent you a link when you signed up.", errors: {} };
    if (result.status === 400) return { ok: false, message: "Incorrect email or password.", errors: {} };
    return this.failure(result, "Sign-in failed. Please try again.");
  }

  async signup(name, email, password) {
    const result = await this.call("POST", "/auth/v1/signup", { email, password, data: { full_name: name } });
    if (result.ok) {
      if (result.data.access_token) return { ok: true, data: { user: this.remember(result.data) } };
      return { ok: true, data: { user: null, needsConfirmation: true } };
    }
    const code = String((result.data && (result.data.error_code || result.data.error)) || "");
    if (code === "weak_password") return { ok: false, message: "That password is too weak.", errors: { password: "Choose a stronger password: at least 8 characters, not only numbers." } };
    if (code === "signup_disabled") return { ok: false, message: "New sign-ups are turned off right now.", errors: {} };
    if (result.status === 400 || result.status === 422) return { ok: false, message: "We couldn't create an account with those details. If you already have one, sign in instead.", errors: {} };
    return this.failure(result, "Sign-up failed. Please try again.");
  }

  async logout() {
    const token = this.session && this.session.accessToken;
    this.forget();
    if (token) await this.call("POST", "/auth/v1/logout?scope=local", {}, token);
    return { ok: true };
  }

  async restore() {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(SupabaseDirect.STORE) || "null"); } catch (e) { stored = null; }
    if (stored && stored.refreshToken) await this.refresh(stored.refreshToken);
    return this.user;
  }

  /* ---- matching and projects ---- */

  /* Same rules and messages as app/services/validation.py. */
  validate(project) {
    const title = String(project.title || "").trim();
    const abstract = String(project.abstract || "").trim();
    const seen = new Set();
    const keywords = (project.keywords || []).map((k) => String(k).trim())
      .filter((k) => k && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()));
    const words = abstract ? abstract.split(/\s+/).length : 0;
    const errors = {};
    if (!title) errors.title = "Please enter a project / capstone title.";
    else if (title.length > 200) errors.title = "Title must be 200 characters or fewer.";
    if (!abstract) errors.abstract = "Please enter a detailed abstract / technical summary.";
    else if (words < 50) errors.abstract = `Abstract must be at least 50 words (currently ${words}).`;
    else if (abstract.length > 10000) errors.abstract = "Abstract must be 10000 characters or fewer.";
    if (!keywords.length) errors.keywords = "Please enter at least one key domain term or keyword.";
    else if (keywords.length > 30) errors.keywords = "Use at most 30 keywords.";
    else if (keywords.some((k) => k.length > 50)) errors.keywords = "Each keyword must be 50 characters or fewer.";
    return { data: { title, abstract, keywords }, errors };
  }

  similarity(score) {
    return score >= 50 ? "High similarity" : score >= 20 ? "Medium similarity" : "Low similarity";
  }

  /* Keyword words that never appear in the study (a light stem: "sensors" matches "sensor"). */
  missingTerms(study, keywords) {
    const text = `${study.title || ""} ${study.abstract || ""} ${(study.keywords || []).join(" ")}`.toLowerCase();
    const words = [...new Set(keywords.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
    return words.filter((w) => !new RegExp(`\\b${w.replace(/(es|s)$/, "")}`).test(text)).slice(0, 8);
  }

  /* One study in the shape app/views/match_view.py StudyMatchView sends. */
  shape(s, keywords, saved = {}) {
    const score = Number(s.score);
    return {
      studyId: s.study_id || s.id,
      title: String(s.title || ""),
      score,
      similarity: s.similarity || this.similarity(score),
      source: s.source || s.source_name || "",
      kind: SupabaseDirect.KINDS[s.kind || s.source_type] || "Study",
      year: s.year || "",
      authors: Array.isArray(s.authors) ? s.authors.join(", ") : s.authors || "",
      abstract: s.abstract || "",
      sharedTerms: s.shared_terms || saved.shared_terms || [],
      missingTerms: this.missingTerms(s, keywords),
      url: s.url || "",
      relation: saved.relation || null,
      difference: saved.difference || "",
      details: { studyType: s.study_type || "Not stated", citedBy: s.cited_by == null ? "—" : s.cited_by, access: s.access || "Not stated", setting: s.setting || "Not stated" },
    };
  }

  /* Guest: match only. Signed in: match, then save the project and its matches (like POST /api/projects/),
     or, with savedId, replace that project's text and matches and keep its labels (like PUT /api/projects/<id>/). */
  async relatedStudies(project, savedId = null) {
    const { data, errors } = this.validate(project);
    if (Object.keys(errors).length) return { studies: [], error: "Please fix the highlighted fields.", errors };
    const body = { p_title: data.title, p_abstract: data.abstract, p_keywords: data.keywords, p_limit: 30 };
    const matched = this.signedIn ? await this.rest("POST", "/rpc/match_studies", body) : await this.call("POST", "/rest/v1/rpc/match_studies", body);
    if (!matched.ok) return { studies: [], ...this.failure(matched, "Couldn't find related studies right now. Please try again.") };
    const rows = Array.isArray(matched.data) ? matched.data : [];
    const studies = rows.map((r) => this.shape(r, data.keywords));
    if (!this.signedIn) return { studies, projectId: null };
    if (savedId) return this.updateProject(savedId, data, rows, studies);

    const unsaved = { studies, projectId: null, error: "Matched, but the project couldn't be saved to your account." };
    const saved = await this.rest("POST", "/projects?select=id", data, "return=representation");
    const projectId = saved.ok && saved.data[0] ? saved.data[0].id : null;
    if (!projectId) return unsaved;
    if (rows.length) {
      const links = rows.map((r) => ({ project_id: projectId, study_id: r.study_id, score: Number(r.score), shared_terms: r.shared_terms || [] }));
      const linked = await this.rest("POST", "/project_matches", links, "return=minimal");
      if (!linked.ok) {
        await this.rest("DELETE", `/projects?id=eq.${projectId}`);
        return unsaved;
      }
    }
    this.scores[projectId] = Object.fromEntries(rows.map((r) => [r.study_id, Number(r.score)]));
    return { studies, projectId };
  }

  async updateProject(id, data, rows, studies) {
    const failed = { studies, projectId: id, error: "Matched, but the project couldn't be updated in your account." };
    const old = await this.rest("GET", `/project_matches?select=study_id,relation,difference&project_id=eq.${encodeURIComponent(id)}`);
    if (!old.ok) return failed;
    const labels = Object.fromEntries(old.data.map((m) => [m.study_id, m]));
    const updated = await this.rest("PATCH", `/projects?id=eq.${encodeURIComponent(id)}&select=id`, data, "return=representation");
    if (!updated.ok || !updated.data.length) return failed;
    const cleared = await this.rest("DELETE", `/project_matches?project_id=eq.${encodeURIComponent(id)}`);
    if (!cleared.ok) return failed;
    const links = rows.map((r) => {
      const label = labels[r.study_id] || {};
      return { project_id: id, study_id: r.study_id, score: Number(r.score), shared_terms: r.shared_terms || [], relation: label.relation || null, difference: label.difference || null };
    });
    if (links.length && !(await this.rest("POST", "/project_matches", links, "return=minimal")).ok) return failed;
    studies.forEach((s) => { const label = labels[s.studyId]; if (label) Object.assign(s, { relation: label.relation || null, difference: label.difference || "" }); });
    this.scores[id] = Object.fromEntries(rows.map((r) => [r.study_id, Number(r.score)]));
    return { studies, projectId: id };
  }

  /* Row level security lets users delete only their own projects; their matches go with them (on delete cascade). */
  async deleteProject(id) {
    const result = await this.rest("DELETE", `/projects?id=eq.${encodeURIComponent(id)}&select=id`, undefined, "return=representation");
    if (!result.ok || !result.data.length) return this.failure(result.ok ? { status: 404 } : result, "Couldn't delete this project.");
    delete this.scores[id];
    return { ok: true };
  }

  async listProjects() {
    const result = await this.rest("GET", "/projects?select=id,title,created_at&order=created_at.desc");
    return result.ok ? result.data.map((p) => ({ id: p.id, title: p.title, createdAt: p.created_at })) : [];
  }

  async loadProject(id) {
    const project = await this.rest("GET", `/projects?select=id,title,abstract,keywords,created_at&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!project.ok) return { error: this.failure(project, "Couldn't open this project.").message };
    const p = project.data[0];
    if (!p) return { error: "Project not found." };
    const links = await this.rest("GET", `/project_matches?select=study_id,score,shared_terms,relation,difference,studies(${SupabaseDirect.STUDY})&project_id=eq.${encodeURIComponent(id)}&order=score.desc`);
    if (!links.ok) return { error: this.failure(links, "Couldn't open this project.").message };
    const keywords = p.keywords || [];
    const studies = links.data.map((m) => this.shape({ ...(m.studies || { id: m.study_id }), score: m.score }, keywords, m));
    this.scores[id] = Object.fromEntries(links.data.map((m) => [m.study_id, Number(m.score)]));
    return { project: { id: p.id, title: p.title, abstract: p.abstract, keywords, createdAt: p.created_at }, match: { studies, projectId: id } };
  }

  /* Same rules as LabelPolicy in app/services/rules.py: errors block the save, warnings come back with it. */
  async saveLabel(projectId, studyId, changes) {
    const relation = changes.relation;
    const difference = changes.difference === undefined ? undefined : String(changes.difference || "").trim();
    const errors = {};
    if (relation && !SupabaseDirect.RELATIONS.includes(relation)) errors.relation = `Choose one of: ${SupabaseDirect.RELATIONS.join(", ")}.`;
    if (difference && difference.length > SupabaseDirect.MAX_NOTE) errors.difference = `Keep this note to ${SupabaseDirect.MAX_NOTE} characters or fewer.`;
    if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors };

    const body = {};
    if (relation !== undefined) body.relation = relation;
    if (difference !== undefined) body.difference = difference || null;
    const path = `/project_matches?project_id=eq.${encodeURIComponent(projectId)}&study_id=eq.${encodeURIComponent(studyId)}&select=relation,difference`;
    const result = await this.rest("PATCH", path, body, "return=representation");
    if (!result.ok || !result.data.length) return this.failure(result.ok ? { status: 404 } : result, "Couldn't save this label.");

    const row = result.data[0];
    const warnings = [];
    if ((row.relation === "Duplicate" || row.relation === "Similar") && !row.difference) warnings.push("Explain how your work differs from this study.");
    const score = (this.scores[projectId] || {})[studyId];
    if (row.relation === "Duplicate" && score !== undefined && this.similarity(score) === "Low similarity") warnings.push("This study has low similarity. Check that it is really a duplicate.");
    return { ok: true, warnings: warnings.sort() };
  }
}
