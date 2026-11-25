# JobFit backend

This is an independent Node.js/Express API for the existing React/Vite frontend and PostgreSQL schema. All backend commands in this guide are run from this directory; the frontend and original SQL file are left unchanged.

## What is implemented

- Express app with JSON parsing, frontend-origin CORS, 404 handling, and centralized error responses.
- PostgreSQL connection pool using the `pg` package.
- Read endpoints for the skills catalog and jobs.
- Job creation with its required-skill links written atomically.
- Read/update endpoints for one configured demo student's skills.
- A database health check and tests that exercise the HTTP routes with a fake pool.

There is no authentication yet. The write endpoints use the configured demo identities and the server listens on loopback only; do not expose this version to other machines or production traffic.

## Expected user-facing MVP experience

After the frontend is connected to these endpoints and its field/company identity mapping is resolved:

- **Students** can select technologies they know, browse published jobs and their requirements, check a job's match percentage, see missing skills, and follow the associated course links. The current UI calculates the match and displays recommendations from the data it receives; the API does not calculate the score.
- **Companies** can publish a job with a title, optional description, and required technologies. The API stores it with the configured company identity so it appears in the job list for students.

The MVP does not include applying for jobs, contacting companies, applicant management, job editing/deletion, or registration/login. The current role switch is a UI mode selector, not authentication.

## Project layout

| Path | Responsibility |
| --- | --- |
| `package.json` | Backend-only dependencies and start, watch, and test commands. |
| `.env.example` | Names and example values for local configuration. Copy it to `.env`; do not commit `.env`. |
| `src/config.js` | Loads `backend/.env`, parses the port and demo IDs, and provides shared settings. |
| `src/db.js` | Creates the shared PostgreSQL connection pool. |
| `src/server.js` | Starts the HTTP listener and closes the listener/pool on shutdown. |
| `src/app.js` | Builds the Express application and mounts route/error middleware. |
| `src/routes/` | Implements health, skill, job, and demo-student endpoints. |
| `src/validation.js` | Validates arrays of skill IDs before database writes. |
| `src/transactions.js` | Runs related SQL writes on one client and commits or rolls them back together. |
| `test/app.test.js` | Starts the app on an ephemeral local port and exercises it with mock database responses. |

## How a request moves through the backend

1. `src/server.js` loads the settings and PostgreSQL pool, creates the Express app, and listens on `127.0.0.1`.
2. `src/app.js` applies CORS and JSON parsing, then routes `/api/...` requests to the matching router.
3. A route runs a parameterized SQL query through the injected `pg` pool. The SQL maps the existing database's snake_case columns into a stable API response.
4. An expected input/configuration error becomes a 4xx response. Unexpected errors are logged server-side and returned without exposing database internals.
5. On job/profile writes, `inTransaction` keeps the related statements atomic: either all changes commit, or the database rolls them back.

The app factory accepts a pool as an argument so tests can substitute a mock. The actual server passes the PostgreSQL pool; tests do not connect to a real database.

## Database mapping

The code targets the tables and fields in `../database/jobfit.sql`:

- `skills.id`, `skills.technology_name`, and `skills.affiliate_course_link` become API fields `id`, `name`, and `courseUrl`.
- A job is read from `jobs`, its company display name from `users.full_name`, and its required skills through `job_skills` joined to `skills`.
- Job writes insert into `jobs` and `job_skills` in the same transaction.
- Demo profile skills are read/replaced through `student_skills`.
- The default demo identities are seeded user ID `1` (student) and ID `3` (company). Override these with `DEMO_STUDENT_ID` and `DEMO_COMPANY_ID` if the IDs differ.

The SQL script drops and recreates tables before seeding them. Only run it against a disposable local database; never use it to initialize a database containing data you need to preserve.

## API contract

### `GET /api/health`

Runs `SELECT 1`. A successful response means both the HTTP app and its database connection are available:

```json
{ "status": "ok", "database": "connected" }
```

### `GET /api/skills`

Returns the catalog sorted by ID:

```json
[{ "id": 1, "name": "HTML", "courseUrl": "https://example.test/html" }]
```

### `GET /api/jobs`

Returns jobs newest-ID-first. Each result includes `title`, nullable `description`, company display name, and a `requirements` array of skill objects:

```json
[{
  "id": 1,
  "title": "Junior Developer",
  "description": "Build web interfaces",
  "company": "TechCorp SRL",
  "requirements": [{ "id": 1, "name": "HTML", "courseUrl": "https://example.test/html" }]
}]
```

### `POST /api/jobs`

Creates a job for the configured demo company. The request does not accept a company ID or name: ownership is chosen by backend configuration, not trusted from the caller.

```json
{
  "title": "Junior Developer",
  "description": "Build web interfaces",
  "requiredSkillIds": [1, 2]
}
```

`title` is required and limited to 150 characters. `description` may be omitted, null, or text. `requiredSkillIds` must be a non-empty array of distinct positive IDs that exist in `skills`. Success returns `201` and the created job in the same shape as `GET /api/jobs`.

### `GET /api/demo/student/skills`

Returns the selected skill objects for the configured demo student. The explicit `demo` path signals that this is a fixed local identity, not an authenticated `/me` endpoint.

### `PUT /api/demo/student/skills`

Replaces that demo student's complete skill selection:

```json
{ "skillIds": [1, 2] }
```

An empty array is allowed to clear all skills. Every submitted ID must be a distinct positive integer present in the catalog.

Validation errors return `400`; missing configured demo accounts return `503`; unexpected failures return `500`. Error responses have the shape `{ "error": { "code": "...", "message": "..." } }`.

## Local setup

1. Install PostgreSQL and create a disposable local database.
2. Load `../database/jobfit.sql` into that database. **This script drops and recreates its tables.**
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to the local database connection string. Never paste credentials into source code or commit `.env`.
4. Install dependencies with `npm install`.
5. Run `npm run dev` for Node's watch mode or `npm start` for a normal start.
6. Check `http://127.0.0.1:3000/api/health`.

The defaults are port `3000`, frontend origin `http://localhost:5173`, and TLS enabled. Set `PORT` or `FRONTEND_ORIGIN` in `.env` if Vite uses a different port. Set `DATABASE_SSL=false` only for a local PostgreSQL server that does not support TLS.

The Supabase connection configuration follows the supplied `pg` example and sets `rejectUnauthorized: false`. This encrypts the connection but skips certificate identity verification; use the database provider's recommended certificate-verifying configuration for production if available.

## Tests and verification limits

Run `npm test`. Tests use Node's built-in test runner, start the HTTP app on an available local port, and inject fake pools/clients. They cover response shapes, validation, transaction commit/rollback calls, and error responses.

These are route/unit tests, not PostgreSQL integration tests: the fake clients do not parse or execute SQL. A disposable PostgreSQL database is still required to verify SQL syntax, actual schema compatibility, and persisted results. The frontend is also not wired to these endpoints yet, because this backend work has intentionally stayed within `backend/`.

## Deliberate MVP limits

- No registration, login, sessions/tokens, or per-user authorization.
- Demo identity IDs are configuration, shared by every caller on this local server.
- Matching remains a frontend responsibility for now.
- No job edit/delete, pagination, or production database migration workflow.

Before deploying or exposing the API beyond localhost, replace demo identity handling with authentication and role/ownership authorization.
