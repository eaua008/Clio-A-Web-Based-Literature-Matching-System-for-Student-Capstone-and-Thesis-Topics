/* Clio — device / screen helpers. */
(function () {
  "use strict";

  const Clio = (window.Clio = window.Clio || {});

  Clio.isMobile = () => window.matchMedia("(max-width: 768px)").matches;
})();
