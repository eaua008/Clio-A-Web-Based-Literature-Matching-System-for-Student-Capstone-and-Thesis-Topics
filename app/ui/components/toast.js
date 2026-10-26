/* Clio — toast notifications. */
(function () {
  "use strict";

  const { refreshIcons } = window.Clio;

  const TOAST_ICONS = { success: "check-circle-2", error: "alert-circle", info: "info" };

  window.Clio.toast = function (message, level) {
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
  };
})();
