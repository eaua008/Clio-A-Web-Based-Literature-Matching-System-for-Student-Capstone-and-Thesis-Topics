/* Clio — reads and writes projects in localStorage. */
(function () {
  "use strict";

  const { store, Project } = window.Clio;

  const STORAGE_KEY = "clio.projects";

  window.Clio.ProjectRepository = {
    STORAGE_KEY,

    loadAll() {
      const raw = store.get(STORAGE_KEY, []);
      return Array.isArray(raw) ? raw.map(Project.sanitize).filter(Boolean) : [];
    },

    /* Returns false when the browser refused to save. */
    saveAll: (projects) => store.set(STORAGE_KEY, projects),
  };
})();
