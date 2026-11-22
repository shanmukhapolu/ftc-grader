# FTC Grader

AI-assisted engineering portfolio and presentation evaluation against competition-specific manuals and judging rubrics.

## Stack

- React + Vite
- Firebase Hosting for the frontend
- Firebase Cloud Functions (Node.js 20) for secure server-side evaluation
- Firebase Functions Secret Manager for the OpenRouter API key
- PDF.js for selectable-text PDF extraction in the browser
- JSZip for extracting text from PowerPoint files
- OpenRouter model: `inclusionai/ling-3.2-flash:free`

## Requirements

- Node.js 20 or newer
- A Firebase project with the Blaze (pay-as-you-go) plan enabled for Cloud Functions deployment. The model may be free, but Firebase Functions deployment requires billing enabled.
- Firebase CLI: `npm install -g firebase-tools`
- An OpenRouter API key

## Local setup (PowerShell)

```powershell
git clone https://github.com/shanmukhapolu/ftc-grader.git
cd ftc-grader
git checkout feature/ai-portfolio-evaluator
npm install
cd functions
npm install
cd ..
npm install -g firebase-tools
firebase login
firebase use ftc-grader
```

Set the OpenRouter secret once:

```powershell
firebase functions:secrets:set OPENROUTER_API_KEY
```

When prompted, paste your newly generated OpenRouter key. Do not put it in the React app, a `VITE_` variable, or a committed file.

For local function emulation, create `functions/.secret.local` with this single line:

```text
OPENROUTER_API_KEY=your_new_openrouter_key
```

The local secret file is ignored by Git. Start the emulators in one PowerShell window:

```powershell
npm run build
firebase emulators:start --only hosting,functions
```

Open the local Hosting emulator URL printed by Firebase CLI (normally http://127.0.0.1:5000).

## Deploy

From the repository root:

```powershell
npm run deploy
```

Or deploy the pieces separately:

```powershell
npm run deploy:functions
npm run deploy:hosting
```

Firebase Hosting rewrites `/api/evaluate` to the `evaluate` Cloud Function in `us-central1`. The React app calls the same relative path locally and in production.

## Current workflow

1. Upload a team submission (PDF, PPTX, TXT, or Markdown).
2. Upload the official rubric/manual in one of those formats.
3. The browser extracts selectable PDF text or PowerPoint slide text and preserves page/slide markers.
4. The Cloud Function sends extracted text to OpenRouter using Ling 3.2 Flash.
5. The app displays a structured rubric evaluation, evidence, gaps, recommendations, strengths, and questions.

## Current limitations

- Scanned/image-only PDFs are not OCR'd.
- PPTX extraction reads slide text, not embedded images, charts, or speaker notes.
- PDF extraction reads selectable text; page images are not visually analyzed.
- Very large files are truncated to fit a single model request.
- The in-memory per-instance rate limit is a basic abuse deterrent, not a global quota; use Firebase App Check and/or Firebase Authentication before making the app broadly public.
- AI scores are estimates for practice and are not official judging results. Confirm findings against the source manual.

## Security

The OpenRouter key is stored as a Firebase Functions secret named `OPENROUTER_API_KEY`. The browser never receives it. If a key is exposed, revoke it in OpenRouter and set a replacement with `firebase functions:secrets:set OPENROUTER_API_KEY`. Never commit secrets.

The Firebase web configuration in `src/firebase.js` is public client configuration. Protect your Firebase resources with appropriate Security Rules; do not treat the Firebase web API key as a server secret.

## Evaluation integrity

The evaluator is instructed to use only the supplied rubric, distinguish missing evidence from weak evidence, avoid inventing requirements, and cite extracted page/slide markers. AI output still requires human review.
