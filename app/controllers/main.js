/* Clio — runs the system: puts each UI class into its slot in index.html, wires the controllers, then draws the icons. */
new Sidebar().mount("sidebar-root");
new Topbar().mount("topbar-root");
new ProjectForm().mount("project-form-root");
new ProjectDetail().mount("project-detail-root");
const projectResults = new ProjectResults();
projectResults.mount("project-results-root");
new AuthModal().mount("auth-modal-root");
new SearchDialog().mount("search-dialog-root");
new Toast().mount("toast-root-slot");

const api = new ClioApi();
const projectNav = new ProjectNav(projectResults);
const enterButton = new EnterButton(projectResults, projectNav, api);
enterButton.bind();
projectNav.bind(enterButton);
new AuthController(api).bind();

if (window.lucide) window.lucide.createIcons();
