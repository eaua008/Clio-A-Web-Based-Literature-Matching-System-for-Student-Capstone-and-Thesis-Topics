/* Clio — Login / sign-up modal (demo only). */
class AuthModal {
  render() {
    return `
      <!-- Authentication modal (demo only) -->
      <div class="modal" id="auth-modal" hidden>
        <div class="modal__overlay" data-modal-close></div>
        <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button type="button" class="icon-btn modal__close" data-modal-close aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
          <h2 class="modal__title" id="auth-title">Log in or Sign Up</h2>
          <p class="demo-note"><i data-lucide="flask-conical"></i> Frontend demo — no real account is created.</p>

          <!-- Step 1: provider choice + email -->
          <div class="auth-step" data-step="start">
            <div class="social-buttons">
              <button type="button" class="social-btn" data-provider="Google">
                <span class="social-btn__google" aria-hidden="true">G</span>Continue with Google
              </button>
              <button type="button" class="social-btn" data-provider="Apple">
                <i data-lucide="apple"></i>Continue with Apple
              </button>
              <button type="button" class="social-btn" data-provider="Phone">
                <i data-lucide="phone"></i>Continue with Phone
              </button>
            </div>
            <div class="divider" role="separator"><span>OR</span></div>
            <form class="auth-form" id="email-form" novalidate>
              <div class="field">
                <label for="auth-email" class="visually-hidden">Email address</label>
                <input type="email" id="auth-email" placeholder="Email address" autocomplete="email" aria-describedby="auth-email-error">
                <p class="field__error" id="auth-email-error" data-error-for="auth-email"></p>
              </div>
              <button type="submit" class="btn btn--primary btn--block"><span class="btn__spinner" aria-hidden="true"></span><span>Continue</span></button>
            </form>
          </div>

          <!-- Step 2a: demo log in -->
          <form class="auth-step auth-form" data-step="login" id="login-form" novalidate hidden>
            <p class="auth-step__email">Logging in as <strong data-auth-email></strong></p>
            <div class="field">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" autocomplete="current-password" aria-describedby="login-password-error">
              <p class="field__error" id="login-password-error" data-error-for="login-password"></p>
            </div>
            <button type="submit" class="btn btn--primary btn--block"><span class="btn__spinner" aria-hidden="true"></span><span>Log in</span></button>
            <div class="auth-links">
              <button type="button" class="link-btn" data-goto-step="start">Use a different email</button>
              <button type="button" class="link-btn" data-goto-step="signup">Create an account instead</button>
            </div>
          </form>

          <!-- Step 2b: demo sign up -->
          <form class="auth-step auth-form" data-step="signup" id="signup-form" novalidate hidden>
            <p class="auth-step__email">Creating an account for <strong data-auth-email></strong></p>
            <div class="field">
              <label for="signup-name">Display name</label>
              <input type="text" id="signup-name" maxlength="30" autocomplete="nickname" aria-describedby="signup-name-error">
              <p class="field__error" id="signup-name-error" data-error-for="signup-name"></p>
            </div>
            <div class="field">
              <label for="signup-password">Password</label>
              <input type="password" id="signup-password" autocomplete="new-password" aria-describedby="signup-password-help signup-password-error">
              <p class="field__help" id="signup-password-help">At least 8 characters, including a letter and a number.</p>
              <p class="field__error" id="signup-password-error" data-error-for="signup-password"></p>
            </div>
            <div class="field">
              <label for="signup-confirm">Confirm password</label>
              <input type="password" id="signup-confirm" autocomplete="new-password" aria-describedby="signup-confirm-error">
              <p class="field__error" id="signup-confirm-error" data-error-for="signup-confirm"></p>
            </div>
            <button type="submit" class="btn btn--primary btn--block"><span class="btn__spinner" aria-hidden="true"></span><span>Create account</span></button>
            <div class="auth-links">
              <button type="button" class="link-btn" data-goto-step="start">Use a different email</button>
              <button type="button" class="link-btn" data-goto-step="login">I already have an account</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
