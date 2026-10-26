/* Clio — sidebar, mobile drawer, search box and profile menu (drawing only). */
(function () {
  "use strict";

  const { refreshIcons } = window.Clio;
  const root = document.documentElement;
  const backdrop = document.querySelector(".sidebar-backdrop");

  window.Clio.SidebarView = {
    isCollapsed: () => root.classList.contains("sidebar-collapsed"),
    isDrawerOpen: () => root.classList.contains("sidebar-open"),
    isSearchOpen: () => !document.getElementById("project-search").hidden,
    isProfileMenuOpen: () => !document.getElementById("profile-menu").hidden,

    setDrawer(open) {
      root.classList.toggle("sidebar-open", open);
      backdrop.hidden = !open;
      document.querySelector("[data-sidebar-open]").setAttribute("aria-expanded", String(open));
    },

    setCollapsed(collapsed) {
      root.classList.toggle("sidebar-collapsed", collapsed);
      const btn = document.querySelector("[data-sidebar-toggle]");
      const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.innerHTML = '<i data-lucide="' + (collapsed ? "panel-left-open" : "panel-left") + '"></i>';
      refreshIcons();
    },

    setSearch(open) {
      const box = document.getElementById("project-search");
      const input = document.getElementById("project-search-input");
      box.hidden = !open;
      document.querySelector("[data-search-toggle]").setAttribute("aria-expanded", String(open));
      if (open) {
        input.focus();
      } else if (input.value) {
        input.value = "";
        input.dispatchEvent(new Event("input"));
      }
    },

    setProfileMenu(open) {
      document.getElementById("profile-menu").hidden = !open;
      document.querySelector("[data-menu-toggle]").setAttribute("aria-expanded", String(open));
    },

    focusProfileToggle: () => document.querySelector("[data-menu-toggle]").focus(),
  };
})();
