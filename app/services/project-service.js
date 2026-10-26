/* Clio — project operations: list, search, create, update, delete.
   Keeps the loaded projects in memory and saves through ProjectRepository. */
(function () {
  "use strict";

  const { ProjectRepository: repo } = window.Clio;

  let projects = repo.loadAll();
  const save = () => repo.saveAll(projects);

  function newId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  window.Clio.ProjectService = {
    STORAGE_KEY: repo.STORAGE_KEY,

    all: () => projects,
    find: (id) => projects.find((p) => p.id === id),

    search(query) {
      query = query.trim().toLowerCase();
      return projects
        .filter((p) => !query
          || p.title.toLowerCase().includes(query)
          || p.keywords.some((k) => k.toLowerCase().includes(query)))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    create(data) {
      const now = Date.now();
      const project = { id: newId(), ...data, createdAt: now, updatedAt: now };
      projects.push(project);
      return { project, saved: save() };
    },

    update(id, data) {
      const project = this.find(id);
      Object.assign(project, data, { updatedAt: Date.now() });
      return { project, saved: save() };
    },

    remove(id) {
      projects = projects.filter((p) => p.id !== id);
      return save();
    },

    /* Re-read storage, e.g. after another tab changed it. */
    reload() {
      projects = repo.loadAll();
    },
  };
})();
