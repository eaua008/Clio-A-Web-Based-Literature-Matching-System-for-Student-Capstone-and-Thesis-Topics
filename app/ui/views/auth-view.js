/* Clio — login / sign-up modal and the signed-in top bar (drawing only). */
(function () {
  "use strict";

  const { setFieldError } = window.Clio;

  const FAKE_LATENCY = 600;

  const modal = document.getElementById("auth-modal");
  const dialog = modal.querySelector(".modal__dialog");
  const steps = modal.querySelectorAll(".auth-step");

  let lastFocus = null;
  let closeTimer = null;

  window.Clio.AuthView = {
    modal,
    emailInput: document.getElementById("auth-email"),

    isOpen: () => !modal.hidden,
    hasErrors: (container) => Boolean((container || modal).querySelector(".field--invalid")),

    renderSession(session) {
      document.getElementById("guest-nav").hidden = Boolean(session);
      document.getElementById("user-nav").hidden = !session;
      if (!session) return;
      document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = session.name; });
      document.querySelectorAll("[data-user-email]").forEach((el) => { el.textContent = session.email; });
      document.querySelector("[data-user-initial]").textContent = session.name.charAt(0).toUpperCase();
    },

    showStep(name, email) {
      steps.forEach((step) => { step.hidden = step.dataset.step !== name; });
      modal.querySelectorAll("[data-auth-email]").forEach((el) => { el.textContent = email; });
      const first = modal.querySelector('.auth-step[data-step="' + name + '"] input');
      if (first) first.focus();
    },

    resetForms() {
      modal.querySelectorAll("form").forEach((f) => f.reset());
      modal.querySelectorAll("[data-error-for]").forEach((el) => setFieldError(el.dataset.errorFor, ""));
      modal.querySelectorAll(".is-loading").forEach((b) => { b.classList.remove("is-loading"); b.disabled = false; });
    },

    open() {
      clearTimeout(closeTimer);
      lastFocus = document.activeElement;
      this.resetForms();
      modal.classList.remove("is-closing");
      modal.hidden = false;
      document.body.classList.add("modal-open");
    },

    close() {
      if (modal.hidden || modal.classList.contains("is-closing")) return;
      modal.classList.add("is-closing");
      closeTimer = setTimeout(() => {
        modal.hidden = true;
        modal.classList.remove("is-closing");
        document.body.classList.remove("modal-open");
        if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
      }, 180);
    },

    /* Disable the submit button and show a spinner for a moment, like a real request would. */
    withLoading(form, action) {
      const btn = form.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add("is-loading");
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        action();
      }, FAKE_LATENCY);
    },

    /* Keep Tab focus inside the dialog. */
    trapFocus(evt) {
      const items = Array.from(dialog.querySelectorAll("button:not([disabled]), input"))
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (evt.shiftKey && document.activeElement === first) { evt.preventDefault(); last.focus(); }
      else if (!evt.shiftKey && document.activeElement === last) { evt.preventDefault(); first.focus(); }
    },
  };
})();
