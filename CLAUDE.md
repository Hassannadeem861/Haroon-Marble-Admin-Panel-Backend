# CLAUDE.md — Haroon Marble Admin Panel (Backend)

Rules for AI agents working in this repo. Everything here was verified against the code as of 2026-10-06.
Sections marked **CHANGE / REMOVE / DO NOT REPEAT** describe existing code that is wrong: do not copy it.

---

## 1. What this is

Express 5 + Mongoose 8 REST API (ES modules, plain JavaScript, no TypeScript, no build step) for a marble/tiles
contracting business in Pakistan. It covers workers (`Employer`), their daily attendance/pay (`DailyWork`), sites,
site expenses/materials, factory orders (`FactoryWork`), work orders and their sample-approval rounds (`SampleRound`),
plus a dashboard summary. Admin login uses JWT.

- Entry point: `server.js` (also exported as `app` for Vercel; see `vercel.json`).
- Run: `npm run dev` (nodemon) / `npm start`. There are **no tests, no linter, no formatter config**.
- Deploy target: Vercel serverless (`@vercel/node`). Filesystem is read-only/ephemeral there.
- Backups: `.github/workflows/mongodb-backup.yml` runs a daily `mongodump` to Google Drive via rclone (7-day retention).

## 2. Folder structure (actual)

```
server.js            app setup, CORS, middleware, router mounting, listen
database/db.js       mongoose.connect + connection event logging
models/              one Mongoose schema per file, default-exported model
controllers/         request handlers: validation + orchestration + response
routes/              one express.Router per resource, maps paths -> controller functions
middleware/          admin-middle-ware.js (JWT auth), multer-middleware.js (image uploads, USED),
                     multer.js (old memoryStorage config, UNUSED — do not use)
utils/               *-service.js = DB-backed shared read/aggregation logic
                     *-helper-fun.js / helperFun.js = pure helpers
scripts/             one-off migration/backfill scripts run manually with `node scripts/<file>.js`
```

Layering that exists and must be kept: **route -> controller -> (service in utils/) -> model**.
There is no separate `services/` folder; services live in `utils/` with a `-service.js` suffix
(`salary-service.js`, `site-service.js`, `work-order-service.js`).

## 3. How to add a new feature (resource)

1. **Model** `models/<resource>-model.js` (see §6 for schema rules). Default-export `mongoose.model("PascalName", schema)`.
2. **Service (only if needed)** `utils/<resource>-service.js` for logic reused by more than one handler or for
   summaries/aggregations (follow `utils/site-service.js`). Pure math goes in a `*-helper-fun.js` file.
3. **Controller** `controllers/<resource>-controller.js`: one `const fn = async (req, res) => { try {...} catch {...} }`
   per endpoint, a local `format<Resource>(doc)` that converts Date fields to `DD/MM/YYYY`, and a single
   `export { ... }` block at the bottom (named exports, no default export).
4. **Route** `routes/<resource>-route.js`: `express.Router()`, import named handlers, **apply `authMiddleware`**
   (see §8), default-export the router. Declare static paths (e.g. `/sites-list`) **before** `/:id` paths.
5. **Mount** in `server.js` with `app.use("/api/v1", router)` next to the other imports/mounts.
6. Do not modify unrelated modules. Do not rename existing files or paths (the frontend depends on them).

Reference implementations to copy: `controllers/site-controller.js`, `controllers/site-material-controller.js`,
`utils/site-service.js`, `models/site-model.js`. They are the cleanest examples of the house style.
Do **not** use `controllers/factory-work-controller.js` or `controllers/admin-auth-controller.js` as templates.

## 4. API conventions

### Paths
- Base prefix: `/api/v1`.
- Existing convention is action-style kebab-case paths, and new endpoints must match it:
  - `POST   /create-<resource>`
  - `GET    /get-all-<resources>` (list + search + pagination)
  - `GET    /get-single-<resource>/:<resource>Id`
  - `PUT    /update-<resource>/:<resource>Id`
  - `DELETE /delete-<resource>/:<resource>Id` (soft delete)
  - `GET    /<resources>-list` (lightweight dropdown list, no pagination)
- Mounting is inconsistent today: employer, daily-work, work-order, sample-round, dashboard, auth are mounted at
  `/api/v1`; site, site-material, site-expense, factory-work are mounted at `/api/v1/<prefix>`.
  **New routers mount at `/api/v1` with no extra prefix.** Do not change existing mounts.
- Param naming: prefer `:<resource>Id` (`:siteId`, `:employerId`, `:workOrderId`). Some older routes use `:id`; leave them.

### Response shape (the standard; used by employer, daily-work, site, site-*, work-order, sample-round, dashboard)
```js
// success, single
res.status(200).json({ success: true, message: "Site updated successfully.", data: formatSite(site) });
// success, create
res.status(201).json({ success: true, message: "...", data });
// success, list
res.status(200).json({ success: true, data: items, pagination: { page, limit, total, totalPages } });
// failure
res.status(4xx).json({ success: false, message: "Human readable reason." });
```
- `totalPages` is `Math.ceil(total / limit) || 1`.
- Status codes: 201 create, 200 read/update/delete, 400 bad input, 401 unauthenticated, 404 not found
  (including soft-deleted), 500 unexpected.
- **DO NOT REPEAT**: `res.send(<plain text>)` errors (factory-work create), top-level keys like `factoryWork` / `users`
  instead of `data`, flat pagination fields (`total`, `page` at top level), responses without `success`,
  403 for missing fields, 404 for wrong password, 500 for "not found", 201 for login. These exist in
  `factory-work-controller.js` and `admin-auth-controller.js` and are legacy.

### Pagination
Query `page` (default 1) and `limit` (default 10). Use `.skip((page - 1) * limit).limit(Number(limit))`.
New code must coerce and clamp: `page = Math.max(parseInt(page) || 1, 1)`, `limit = Math.min(Math.max(parseInt(limit) || 10, 1), 100)`.
(Existing handlers do not clamp: **CHANGE**.)

### Dates (important)
- The API accepts and returns dates as **`DD/MM/YYYY`** strings in Pakistan time (UTC+5).
- Always use `utils/date-helper-fun.js`:
  - `parseDDMMYYYY(str)` -> `Date | null`
  - `resolveEntryDate(str, fallback)` -> returns `fallback` when `str` is empty, throws `err.status = 400` on bad format.
    Use it inside its own `try/catch` and return `res.status(err.status || 400)` (existing pattern).
  - `formatToDDMMYYYY(date)` in every `format<Resource>` function and in list `.map()`s.
- A parsed date is stored as 00:00 PKT = **19:00 UTC on the previous day**. Any Mongo date math
  (`$year`, `$month`, `$dateToString`, month boundaries) must use `timezone: "Asia/Karachi"` or PKT-based boundaries.
- For an inclusive `endDate` filter use `$lt` on (parsed endDate + 1 day), not `$lte parsed endDate`.
- If a provided `startDate`/`endDate` fails to parse, return 400 (as `getEmployerSalarySlip` does); never put `null` into a filter.
- **DO NOT REPEAT**: `new Date(req.body.someDate)` on user strings (V8 reads `12/08/2026` as 8 December).
  Do not use `parseDDMMYYYY`/`formatToDDMMYYYY` from `utils/helperFun.js` (server-local-time duplicates) or `dayRange`.
- `factory-work` currently takes/returns raw ISO dates: legacy, do not copy.

## 5. Validation

- No validation library is used. Validation is hand-written at the top of each controller, before any DB write,
  returning `400 { success: false, message }`. Keep this style; do not add Joi/Zod/express-validator
  without the owner's approval.
- Required-field pattern (from `createEmployer`):
  ```js
  const missingFields = ["name", "designation", "salary"].filter(
    (key) => req.body[key] === undefined || req.body[key] === null || req.body[key] === "",
  );
  ```
- Numbers: `isValidNonNegativeNumber(v)`; it returns `true` for empty/undefined, so check presence separately for
  required numbers. ObjectIds: `isValidObjectIdString(id)`.
- Validators live in `utils/validators.js` (`isValidNonNegativeNumber`, `isValidObjectIdString`, `isMongooseInputError`).
  **CHANGE**: older controllers (employer, daily-work, site, site-expense, site-material) still import the same
  functions from `scripts/backfillWorkerId.js`; switch them to `utils/validators.js` when you touch them.
  Never add new imports from `scripts/`.
- New code must also:
  - validate every `:id` route param with `isValidObjectIdString` and return 400 (today bad ids throw CastError -> 500);
  - validate enum fields against the schema's enum list and return 400 (today invalid enums -> ValidationError -> 500);
  - verify referenced documents exist and are not soft-deleted (pattern: `Site.findOne({ _id: siteId, deleted_at: null })` then 404);
  - whitelist fields explicitly (`if (x !== undefined) doc.x = x`), never pass `req.body` straight to
    `create`/`findByIdAndUpdate`;
  - trim strings with `value?.trim() || ""` on create, `value.trim()` on update after an `!== undefined` check.

## 6. Models / database

- Connection: `database/db.js` calls `mongoose.connect(MONGODB_URI)` once at startup; do not open connections
  in controllers. Scripts in `scripts/` connect/disconnect on their own.
- Schema conventions (keep them):
  - camelCase fields; foreign keys named `<model>Id` with `ref` and `index: true` (`employerId`, `siteId`, `workOrderId`).
  - Timestamps: `{ timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }`. Sort on `created_at`, never `createdAt`.
  - Soft delete: `deleted_at: { type: Date, default: null, index: true }` on every collection.
  - Strings: `trim: true, default: ""`. Money/quantities: `Number` with `min: [0, "... cannot be negative."]`.
  - Status fields: `String` + `enum` + `default`, indexed when filtered on.
  - Compound indexes for the common list query (`schema.index({ siteId: 1, date: -1 })`).
  - Snapshot values that must not change historically (`DailyWork.salary`, `DailyWork.overtimeAmount`) are copied at write time.
  - Short Roman-Urdu/English JSDoc comments above schemas explaining the business meaning are the house style.
- Query rules:
  - Every read and update filters `deleted_at: null`. Delete = `findOneAndUpdate({ _id, deleted_at: null }, { deleted_at: new Date(), ...optionalStatus })`.
    Never hard-delete business data.
  - Use `.lean()` for list/read-only queries; use document + `.save()` for updates (runs validators).
    If you use `findOneAndUpdate` for updates, pass `{ new: true, runValidators: true }`.
  - Run independent queries with `Promise.all` (as `getSingleSite` and the dashboard do).
  - Prefer `aggregate` with `$group` for totals over loading every document into memory
    (`buildSalarySlip` / `buildSiteSummary` load all rows: **FUTURE IMPROVEMENT**).
  - Search uses `$regex` with `$options: "i"`. New code must escape user input first
    (`s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`). Existing unescaped regex search: **CHANGE**.
  - No transactions are used anywhere. If a new operation writes to two collections (like sample-round -> work-order
    status sync), use a `mongoose.startSession()` transaction or document why partial failure is acceptable.
- Business rules encoded in code (do not silently change):
  - Overtime: `overtimeAmount = (daySalary / 8) * overtimeHours` via `calculateOvertimeAmount` in `utils/salary-helper-fun.js`.
  - Salary slip (`utils/salary-service.js`): only `present` days add base salary; overtime and advances count on all days;
    `netSalary = max(gross - advances, 0)`.
  - Multiple `DailyWork` records per worker per day are currently allowed (unique index intentionally commented out).
  - **Work Report flow** (WorkOrder → SampleRound → SiteIssue). A `SampleRound` is one work attempt; old field names
    kept on purpose: `sampleStartDate` = work started, `sampleReadyDate` = work completed, `clientResponseDate` /
    `responseStatus` / `rejectionNotes` = client response. Rejection → a new round (rework). Only one active round:
    a new round is allowed only when there is none or the latest is `rejected`; only the latest round is editable;
    approval requires all its issues resolved. `roundNumber` = max (incl. soft-deleted) + 1, unique per work order.
  - **WorkOrder.status is derived, never set by hand** — always call `syncWorkOrderStatus(workOrderId, session)`
    (`utils/work-order-service.js`) after any round write, inside the same transaction:
    no round → `pending_sample`; started → `in_progress`; completed → `in_review`; rejected → `rework_required`;
    approved → `approved`. Manually only `cancelled` (and re-open from cancelled) via `update-work-order`.
  - `SiteIssue` = a problem during a round (date, description, `causedBy` client/company/material/weather/other,
    up to 5 photos, `resolvedDate`). `isResolved` / `delayDays` are computed in `formatSiteIssue`, not stored.
    Day counts use Pakistan calendar days (`daysBetween` in `work-order-service.js`) — reuse it.
  - `WorkDay` = one day of work inside a round (daily log: `date` stored as 00:00 PKT + `note`). The round's start day
    is not stored as a WorkDay; `getWorkOrderTimeline` returns `round.dailyLog` = start day (`isStartDay`) + WorkDays
    and `stats.loggedWorkDays`. One date per round, between start (exclusive) and `sampleReadyDate`; past dates allowed
    (backfilling a month). Changing round dates is rejected if a WorkDay would fall outside them.
  - Sample-round writes use `mongoose.startSession()` + `withTransaction` (Atlas replica set). Follow that for
    any new multi-collection write.
  - FactoryWork/vehicle `totalPaid`, `remainingAmount`, `paymentStatus` are virtuals, not stored.

## 7. Error handling

- Current pattern: every handler wraps its body in `try/catch` and returns
  `res.status(500).json({ success: false, message: "Error <doing thing>.", error: error.message })`.
  There is no global error handler and no 404 handler.
- For new handlers:
  - keep the per-handler `try/catch` and the `success: false` shape;
  - map `error.name === "ValidationError"` or `"CastError"` to 400 instead of 500;
  - log unexpected errors with `console.error` and do not add new `error: error.message` fields to 500 responses
    (leaks internals). Existing ones: **CHANGE** later, together with the frontend.
- `server.js` has a final `(err, req, res, next)` JSON error middleware (after all routes): multer errors and
  `INVALID_FILE_TYPE` → 400 with a user-friendly message, bad JSON → 400, everything else → 500 without internals.
  Keep it last. **FUTURE IMPROVEMENT**: a JSON 404 handler.

## 7a. Image uploads (Cloudinary)

- Flow: `authMiddleware` → `uploadIssueImages` (`middleware/multer-middleware.js`, `diskStorage` to
  `os.tmpdir()/haroon-marble-uploads`, server-generated filenames, JPG/PNG/WEBP only, 5 MB/file, max 5, field name
  **`images`**) → controller → `uploadFileOnCloudinary(path)` (`utils/cloudinary.js`) → temp file deleted.
- Temp dir must stay `os.tmpdir()` (Vercel can only write `/tmp`). Never `./public/uploads`, never original filenames.
- Cloudinary incoming transformation (1200px limit, WebP, `quality: auto:good`) runs at upload — only the compressed
  version is stored. Do not add per-request URL transformations (`w_`, `q_auto`, `f_auto`) — they cost credits.
- DB stores `{ url (secure_url), publicId }` per image. Delete with `deleteImg(publicId)`.
- Atomic rules (see `controllers/site-issue-controller.js`): upload all photos in parallel; if any fails, delete the
  ones that succeeded. If the DB write fails, delete the new uploads. When removing photos on update, save the DB
  first, delete from Cloudinary after. Always remove temp files in `finally` (`removeTempFiles(req.files)`).
- Soft-deleting an issue keeps its photos (proof for client disputes).
- Vercel request body limit is ~4.5 MB total; the frontend compresses photos before upload — keep it that way.

## 8. Authentication & authorization

- Access + refresh tokens (`utils/auth-token-service.js`, `models/session-model.js`):
  - `POST /login` → `{ success, message, user (no password), token }`; `token` = access JWT (15 min, `ACCESS_TOKEN_SECRET`,
    payload `{ userId, email, type: "access" }`) sent as `Authorization: Bearer`. Also sets the `refreshToken` cookie
    (random, 30 days, httpOnly, `sameSite: strict`, path `/api/v1`); only its SHA-256 hash is stored in `Session`.
  - `POST /refresh-token` rotates the session (old revoked, new cookie) → `{ data: { accessToken, user } }`. A revoked
    token reused after the 60 s grace window revokes all sessions of that user. `POST /logout` revokes + clears cookie.
  - The cookie only works because the frontend calls the API same-origin (`/api/v1` via its `vercel.json` rewrite /
    Vite proxy). Do not switch the frontend back to calling the backend domain directly.
  - `JWT_SECRET` is now only for password-reset tokens.
- `authMiddleware` (`middleware/admin-middle-ware.js`) verifies the token and sets `req.admin` to the decoded payload
  (so the user id is `req.admin.userId`). It does not load the user from the DB.
- An invalid/expired token returns **401** (the frontend logs the user out on 401).
- **Today only `/api/v1/factory-work/*` and the site-issue routes use `authMiddleware`.** Every other route, including `register`,
  `get-all-admins`, employers, daily work, sites, work orders and the dashboard, is public. This is the top
  security defect (**CHANGE**). Every new route must use `authMiddleware` unless it is explicitly a public auth endpoint
  (`login`, `forget-password`, `reset-password/:token`).
- There are no roles. The `Auth` model has no `role` field. `adminMiddleWare` checks `req.admin._id` and `role`,
  neither of which exists, so it would reject everyone. It is unused. **DO NOT** use it; if roles are needed,
  add `role` to the schema and rewrite the middleware first.
- **DO NOT REPEAT** (all exist in `admin-auth-controller.js`):
  - returning the user document from `register`/`login`/`update-password` (it includes the bcrypt hash; strip
    `password` or select only safe fields);
  - JWTs without `expiresIn`;
  - using the same secret and payload shape for login and password-reset tokens (a login token works as a reset token);
  - leaking whether an email exists in `forget-password`;
  - cookie options `secure: false` with `sameSite: "none"` and the misspelled `maxage`.
- Passwords: `bcrypt` (the native package) with cost 10. `utils/auth.js` imports `bcryptjs`, which is not installed;
  importing it will crash (**REMOVE** or fix before use).

## 9. Naming conventions

- Files: kebab-case, suffixed by layer: `<resource>-model.js`, `<resource>-controller.js`, `<resource>-route.js`,
  `<resource>-service.js`, `<topic>-helper-fun.js`. (Existing files mix `-route`/`-routes`; use `-route.js` for new ones.)
- **DO NOT REPEAT** misspellings: `daliy-work-*`, `site-expence-*`, `getAllAmins`, `admin-middle-ware`. Spell new names correctly.
  Do not rename the existing files unless asked.
- Functions: camelCase verb+Resource matching the route: `createSite`, `getAllSites`, `getSingleSite`, `updateSite`,
  `deleteSite`, `getSitesList`. Formatters: `format<Resource>`. Services: `build<Thing>Summary`, `get<Resource>s`.
- Models: PascalCase singular (`SiteExpense`); the imported variable matches the model name.
- Env vars: UPPER_SNAKE_CASE.

## 10. Configuration & environment

Variables read by the code: `MONGODB_URI`, `PORT`, `JWT_SECRET` (reset-password only), `ACCESS_TOKEN_SECRET` (required, login access tokens), `FRONTEND_LIVE_URL` (the only CORS origin),
`MY_EMAIL`, `MY_PASSWORD`, `SERVER_URL` (password-reset mail; the last three are not in `.env`).
`FRONTEND_LOCAL_URL` (CORS origin used during local dev — `server.js` switches between the two by commenting).
Cloudinary: `CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required; missing → error logged at startup),
`CLOUDINARY_FOLDER` (optional, default `haroon-marble/site-issues`).
`UPLOAD_TEMP_DIR` (optional, local dev only — multer temp folder when the OS temp drive is full; never set on Vercel).
Backups use GitHub secrets `MONGODB_URI`, `RCLONE_CONFIG_B64`.

- `.env` is gitignored and has never been committed. Keep it that way; never print, log or commit secret values.
- ES module imports run before `server.js`'s `dotenv.config()` line, so a module that reads `process.env` at
  import time (top level) must call `dotenv.config()` itself (as `database/db.js` and `utils/cloudinary.js` do).
  Prefer reading env inside functions.
- Locally, Atlas SRV lookups need `dns.setServers(["1.1.1.1","8.8.8.8"])` (done in `database/db.js`); copy it into
  any standalone script that connects to the DB.
- Add any new env var to this list and fail fast with a clear message if it is required and missing.

## 11. Dependencies

- Allowed and in use: express, mongoose, jsonwebtoken, bcrypt, cors, cookie-parser, morgan, dotenv, nodemailer,
  multer (`middleware/multer-middleware.js`), cloudinary.
- Installed but unused: `xlsx`
  (0.18.5 on npm has known unpatched vulnerabilities), `dayjs`, `date-fns`. `nodemon` is in `dependencies` and belongs in
  `devDependencies`. **REMOVE/CHANGE** these only when asked.
- Do not add a dependency without the owner's approval. Never add a second date library; use `utils/date-helper-fun.js`.
- File uploads: follow §7a (temp disk in `os.tmpdir()` → Cloudinary). `server.js` still serves `/uploads` from
  `public/uploads`; nothing uses it and Vercel cannot write there.

## 12. Security rules (for all new code)

1. Protect every non-auth route with `authMiddleware`.
2. Never return password hashes, tokens of other users, or raw `error.stack`.
3. Escape user input before `$regex`; clamp `limit`; validate ObjectIds and enums before querying.
4. Whitelist writable fields; never spread `req.body` into a model.
5. JWTs must have an expiry; reset tokens must use a distinct secret/purpose claim and be single-use.
6. Do not widen CORS (`allowedOrigins` in `server.js`) without the owner's approval.
7. Scripts in `scripts/` that drop or rewrite collections (`migration-daily-work.js` drops `employers` and
   `dailyworks`) must never be run without explicit instruction and a fresh backup.

## 13. Logging

`morgan("dev")` for requests plus ad-hoc `console.log`/`console.error`. No logger library; keep it that way
unless asked. Do not log request bodies (they contain passwords) or secrets. Remove debug `console.log`s before finishing.

## 14. File modification rules for agents

- Make the smallest change that solves the task. Match the surrounding style (2-space indent, double quotes,
  semicolons, trailing commas, `async` arrow functions, named exports at file bottom).
- Do not refactor, rename or reformat files you were not asked to touch. Do not change response shapes or paths of
  existing endpoints; the React frontend depends on them.
- Do not leave commented-out code blocks behind (the codebase already has many: **DO NOT REPEAT**).
- When fixing a legacy pattern listed here, fix it the way this file describes and update this file.
- There are no tests. After changes, at least run `node --check <file>` on edited files and start the server
  (`npm run dev`) to confirm it boots.

## 15. Known defects (do not rely on this behaviour; fix only when asked)

| Where | Defect |
|---|---|
| `controllers/factory-work-controller.js` `updateFactoryWork` | advance payment is written before the "no fields provided" check, so a request with only `advanceAmount` saves and then returns 400. |
| factory-work create/update/setVehicleInfo | `new Date("DD/MM/YYYY")` stores wrong dates (month/day swapped or Invalid Date). |
| `controllers/dashboard-controller.js` | `monthlyPayroll` and `monthlyPayrollTrend` include salary of absent days (salary slip does not); month start uses server time and `$year/$month` use UTC, so 1st-of-month entries land in the previous month. `advanceOutstanding` is the all-time sum of advances, not an outstanding balance. |
| daily-work / site-expense / site-material lists, salary slip | `endDate` filter uses `$lte` midnight, excluding most entries made on the end date; invalid dates become `null` filters instead of 400. |
| `controllers/employer-controller.js` | `workUnder` is written/searched but is not in the Employer schema (silently dropped). `getWorkersList` says "active" but does not filter on `status`. |
| `controllers/admin-auth-controller.js` | `getAllAmins` sorts on `createdAt` (field is `created_at`); returns 404 for an empty list; `getSingleAdmin` returns 500 for not found. |
