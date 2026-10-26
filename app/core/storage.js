/* Clio — safe localStorage wrapper (private mode, quota, corrupt JSON).
   Every model reads and writes through Clio.store. */
(function () {
  "use strict";

  const Clio = (window.Clio = window.Clio || {});

  Clio.store = {
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
    // Raw strings, for values that aren't JSON (the sidebar state).
    getRaw(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setRaw(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
  };
})();
