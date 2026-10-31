/* Clio — Sign in / sign up modal behaviour: open, switch, close, validate, focus trap.
   No authentication backend exists yet; connect it in submit() when endpoints are available. */
class AuthController {
  constructor(api) {
    this.api = api;
    this.closeTimer = null;
    this.modal = document.getElementById("auth-modal");
    this.app = document.querySelector(".app");
    this.opener = null;
    this.busy = false;
    this.emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }

  bind() {
    document.addEventListener("click", (e) => {
      const open = e.target.closest("[data-open-auth]");
      if (open) return this.open(open.dataset.openAuth === "signup" ? "signup" : "login", open);
      if (this.modal.hidden) return;
      if (e.target.closest("[data-modal-close]")) return this.close();
      const go = e.target.closest("[data-goto-view]");
      if (go) return this.show(go.dataset.gotoView);
      const eye = e.target.closest("[data-toggle-password]");
      if (eye) return this.togglePassword(eye);
      const unavailable = e.target.closest("[data-unavailable]");
      if (unavailable) return this.status(unavailable.closest(".auth-main").querySelector(".auth-status"), unavailable.dataset.unavailable);
    });

    document.addEventListener("keydown", (e) => {
      if (this.modal.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); this.close(); }
      if (e.key === "Tab") this.trapFocus(e);
    });

    document.getElementById("login-form").addEventListener("submit", (e) => this.onSubmit(e, "login"));
    document.getElementById("signup-form").addEventListener("submit", (e) => this.onSubmit(e, "signup"));
    this.bindSession();
  }

  /* Top bar account menu: open / close, and log out. Only matters once a user is signed in. */
  bindSession() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const menu = document.getElementById("profile-menu");
    if (!toggle || !menu) return;
    const setMenu = (open) => { menu.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
    toggle.addEventListener("click", () => setMenu(menu.hidden));
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#user-nav")) setMenu(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); } });
    menu.querySelector("[data-logout]").addEventListener("click", async () => {
      await this.api.logout();
      /* Reload so nothing from this user (projects, results, tokens) stays in memory on a shared computer. */
      window.location.reload();
    });
    /* When a real backend is connected the "nothing is sent or saved" notes no longer apply. */
    if (this.api.auth && this.api.auth.connected) this.modal.querySelectorAll(".auth-note").forEach((n) => { n.hidden = true; });
  }

  /* Swaps the Login / Sign Up buttons for the account menu. Text is set with textContent, never as HTML. */
  signedIn(user) {
    const guest = document.getElementById("guest-nav");
    const account = document.getElementById("user-nav");
    const name = user.name || user.email.split("@")[0] || "Account";
    document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = name; });
    document.querySelectorAll("[data-user-email]").forEach((el) => { el.textContent = user.email; });
    document.querySelectorAll("[data-user-initial]").forEach((el) => { el.textContent = name.charAt(0).toUpperCase(); });
    const badge = account.querySelector(".demo-badge");
    if (badge) badge.hidden = true;
    guest.hidden = true;
    guest.style.display = "none"; /* .auth-nav__guest sets display:flex, which would beat [hidden] */
    account.hidden = false;
    /* Tells the sidebar to load this user's saved projects. */
    document.dispatchEvent(new CustomEvent("clio:signed-in"));
  }

  }

  dialog() {
    return this.modal.querySelector(".auth-dialog:not([hidden])");
  }

  open(view, opener) {
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.opener = opener || document.activeElement;
    this.modal.hidden = false;
    this.modal.classList.remove("is-closing");
    document.body.classList.add("modal-open");
    if (this.app) this.app.inert = true;
    this.show(view);
  }

  show(view) {
    this.modal.querySelectorAll(".auth-dialog").forEach((d) => { d.hidden = d.dataset.view !== view; });
    this.reset(this.dialog());
    this.dialog().querySelector("input").focus();
  }

  close() {
    if (this.modal.hidden) return;
    const finish = () => {
      this.closeTimer = null;
      this.modal.hidden = true;
      this.modal.classList.remove("is-closing");
      document.body.classList.remove("modal-open");
      if (this.app) this.app.inert = false;
      if (this.opener && this.opener.focus) this.opener.focus();
    };
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return finish();
    if (this.closeTimer) return;
    this.modal.classList.add("is-closing");
    this.closeTimer = setTimeout(finish, 180);
  }

  reset(dialog) {
    dialog.querySelector("form").reset();
    dialog.querySelectorAll("[data-error-for]").forEach((el) => this.setError(el.dataset.errorFor, ""));
    this.status(dialog.querySelector(".auth-status"), "");
    dialog.querySelectorAll("[data-toggle-password]").forEach((eye) => this.togglePassword(eye, false));
  }

  togglePassword(eye, force) {
    const input = document.getElementById(eye.dataset.togglePassword);
    const show = force === undefined ? input.type === "password" : force;
    input.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
    eye.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
    Icons.refresh();
  }

  trapFocus(e) {
    const items = [...this.dialog().querySelectorAll("button, input, [href]")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!this.dialog().contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }

  setError(id, message) {
    document.querySelector(`[data-error-for="${id}"]`).textContent = message;
    const input = document.getElementById(id);
    input.closest(".field").classList.toggle("field--invalid", Boolean(message));
    input.setAttribute("aria-invalid", String(Boolean(message)));
  }

  status(el, message, kind = "info") {
    el.textContent = message;
    el.dataset.kind = kind;
  }

  value(id) {
    return document.getElementById(id).value;
  }

  validate(view) {
    const errors = {};
    const email = view === "login" ? "login-email" : "signup-email";
    const emailValue = this.value(email).trim();
    errors[email] = !emailValue ? "Enter your email address." : this.emailPattern.test(emailValue) ? "" : "Enter a valid email address, like name@example.com.";

    if (view === "login") {
      errors["login-password"] = this.value("login-password") ? "" : "Enter your password.";
    } else {
      const password = this.value("signup-password");
      errors["signup-name"] = this.value("signup-name").trim() ? "" : "Enter your full name.";
      errors["signup-password"] = !password ? "Create a password."
        : password.length < 8 ? "Password must be at least 8 characters."
        : /^\d+$/.test(password) ? "Password can't be only numbers." : "";
      errors["signup-confirm"] = !this.value("signup-confirm") ? "Confirm your password."
        : this.value("signup-confirm") !== password ? "Passwords don't match." : "";
    }

    Object.entries(errors).forEach(([id, message]) => this.setError(id, message));
    const first = this.dialog().querySelector(".field--invalid input");
    if (first) first.focus();
    return !first;
  }

  onSubmit(e, view) {
    e.preventDefault();
    if (this.busy) return;
    const status = e.target.querySelector(".auth-status");
    this.status(status, "");
    if (!this.validate(view)) return;
    this.submit(view, e.target, status);
  }

  /* Sends the credentials through ClioApi (never logged or stored here). With no backend configured
     nothing is sent and the "not connected" message is shown. */
  async submit(view, form, status) {
    this.busy = true;
    try {
      const result = view === "login"
        ? await this.api.login(this.value("login-email").trim(), this.value("login-password"))
        : await this.api.signup(this.value("signup-name").trim(), this.value("signup-email").trim(), this.value("signup-password"));
      if (result.notConnected) {
        const message = view === "login"
          ? "Sign-in isn't connected yet, so you weren't signed in. Nothing was sent or saved."
          : "Account creation isn't connected yet, so no account was created. Nothing was sent or saved.";
        return this.status(status, message, "error");
      }
      if (!result.ok) {
        Object.entries(result.errors || {}).forEach(([field, message]) => {
          const id = `${view}-${field}`;
          if (document.getElementById(id)) this.setError(id, message);
        });
        return this.status(status, result.message, "error");
      }
      const user = result.data && result.data.user;
      if (user) {
        form.reset();
        this.signedIn(user);
        this.close();
        if (this.onSignIn) this.onSignIn(user);
        return;
      }
      if (result.data && result.data.needsConfirmation) {
        form.reset();
        return this.status(status, "Almost done! Check your email and open the confirmation link, then sign in.", "info");
      }
      this.status(status, view === "login" ? "Signed in." : "Account created.", "info");
    } finally {
      this.busy = false;
    }
  }
}
