/* Clio — draws Lucide icons for any new data-lucide elements. */
(function () {
  "use strict";

  window.Clio.refreshIcons = function () {
    if (window.lucide) window.lucide.createIcons();
  };
})();
