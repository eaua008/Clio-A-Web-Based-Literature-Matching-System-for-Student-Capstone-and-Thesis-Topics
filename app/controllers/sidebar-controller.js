/* Clio — sidebar, drawer, search toggle and profile menu events. */
(function () {
  "use strict";

  const { store, isMobile, SidebarView: view } = window.Clio;

  function setCollapsed(collapsed) {
    view.setCollapsed(collapsed);
    store.setRaw("clio.sidebar", collapsed ? "collapsed" : "expanded");
  }

  document.addEventListener("click", (evt) => {
    const t = evt.target;
    if (t.closest("[data-sidebar-toggle]")) setCollapsed(!view.isCollapsed());
    if (t.closest("[data-sidebar-open]")) view.setDrawer(true);
    if (t.closest("[data-sidebar-close]")) view.setDrawer(false);

    if (t.closest("[data-search-toggle]")) {
      if (view.isCollapsed() && !isMobile()) {
        setCollapsed(false);
        view.setSearch(true);
      } else {
        view.setSearch(!view.isSearchOpen());
      }
    }

    if (t.closest("[data-menu-toggle]")) view.setProfileMenu(!view.isProfileMenuOpen());
    else if (view.isProfileMenuOpen() && !t.closest("#profile-menu")) view.setProfileMenu(false);
  });

  document.addEventListener("keydown", (evt) => {
    if (evt.key !== "Escape" || document.body.classList.contains("modal-open")) return;
    if (view.isProfileMenuOpen()) {
      view.setProfileMenu(false);
      view.focusProfileToggle();
    }
    if (view.isDrawerOpen()) view.setDrawer(false);
  });

  window.Clio.closeDrawer = () => view.setDrawer(false);
  window.Clio.closeProfileMenu = () => view.setProfileMenu(false);

  setCollapsed(view.isCollapsed());
  window.Clio.refreshIcons();
})();
