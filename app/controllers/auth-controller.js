/* Clio — login / sign-up flow (demo only, see services/auth-service.js). */
(function () {
  "use strict";

  const { toast, setFieldError, focusFirstInvalid, User, AuthService: auth, AuthView: view } = window.Clio;
  const emailInput = view.emailInput;

  let mode = "login";
  let email = "";

  const showStep = (name) => view.showStep(name, email);

  function open(requestedMode) {
    mode = requestedMode === "signup" ? "signup" : "login";
    email = "";
    view.open();
    window.Clio.closeDrawer();
    showStep("start");
  }

  function startSession(name, sessionEmail, message) {
    auth.login(name, sessionEmail);
    view.renderSession(auth.currentUser());
    view.close();
    toast(message, "success");
  }

  /* ---------- Step 1: email ---------- */
  document.getElementById("email-form").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const value = emailInput.value.trim().toLowerCase();
    setFieldError("auth-email", User.emailError(value));
    if (view.hasErrors()) return emailInput.focus();

    view.withLoading(evt.target, () => {
      email = value;
      const known = auth.hasAccount(email);
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
    setFieldError("login-password", User.loginPasswordError(password));
    if (view.hasErrors(evt.target)) return focusFirstInvalid(evt.target);

    view.withLoading(evt.target, () => {
      const name = auth.nameFor(email);
      startSession(name, email, "Welcome back, " + name + "! (demo session)");
    });
  });

  /* ---------- Step 2b: sign up ---------- */
  document.getElementById("signup-form").addEventListener("submit", (evt) => {
    evt.preventDefault();
    const name = document.getElementById("signup-name").value.trim().replace(/\s+/g, " ");
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    setFieldError("signup-name", User.nameError(name));
    setFieldError("signup-password", User.newPasswordError(password));
    setFieldError("signup-confirm", User.confirmError(confirm, password));
    if (view.hasErrors(evt.target)) return focusFirstInvalid(evt.target);

    view.withLoading(evt.target, () => {
      auth.register(email, name);
      startSession(name, email, "Demo account created. Welcome, " + name + "!");
    });
  });

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (evt) => {
    const t = evt.target;
    const opener = t.closest("[data-open-auth]");
    if (opener) open(opener.dataset.openAuth);

    if (t.closest("[data-modal-close]")) view.close();

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
      auth.logout();
      window.Clio.closeProfileMenu();
      view.renderSession(null);
      toast("You've been logged out of the demo session.", "success");
      document.querySelector('[data-open-auth="login"]').focus();
    }
  });

  /* ---------- Keyboard: Escape + focus trap ---------- */
  document.addEventListener("keydown", (evt) => {
    if (!view.isOpen()) return;
    if (evt.key === "Escape") {
      evt.preventDefault();
      view.close();
      return;
    }
    if (evt.key === "Tab") view.trapFocus(evt);
  });

  view.renderSession(auth.currentUser());
  window.Clio.auth = { open, close: () => view.close(), getSession: auth.currentUser };
})();
