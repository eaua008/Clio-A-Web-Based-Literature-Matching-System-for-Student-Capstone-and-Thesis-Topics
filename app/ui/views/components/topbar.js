/* Clio — Top bar: mobile menu button and account navigation. */
class Topbar {
  render() {
    return `
      <!-- Top bar -->
      <header class="topbar">
        <button type="button" class="icon-btn topbar__menu" data-sidebar-open aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">
          <i data-lucide="menu"></i>
        </button>
        <div class="topbar__spacer"></div>

        <nav class="auth-nav" aria-label="Account">
          <div class="auth-nav__guest" id="guest-nav">
            <button type="button" class="btn btn--primary btn--small" data-open-auth="login">Login</button>
            <button type="button" class="btn btn--primary btn--small" data-open-auth="signup">Sign Up</button>
          </div>
          <div class="profile" id="user-nav" hidden>
            <button type="button" class="profile__trigger" data-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu">
              <span class="avatar" aria-hidden="true" data-user-initial></span>
              <span class="profile__name" data-user-name></span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="profile__menu" id="profile-menu" role="menu" hidden>
              <div class="profile__meta">
                <strong data-user-name></strong>
                <span data-user-email></span>
                <em class="demo-badge">Demo session</em>
              </div>
              <button type="button" class="profile__item" role="menuitem" data-logout>
                <i data-lucide="log-out"></i> Log out
              </button>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
