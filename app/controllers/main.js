/* Clio — runs the system: puts each UI class into its slot in index.html, then draws the icons. */
new Sidebar().mount("sidebar-root");
new Topbar().mount("topbar-root");
new ProjectForm().mount("project-form-root");
new ProjectDetail().mount("project-detail-root");
new AuthModal().mount("auth-modal-root");
new Toast().mount("toast-root-slot");

if (window.lucide) window.lucide.createIcons();
