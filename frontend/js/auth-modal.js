/* Clio — login / sign-up modal.
   DEMO ONLY: nothing leaves the browser. Passwords are validated for format but never
   stored or checked; the "session" is just a name and email kept in localStorage. */
(function () {
  "use strict";

  const { store, toast, setFieldError, focusFirstInvalid } = window.Clio;

  const SESSION_KEY = "clio.demoSession";
  const ACCOUNTS_KEY = "clio.demoAccounts";  // { email: displayName }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const FAKE_LATENCY = 600;

  const modal = document.getElementById("auth-modal");
  const dialog = modal.querySelector(".modal__dialog");
  const steps = modal.querySelectorAll(".auth-step");
  const emailInput = document.getElementById("auth-email");

  let mode = "login";
  let email = "";
  let lastFocus = null;
  let closeTimer = null;

  /* ---------- Demo session ---------- */
  function getAccounts() {
    const accounts = store.get(ACCOUNTS_KEY, {});
    return accounts && typeof accounts === "object" && !Array.isArray(accounts) ? accounts : {};
  }

  function getSession() {
    const s = store.get(SESSION_KEY, null);
    return s && typeof s.name === "string" && typeof s.email === "string" ? s : null;
  }

  function renderSession() {
    const session = getSession();
    document.getElementById("guest-nav").hidden = Boolean(session);
    document.getElementById("user-nav").hidden = !session;
    if (!session) return;
    document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = session.name; });
    document.querySelectorAll("[data-user-email]").forEach((el) => { el.textContent = session.email; });
    document.querySelector("[data-user-initial]").textContent = session.name.charAt(0).toUpperCase();
  }

  function startSession(name, sessionEmail, message) {
    store.set(SESSION_KEY, { name, email: sessionEmail });
    renderSession();
    close();
    toast(message, "success");
  }

  /* ---------- Open / close ---------- */
  function showStep(name) {
    steps.forEach((step) => { step.hidden = step.dataset.step !== name; });
    modal.querySelectorAll("[data-auth-email]").forEach((el) => { el.textContent = email; });
    const first = modal.querySelector('.auth-step[data-step="' + name + '"] input');
    if (first) first.focus();
  }

  function resetForms() {
    modal.querySelectorAll("form").forEach((f) => f.reset());
    modal.querySelectorAll("[data-error-for]").forEach((el) => setFieldError(el.dataset.errorFor, ""));
    modal.querySelectorAll(".is-loading").forEach((b) => { b.classList.remove("is-loading"); b.disabled = false; });
  }

  function open(requestedMode) {
    clearTimeout(closeTimer);
    mode = requestedMode === "signup" ? "signup" : "login";
    email = "";
    lastFocus = document.activeElement;
    resetForms();
    modal.classList.remove("is-closing");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.Clio.closeDrawer();
    showStep("start");
  }

  function close() {
    if (modal.hidden || modal.classList.contains("is-closing")) return;
    modal.classList.add("is-closing");
    closeTimer = setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove("is-closing");
      document.body.classList.remove("modal-open");
      if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
    }, 180);
  }

  /* Disable the submit button and show a spinner for a moment, like a real request would. */
  function withLoading(form, action) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("is-loading");
    setTimeout(() => {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      action();
    }, FAKE_LATENCY);
  }

  /* ---------- Step 1: email ---------- */
  document.getElementById("email-form").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const value = emailInput.value.trim().toLowerCase();
    if (!value) setFieldError("auth-email", "Enter your email address.");
    else if (!EMAIL_RE.test(value)) setFieldError("auth-email", "Enter a valid email address, like name@example.com.");
    else setFieldError("auth-email", "");
    if (modal.querySelector(".field--invalid")) return emailInput.focus();

    withLoading(evt.target, () => {
      email = value;
      const known = Object.prototype.hasOwnProperty.call(getAccounts(), email);
      if (mode === "login" && !known) {
        toast("No demo account uses that email yet. Create one below.", "info");
        showStep("signup");
      } else if (mode === "signup" && known) {
        toast("A demo account already uses that email. Log in instead.", "info");
        showStep("login");
      } else {
        showStep(known ? "login" : "signup");
      }
    });
  });

  /* ---------- Step 2a: log in ---------- */
  document.getElementById("login-form").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const password = document.getElementById("login-password").value;
    setFieldError("login-password", password.length >= 8 ? "" : "Enter your password (at least 8 characters).");
    if (password.length < 8) return focusFirstInvalid(evt.target);

    withLoading(evt.target, () => {
      const name = getAccounts()[email] || email.split("@")[0];
      startSession(name, email, "Welcome back, " + name + "! (demo session)");
    });
  });

  /* ---------- Step 2b: sign up ---------- */
  document.getElementById("signup-form").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const name = document.getElementById("signup-name").value.trim().replace(/\s+/g, " ");
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    setFieldError("signup-name", name.length < 2 ? "Enter a display name of at least 2 characters." : "");
    setFieldError("signup-password",
      password.length < 8 ? "Use at least 8 characters."
        : !/[A-Za-z]/.test(password) || !/\d/.test(password) ? "Include at least one letter and one number."
          : "");
    setFieldError("signup-confirm", !confirm ? "Confirm your password." : confirm !== password ? "Passwords don't match." : "");
    if (evt.target.querySelector(".field--invalid")) return focusFirstInvalid(evt.target);

    withLoading(evt.target, () => {
      const accounts = getAccounts();
      accounts[email] = name;
      store.set(ACCOUNTS_KEY, accounts);
      startSession(name, email, "Demo account created. Welcome, " + name + "!");
    });
  });

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (evt) => {
    const t = evt.target;
    const opener = t.closest("[data-open-auth]");
    if (opener) open(opener.dataset.openAuth);

    if (t.closest("[data-modal-close]")) close();

    const goto = t.closest("[data-goto-step]");
    if (goto) {
      if (goto.dataset.gotoStep === "start") emailInput.value = email;
      showStep(goto.dataset.gotoStep);
    }

    const provider = t.closest("[data-provider]");
    if (provider) {
      toast(provider.dataset.provider + " sign-in isn't connected in this frontend demo. Use email instead.", "info");
    }

    if (t.closest("[data-logout]")) {
      store.remove(SESSION_KEY);
      window.Clio.closeProfileMenu();
      renderSession();
      toast("You've been logged out of the demo session.", "success");
      document.querySelector('[data-open-auth="login"]').focus();
    }
  });

  /* ---------- Keyboard: Escape + focus trap ---------- */
  document.addEventListener("keydown", (evt) => {
    if (modal.hidden) return;
    if (evt.key === "Escape") {
      evt.preventDefault();
      close();
      return;
    }
    if (evt.key !== "Tab") return;
    const items = Array.from(dialog.querySelectorAll("button:not([disabled]), input"))
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (evt.shiftKey && document.activeElement === first) { evt.preventDefault(); last.focus(); }
    else if (!evt.shiftKey && document.activeElement === last) { evt.preventDefault(); first.focus(); }
  });

  renderSession();
  window.Clio.auth = { open, close, getSession };
})();
