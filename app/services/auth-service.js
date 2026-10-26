/* Clio — demo login / sign-up.
   DEMO ONLY: nothing leaves the browser. Passwords are validated for format but never
   stored or checked; the "session" is just a name and email kept in localStorage. */
(function () {
  "use strict";

  const { SessionRepository: repo } = window.Clio;

  window.Clio.AuthService = {
    hasAccount: (email) => Object.prototype.hasOwnProperty.call(repo.getAccounts(), email),

    /* Display name for a known email, or the part before "@". */
    nameFor: (email) => repo.getAccounts()[email] || email.split("@")[0],

    register(email, name) {
      const accounts = repo.getAccounts();
      accounts[email] = name;
      repo.saveAccounts(accounts);
    },

    currentUser: () => repo.getSession(),
    login: (name, email) => repo.saveSession({ name, email }),
    logout: () => repo.clearSession(),
  };
})();
