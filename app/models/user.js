/* Clio — demo user validation rules. No storage, no DOM. */
(function () {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* Each returns an error message, or "". */
  window.Clio.User = {
    emailError(value) {
      if (!value) return "Enter your email address.";
      return EMAIL_RE.test(value) ? "" : "Enter a valid email address, like name@example.com.";
    },

    loginPasswordError: (password) =>
      password.length >= 8 ? "" : "Enter your password (at least 8 characters).",

    nameError: (name) => (name.length < 2 ? "Enter a display name of at least 2 characters." : ""),

    newPasswordError(password) {
      if (password.length < 8) return "Use at least 8 characters.";
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
      return "";
    },

    confirmError(confirm, password) {
      if (!confirm) return "Confirm your password.";
      return confirm !== password ? "Passwords don't match." : "";
    },
  };
})();
