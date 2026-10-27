/* Clio — apply the remembered sidebar state before first paint to avoid a flash. */
try { if (localStorage.getItem("clio.sidebar") === "collapsed") document.documentElement.classList.add("sidebar-collapsed"); } catch (e) {}
