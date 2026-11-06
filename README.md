# Clio

A web-based literature matching system for student capstone and thesis topics.

A student enters a project title, abstract and keywords. Clio compares them against a collection of papers and GitHub repositories, then shows the closest matches with a similarity score. The student can label each match (Duplicate, Similar, Related background, Not relevant) and add a note on how their project differs.

## How the system works

**Frontend** (`app/views/`)
Plain HTML, CSS and JavaScript with no build step. `index.html` is the single page. In `scripts/`, the classes in `components/` draw the screens, the classes in `controllers/` handle clicks, login and the project list, and `services/` talks to the Flask API (`api-client.js`) or straight to Supabase (`supabase-direct.js`). `config.js` holds the connection settings, and `styles/` holds the CSS.

**Backend** (Flask, in `app/`)
- `controllers/` has the routes: auth, projects, matches, and serving the frontend files.
- `models/` holds the project and study classes and saves them to Supabase.
- `services/` holds the matching engine (tokenizer, TF-IDF, scoring, matcher), the label rules and the login logic.
- `serializers/` shapes the JSON the API returns.
- `app.py` builds the Flask app, `config.py` reads the settings, `middleware.py` blocks cross-site writes, and `errors.py` defines the errors the API returns.

**Database** (Supabase, in `database/`)
PostgreSQL tables for profiles, studies, projects and matches. Row Level Security makes sure users only see their own projects. Supabase Auth handles accounts. `03_functions.sql` also holds `match_studies()`, a SQL version of the matcher used by the GitHub Pages site.

**Matching**
1. The title, abstract and keywords are cleaned, split into words, stripped of common words and stemmed ("sensors" becomes "sensor").
2. Every study goes through the same steps.
3. Each word gets a TF-IDF weight, so rare words count more.
4. Studies are ranked by similarity. A score of 50 or more is High, 20 or more is Medium, and anything lower is Low.

## Deployment note

Clio runs with Flask, as described in "How to run" below. The GitHub Pages site (`.github/workflows/static.yml`) publishes only the `app/views` folder, with no Flask server. In that case the page talks to Supabase directly (`supabase-direct.js`) and uses the `match_studies()` function in `database/03_functions.sql` for matching.

## How to run

Run every command below from the repository root.

### Requirements
- Python 3.10 or newer
- A free [Supabase](https://supabase.com) project

### 1. Set up the database
In the Supabase SQL Editor, run the files in `database/` in this order:
`01_schema.sql`, `02_rls.sql`, `03_functions.sql`, `04_hardening.sql`, `05_seed_studies.sql`.

05_seed_studies.sql loads 91 starter studies (OpenAlex papers and GitHub repositories), enough to start matching right away. The studies table is built to hold a much larger collection, and matches improve as more studies are added.

The files 09_full_abstracts_1.sql to 09_full_abstracts_7.sql are optional. They replace shortened abstracts (ending in "…") with the full text for studies that are already in the table, matched by DOI. They cover 3,172 studies, so with only the starter studies loaded just 29 of them apply.

### 2. Add your Supabase keys
Create a file named `.env` in the repository root, next to the `app` and `database` folders:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-public-anon-or-publishable-key
```

Find both in Supabase under Project Settings > API. Use the public key only. Never commit the `service_role` key or the `.env` file.

Flask reads `.env` from the folder you start it in, so always run it from the repository root.

`app/views/scripts/config.js` also holds a Supabase URL and key, but only the GitHub Pages site uses them. The file in the repository already contains a URL and key, so replace them with your own if you deploy that way.

### 3. Install and start

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r app/requirements.txt
python -m flask --app app.app run
```

### 4. Open the app
Go to <http://127.0.0.1:5000/app/>

Open it through Flask, not by double-clicking the HTML file, so the page and the API share one origin.