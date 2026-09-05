# Test My Idea

AI-powered startup idea testing. A founder answers six questions and receives a structured decision model, report email, assumptions, scores, validation plan, and Go/Test/Kill verdict.

Production: [www.testmyidea.co.uk](https://www.testmyidea.co.uk)

## Local development

Requires Node.js 24 and npm.

```bash
npm ci
npm run migrate
npm run dev
```

Run `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`, and `npm audit --omit=dev` before release. Install the Playwright browser once with `npx playwright install chromium`.

## Architecture

- `POST /api/submissions` validates the request, verifies Turnstile when enabled, enforces durable quotas, and creates one record per browser-generated request key. It returns `202` while the three parallel Anthropic passes and email delivery continue in the function lifecycle.
- `GET /api/submissions/[requestKey]` lets the browser reconnect to an in-progress report after refresh. Draft answers are retained in browser storage until completion.
- Completed reports include an editable validation-experiment workspace and can create one active, revocable, 30-day private share link. Share responses exclude submitter details and are marked `noindex`.
- The dashboard includes a privacy-preserving 30-day funnel based on hashed, anonymous session IDs.
- `/api/validate` is retired. The browser cannot submit arbitrary prompts or mark records complete.
- `/admin/submissions` uses a signed, HttpOnly admin session. Login throttling is stored in Postgres rather than function memory.
- `/api/maintenance/retention` is called daily by Vercel Cron and removes expired submissions.

## Environment variables

Required: `ANTHROPIC_API_KEY`, `DATABASE_URL` or `POSTGRES_URL`, `LOOPS_API_KEY`, `LOOPS_REPORT_TRANSACTIONAL_ID`, `LOOPS_OWNER_TRANSACTIONAL_ID`, `OWNER_NOTIFICATION_EMAIL`, `ADMIN_DASHBOARD_PASSWORD` (at least 12 characters), and `CRON_SECRET`.

Optional configuration:

- `LOOPS_MAILING_LIST_ID` — used only when the submitter explicitly opts into updates
- `ANTHROPIC_MODEL` — defaults to `claude-sonnet-4-6`
- `ANTHROPIC_INPUT_USD_PER_MILLION` — defaults to `3`
- `ANTHROPIC_OUTPUT_USD_PER_MILLION` — defaults to `15`
- `USD_TO_GBP_RATE` — defaults to `0.75`
- `SUBMISSION_RETENTION_DAYS` — defaults to `365`, constrained to 30–3650
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` — enable Cloudflare Turnstile when both are configured
- `DAILY_SPEND_ALERT_GBP` — daily generation-cost warning threshold; defaults to `5`
- `SPEND_ALERT_WEBHOOK_URL` — optional JSON webhook that receives the daily threshold alert
- `PUBLIC_SITE_URL` — base URL used for private report links; defaults to production

## Database migrations

Schema changes are versioned in `scripts/migrate.mjs` and must run before deployment:

```bash
vercel env run -- npm run migrate
```

Application requests verify that the required tables exist but do not run DDL.

## Loops templates

- Customer report: `cmto9lthf0k6o0jzbgwmje05n`
- Owner notification: `cmto9smil0kd80jvselbch6x4`

The customer payload uses separate variables for every section and list row. Its template must include `assumption1`–`assumption4`, `score1`–`score6`, `validation1`–`validation4`, `next1`–`next5`, plus `evidenceLevel`, `evidenceRationale`, `evidenceGap`, and `verdictChange`. Do not replace these with one large report variable.

## Data handling

Submissions contain email addresses, founder answers, generated reports, request metadata, delivery status, and usage/cost information. The public privacy notice explains processing, subprocessors, and deletion requests. Marketing-list enrolment is optional and separate from delivery of the requested report.

Records are deleted by the retention cron after the configured period. Requests for access, correction, or deletion are handled through `brendan@corbelle.ai`.

## Release process

1. Run the migration when schema changes exist.
2. Run tests, lint, build, and audit.
3. Merge through the protected production branch.
4. Confirm the Vercel deployment is Ready and smoke-test the homepage, admin authentication, one real report, and both email deliveries.
