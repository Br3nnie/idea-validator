# Test My Idea

AI-powered startup idea testing. Answer 6 questions, get a full decision model with assumptions, scoring, and a Go/Test/Kill verdict.

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create idea-validator --public --push
```

### 2. Deploy on Vercel
- Go to vercel.com → Add New Project
- Import your GitHub repo
- Click Deploy (no build settings needed — Next.js auto-detected)

### 3. Add your API key
- In Vercel dashboard → your project → Settings → Environment Variables
- Add: `ANTHROPIC_API_KEY` = your key from console.anthropic.com
- Redeploy (Settings → Deployments → Redeploy)

That's it. Your app is live at `your-project.vercel.app`.

## Local dev
```bash
npm install
echo "ANTHROPIC_API_KEY=your_key_here" > .env.local
npm run dev
```
Open http://localhost:3000

## Email capture

The email gate appears after the sixth question and before the AI model is generated. To save captures to Loops, configure these Vercel environment variables:

- `LOOPS_API_KEY`
- `LOOPS_MAILING_LIST_ID` (optional)
- `LOOPS_REPORT_TRANSACTIONAL_ID`
- `LOOPS_OWNER_TRANSACTIONAL_ID`
- `OWNER_NOTIFICATION_EMAIL`

Captured contacts receive the source `test-my-idea` and an abbreviated idea summary. The assessment still works if Loops is not configured.

After a report completes, Loops sends the complete assessment to the submitter and a concise notification to the owner. Both sends use idempotency keys, and delivery status/errors are stored on the submission and shown in the admin dashboard.

## Submission storage

Connect a Neon Postgres resource to the Vercel project and provide `DATABASE_URL` (or `POSTGRES_URL`). The app creates its `submissions` table on the first captured submission and stores:

- the email address and all six answers;
- the complete generated validation model;
- verdict, confidence, and average score for filtering;
- input/output token usage plus estimated USD and GBP cost;
- Loops capture status, page/referrer metadata, and generation failures.

Storage is server-only. If no database is configured or it is temporarily unavailable, Loops capture and idea testing continue to work, and the failure is written to the Vercel function logs.

Cost estimates use Claude Sonnet 4.6 standard pricing ($3 per million input tokens and $15 per million output tokens). Set `USD_TO_GBP_RATE` in Vercel to control the GBP conversion; it defaults to `0.75` and is stored with each submission.
