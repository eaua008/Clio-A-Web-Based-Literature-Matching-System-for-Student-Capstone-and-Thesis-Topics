# Clio — frontend demo

A dark, neon-purple workspace for drafting capstone projects. It is **frontend only**: plain HTML, CSS and vanilla JavaScript. There is no backend, database or real authentication, and all data stays in your browser's `localStorage`.

## Run it

You don't need to install or build anything. Either:

- **Double-click** `index.html` to open it in your browser, or
- serve the project folder and open http://localhost:8000:
  ```bat
  python -m http.server 8000
  ```

## Structure

```text
CLIO/
  index.html          the whole page: sidebar, top bar, project form, detail view, auth modal
  css/
    main.css          design tokens, buttons, fields, tags, toasts
    dashboard.css     sidebar, top bar, project panel, detail view
    modal.css         login / sign-up modal
    responsive.css    tablet and mobile layouts
  app/
    core/
      storage.js            safe localStorage wrapper
      device.js             screen-size helper
    models/
      project.js            project shape and validation rules
      user.js               demo user validation rules
    repositories/
      project-repository.js reads / writes projects in localStorage
      session-repository.js reads / writes demo accounts and session
    services/
      project-service.js    list, search, create, update, delete projects
      auth-service.js       demo login, sign-up, logout
    ui/
      components/
        icons.js            draws Lucide icons
        toast.js            toast notifications
        field-error.js      form field errors
      views/
        sidebar-view.js     sidebar, drawer, search box, profile menu
        project-view.js     project form, tags, list, detail view
        auth-view.js        login / sign-up modal, signed-in top bar
    controllers/
      sidebar-controller.js sidebar and profile-menu events
      auth-controller.js    demo login / sign-up flow
      project-controller.js routing, form, tags, search, edit / delete
  assets/
    images/logo.png
    vendor/lucide.min.js   icon library, bundled locally (no CDN needed)
```

The scripts are classic scripts, not ES modules, so the page also works when opened straight from disk (`file://`). They share helpers through `window.Clio`.

## Demo-only behaviour

- **Login / Sign Up** is simulated. The page checks the email format and the password rules, then remembers your display name and email in `localStorage`. Passwords are never stored, and no real account is created.
- **Continue with Google / Apple / Phone** show a message saying the service isn't connected in this demo.
- **Projects** are saved only in this browser. Clearing site data removes them, and they don't sync between devices.

## Storage keys

| Key | Contents |
| --- | --- |
| `clio.projects` | saved projects |
| `clio.demoSession` | the signed-in demo user's name and email |
| `clio.demoAccounts` | the emails registered in the demo, each with a display name (no passwords) |
| `clio.sidebar` | whether the sidebar is collapsed or expanded |

If stored data is missing or corrupt, the app ignores it and starts empty.
