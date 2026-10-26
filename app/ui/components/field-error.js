/* Clio — form field error messages. */
(function () {
  "use strict";

  window.Clio.setFieldError = function (name, message, input) {
    const el = document.querySelector('[data-error-for="' + name + '"]');
    if (!el) return;
    el.textContent = message || "";
    el.closest(".field").classList.toggle("field--invalid", Boolean(message));
    input = input || document.getElementById(name);
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  };

  window.Clio.focusFirstInvalid = function (container) {
    const el = container.querySelector(".field--invalid input, .field--invalid textarea");
    if (el) el.focus();
  };
})();
