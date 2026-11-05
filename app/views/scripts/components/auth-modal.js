/* Clio — Sign in / sign up modal. */
class AuthModal {
  brand(heading, text) {
    return `
      <aside class="auth-brand" aria-hidden="true">
        <div class="auth-brand__logo"><img src="assets/images/logo.png" alt="" width="46" height="58"><span>lio</span></div>
        <h2 class="auth-brand__heading">${heading}</h2>
        <p class="auth-brand__text">${text}</p>
        <ul class="auth-brand__features">
          <li>Title-based literature matching</li>
          <li>Projects kept with your account</li>
          <li>Built for capstone and thesis work</li>
        </ul>
      </aside>
    `;
  }

  field(id, label, type, autocomplete, extra = "") {
    const isPassword = type === "password";
    return `
      <div class="field">
        <div class="auth-label-row">
          <label for="${id}">${label}</label>${extra}
        </div>
        <div class="auth-input">
          <input type="${type}" id="${id}" autocomplete="${autocomplete}" aria-describedby="${id}-error${isPassword && id === "signup-password" ? " signup-password-help" : ""}">
          ${isPassword ? `<button type="button" class="auth-eye" data-toggle-password="${id}" aria-label="Show password" aria-pressed="false"><i data-lucide="eye"></i></button>` : ""}
        </div>
        ${id === "signup-password" ? `<p class="field__help" id="signup-password-help">At least 8 characters and not only numbers.</p>` : ""}
        <p class="field__error" id="${id}-error" data-error-for="${id}"></p>
      </div>
    `;
  }

  render() {
    return `
      <!-- Authentication modal -->
      <div class="modal" id="auth-modal" hidden>
        <div class="modal__overlay" data-modal-close></div>

        <!-- Sign in -->
        <div class="modal__dialog auth-dialog" data-view="login" role="dialog" aria-modal="true" aria-labelledby="login-title" hidden>
          ${this.brand("Welcome back.", "Pick up your literature search where you left it.")}
          <section class="auth-main">
            <button type="button" class="icon-btn modal__close" data-modal-close aria-label="Close dialog"><i data-lucide="x"></i></button>
            <h2 class="auth-main__title" id="login-title">Sign in</h2>
            <p class="auth-main__sub">Use your CLIO account to match titles and keep your projects.</p>
            <form class="auth-form" id="login-form" novalidate>
              ${this.field("login-email", "Email address", "email", "email")}
              ${this.field("login-password", "Password", "password", "current-password")}
              <p class="auth-status" role="status" aria-live="polite"></p>
              <button type="submit" class="btn btn--primary btn--block"><span>Sign In</span></button>
            </form>
            <p class="auth-switch">Don't have an account? <button type="button" class="auth-switch__link" data-goto-view="signup">Sign up</button></p>
          </section>
        </div>

        <!-- Sign up -->
        <div class="modal__dialog auth-dialog" data-view="signup" role="dialog" aria-modal="true" aria-labelledby="signup-title" hidden>
          ${this.brand("Start your research trail.", "Save projects and match each title with related studies.")}
          <section class="auth-main">
            <button type="button" class="icon-btn modal__close" data-modal-close aria-label="Close dialog"><i data-lucide="x"></i></button>
            <h2 class="auth-main__title" id="signup-title">Create your account</h2>
            <p class="auth-main__sub">Save research projects and come back to them anytime.</p>
            <form class="auth-form" id="signup-form" novalidate>
              ${this.field("signup-name", "Full name", "text", "name")}
              ${this.field("signup-email", "Email address", "email", "email")}
              ${this.field("signup-password", "Password", "password", "new-password")}
              ${this.field("signup-confirm", "Confirm password", "password", "new-password")}
              <p class="auth-status" role="status" aria-live="polite"></p>
              <button type="submit" class="btn btn--primary btn--block"><span>Create Account</span></button>
            </form>
            <p class="auth-switch">Already have an account? <button type="button" class="auth-switch__link" data-goto-view="login">Sign in</button></p>
          </section>
        </div>
      </div>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
