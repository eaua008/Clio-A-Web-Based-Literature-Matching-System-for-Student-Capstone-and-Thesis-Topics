/* Clio — shared helpers, sidebar and profile menu.
   Exposes window.Clio for auth-modal.js and projects.js. */
(function () {
  "use strict";

  const root = document.documentElement;
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  /* ---------- Safe localStorage (private mode, quota, corrupt JSON) ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- Toasts ---------- */
  const TOAST_ICONS = { success: "check-circle-2", error: "alert-circle", info: "info" };

  function toast(message, level) {
    level = TOAST_ICONS[level] ? level : "success";
    const el = document.createElement("div");
    el.className = "toast toast--" + level;
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", TOAST_ICONS[level]);
    const text = document.createElement("span");
    text.textContent = message;
    el.append(icon, text);
    document.getElementById("toast-root").appendChild(el);
    refreshIcons();
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 260);
    }, 4200);
  }

  /* ---------- Field errors ---------- */
  function setFieldError(name, message, input) {
    const el = document.querySelector('[data-error-for="' + name + '"]');
    if (!el) return;
    el.textContent = message || "";
    el.closest(".field").classList.toggle("field--invalid", Boolean(message));
    input = input || document.getElementById(name);
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function focusFirstInvalid(container) {
    const el = container.querySelector(".field--invalid input, .field--invalid textarea");
    if (el) el.focus();
  }

  /* ---------- Sidebar ---------- */
  const backdrop = document.querySelector(".sidebar-backdrop");

  function setDrawer(open) {
    root.classList.toggle("sidebar-open", open);
    backdrop.hidden = !open;
    document.querySelector("[data-sidebar-open]").setAttribute("aria-expanded", String(open));
  }

  function setCollapsed(collapsed) {
    root.classList.toggle("sidebar-collapsed", collapsed);
    try { localStorage.setItem("clio.sidebar", collapsed ? "collapsed" : "expanded"); } catch (e) { /* ignore */ }
    const btn = document.querySelector("[data-sidebar-toggle]");
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.innerHTML = '<i data-lucide="' + (collapsed ? "panel-left-open" : "panel-left") + '"></i>';
    refreshIcons();
  }

  function setSearch(open) {
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
  }

  /* ---------- Profile menu ---------- */
  function setProfileMenu(open) {
    const menu = document.getElementById("profile-menu");
    menu.hidden = !open;
    document.querySelector("[data-menu-toggle]").setAttribute("aria-expanded", String(open));
  }

  document.addEventListener("click", (evt) => {
    const t = evt.target;
    if (t.closest("[data-sidebar-toggle]")) setCollapsed(!root.classList.contains("sidebar-collapsed"));
    if (t.closest("[data-sidebar-open]")) setDrawer(true);
    if (t.closest("[data-sidebar-close]")) setDrawer(false);

    if (t.closest("[data-search-toggle]")) {
      if (root.classList.contains("sidebar-collapsed") && !isMobile()) {
        setCollapsed(false);
        setSearch(true);
      } else {
        setSearch(document.getElementById("project-search").hidden);
      }
    }

    const menu = document.getElementById("profile-menu");
    if (t.closest("[data-menu-toggle]")) setProfileMenu(menu.hidden);
    else if (!menu.hidden && !t.closest("#profile-menu")) setProfileMenu(false);
  });

  document.addEventListener("keydown", (evt) => {
    if (evt.key !== "Escape" || document.body.classList.contains("modal-open")) return;
    if (!document.getElementById("profile-menu").hidden) {
      setProfileMenu(false);
      document.querySelector("[data-menu-toggle]").focus();
    }
    if (root.classList.contains("sidebar-open")) setDrawer(false);
  });

  window.Clio = {
    store,
    toast,
    refreshIcons,
    setFieldError,
    focusFirstInvalid,
    closeDrawer: () => setDrawer(false),
    closeProfileMenu: () => setProfileMenu(false),
    isMobile,
  };

  setCollapsed(root.classList.contains("sidebar-collapsed"));
  refreshIcons();
})();
