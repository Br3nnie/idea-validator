# Idea Validator

AI-powered startup idea validation. Answer 6 questions, get a full validation model with assumptions, scoring, and Go/Test/Kill verdict.

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
