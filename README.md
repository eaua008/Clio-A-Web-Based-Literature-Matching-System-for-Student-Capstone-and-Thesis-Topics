# Clio — frontend demo

A dark, neon-purple workspace for drafting capstone projects. It is **frontend only**: plain HTML, CSS and vanilla JavaScript. There is no backend, database or real authentication, and all data stays in your browser's `localStorage`.

## Run it

You don't need to install or build anything. Either:

- **Double-click** `frontend/index.html` to open it in your browser, or
- serve the folder and open http://localhost:8000:
  ```bat
  cd frontend
  python -m http.server 8000
  ```

## Structure

```text
frontend/
  index.html          the whole page: sidebar, top bar, project form, detail view, auth modal
  css/
    main.css          design tokens, buttons, fields, tags, toasts
    dashboard.css     sidebar, top bar, project panel, detail view
    modal.css         login / sign-up modal
    responsive.css    tablet and mobile layouts
  js/
    main.js           shared helpers (safe storage, toasts, field errors), sidebar, profile menu
    auth-modal.js     demo login / sign-up flow
    projects.js       project form, keyword tags, list, search, detail / edit / delete
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
