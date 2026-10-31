/* Clio — runs the system: puts each UI class into its slot in index.html, wires the controllers, then draws the icons. */
/* A refresh on an open project (#/projects/<id>) keeps the main area hidden until that project is reopened. */
if (location.hash.startsWith("#/projects/")) document.documentElement.classList.add("project-pending");
const api = new ClioApi();
new Sidebar().mount("sidebar-root");
new Topbar().mount("topbar-root");
new ProjectForm().mount("project-form-root");
new ProjectDetail().mount("project-detail-root");
const projectResults = new ProjectResults(api);
projectResults.mount("project-results-root");
new AuthModal().mount("auth-modal-root");
new SearchDialog().mount("search-dialog-root");
new Toast().mount("toast-root-slot");

const projectNav = new ProjectNav(projectResults, api);
const enterButton = new EnterButton(projectResults, projectNav, api);
enterButton.bind();
projectNav.bind(enterButton);
const auth = new AuthController(api);
auth.bind();

if (window.lucide) window.lucide.createIcons();