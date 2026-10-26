/* Clio — reads and writes the demo accounts and session in localStorage. */
(function () {
  "use strict";

  const { store } = window.Clio;

  const SESSION_KEY = "clio.demoSession";
  const ACCOUNTS_KEY = "clio.demoAccounts";  // { email: displayName }

  window.Clio.SessionRepository = {
    getAccounts() {
      const accounts = store.get(ACCOUNTS_KEY, {});
      return accounts && typeof accounts === "object" && !Array.isArray(accounts) ? accounts : {};
    },
    saveAccounts: (accounts) => store.set(ACCOUNTS_KEY, accounts),

    getSession() {
      const s = store.get(SESSION_KEY, null);
      return s && typeof s.name === "string" && typeof s.email === "string" ? s : null;
    },
    saveSession: (session) => store.set(SESSION_KEY, session),
    clearSession: () => store.remove(SESSION_KEY),
  };
})();
