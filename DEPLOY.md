# Deploying Creedence (free tiers)

| Piece | Host | Plan |
|---|---|---|
| Web app (`apps/web`) | Vercel | Hobby (free) |
| API + worker (`apps/api`, `apps/worker`) | Render | Free web service, one process (`RUN_WORKER=true`) |
| Database and sign-in | Supabase | as now |
| Keep-awake ping | cron-job.org | free |

Render's free web services sleep after about 15 minutes without traffic, and
background workers aren't free. So the API runs the worker's jobs itself, and a
ping every 10 minutes keeps it awake, so reminders go out on time. One service
running all month uses about 744 of Render's 750 free hours, so don't run a
second Render service on the same account.

Never paste a secret into GitHub, a chat or this file. Copy values from your
local `.env` straight into the hosts' dashboards.

---

## 1. Render: the API (and the worker inside it)

1. **New → Blueprint**, pick the `productivity` repo. Render reads `render.yaml`
   and proposes one free web service, `creedence-api`.
2. It asks for the secret values. Copy each from the repo-root `.env`:
   - `DATABASE_URL`, `DIRECT_URL`
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`: a real contact, for example `mailto:you@yourdomain.com`
3. **Environment → Secret Files → Add**: name it `firebase-service-account.json`
   and paste the contents of your local `firebase-service-account.json`. The
   service reads it at `/etc/secrets/firebase-service-account.json`.
4. Deploy. The build installs, generates the database client, builds the API
   and applies any new database migrations. The log should end with:
   ```
   API listening on http://localhost:10000/api
   [worker] started 2 job(s)
   ```
   with no "push is off" lines.
5. Note the service's address, for example `https://creedence-api.onrender.com`,
   and check `https://creedence-api.onrender.com/api/health` answers.

Don't add `ALLOW_DEV_USER` or `DEV_USER_ID` here: they let a request without a
sign-in act as a user, for local development only.

## 2. cron-job.org: keep the API awake

**Create cronjob**:
- URL: `https://creedence-api.onrender.com/api/health`
- Schedule: every 10 minutes
- Save, then check its history shows `200` responses.

## 3. Vercel: the web app

1. In `apps/web/vercel.json`, replace `YOUR-RENDER-SERVICE` with your Render
   service's name (step 1.5) and push the change.
2. **Add New → Project**, import the `productivity` repo.
   - **Root Directory**: `apps/web`
   - Framework, build command and output come from `vercel.json`.
   - **Settings → General → Node.js Version**: 24.x
   - **Environment Variables** (public, from `apps/web/.env.local`):
     `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy, then open the address, for example `https://creedence.vercel.app`.

`vercel.json` sends `/api/*` to Render (so the API needs no CORS) and serves
`index.html` for every other path (so refreshing `/tasks` works).

## 4. Supabase: let sign-in links return to the hosted app

**Authentication → URL Configuration**:
- **Site URL**: your Vercel address
- **Redirect URLs**: add `https://<your-app>.vercel.app/**`, and keep
  `http://localhost:5173/**` for development.

Without this, confirmation, password-reset and email-change links won't come
back to the hosted app.

## 5. Check it works

1. Sign in on the Vercel address; tasks and notes sync.
2. **Account → Notifications → Turn on for this browser**. Add a reminder two
   minutes ahead and close the tab: it should pop up, sent by the API's worker.
3. **Forgot password** on the sign-in page: the email's link opens the Vercel app.

## 6. The phone

In `apps/mobile/.env` (not committed):
```
EXPO_PUBLIC_API_URL=https://creedence-api.onrender.com/api
EXPO_PUBLIC_WEB_URL=https://<your-app>.vercel.app
```
Then build a release APK, which no longer needs your PC or Metro.

---

## Notes

- **Locally nothing changes.** Don't set `RUN_WORKER` on your PC: the API and
  worker run separately as before. Never run a separate worker *and*
  `RUN_WORKER=true` against the same database; it stays safe (each alert is
  claimed once before it's sent) but does the work twice.
- **Restarts.** Free services restart now and then. A reminder due during a
  short gap still goes out: the worker sends alerts up to two hours late.
- **Migrations** run in the Render build (free services have no pre-deploy
  step). A failed migration fails the build, and the running version stays up.
- **Moving to paid later:** split the worker into its own Render Background
  Worker (`npm run start -w @productivity/worker`), remove `RUN_WORKER` from the
  API, and the cron-job.org ping is no longer needed.
