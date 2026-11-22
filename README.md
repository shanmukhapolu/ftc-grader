# FTC Grader

AI-assisted engineering portfolio and presentation evaluation against competition-specific manuals and judging rubrics.

## Stack

- React + Vite
- Firebase Hosting (static site)
- OpenRouter API called directly from the browser
- Model: `inclusionai/ling-3.2-flash:free`
- PDF.js for selectable-text PDF extraction
- JSZip for PowerPoint slide-text extraction

## Requirements

- Node.js 20 or newer
- Firebase CLI: `npm install -g firebase-tools`
- An OpenRouter API key

## Local setup (PowerShell)

```powershell
git clone https://github.com/shanmukhapolu/ftc-grader.git
cd ftc-grader
npm install
npm install -g firebase-tools
firebase login
firebase use ftc-grader
```

Create your local environment file in the project root:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Replace the placeholder with your newly generated OpenRouter key, then save the file.

The file is ignored by Git. Do not commit it. **Important:** Vite embeds `VITE_*` variables into the public JavaScript bundle during build. This design intentionally sends the OpenRouter request directly from each visitor's browser, so anyone who can access the deployed site can extract the key. Use a dedicated key with no paid balance, set strict limits where available, and rotate it if usage becomes abnormal. Never reuse a personal or production key.

Run locally:

```powershell
npm run dev
```

## Deploy to Firebase Hosting

```powershell
npm run deploy
```

The command builds the frontend using the local `.env.local` value and deploys the static `dist` folder to the Firebase project selected by `firebase use`.

Firebase Hosting alone does not require Cloud Functions. This project does not deploy or use Cloud Functions.

## Evaluation workflow

1. Upload a team submission (PDF, PPTX, TXT, or Markdown).
2. Upload the official rubric/manual.
3. The browser extracts selectable PDF text or PowerPoint slide text and preserves page/slide markers.
4. The browser sends extracted text directly to OpenRouter.
5. The app displays a structured rubric evaluation, evidence, gaps, recommendations, strengths, and questions.

## Limitations

- Scanned/image-only PDFs are not OCR'd.
- PPTX extraction reads slide text, not embedded images, charts, or speaker notes.
- PDF extraction reads selectable text; page images are not visually analyzed.
- Very large files are truncated to fit one model request.
- Direct browser requests expose the configured API key to site visitors. There is no server-side rate limit or shared-key protection in this static-only setup.
- The free model's availability and rate limits are controlled by OpenRouter and may change.
- AI scores are practice estimates, not official judging results. Confirm findings against the competition manual.

## Firebase configuration

The Firebase web configuration in `src/firebase.js` is public client configuration. It is not a server secret. Protect any Firebase products you add later with appropriate Security Rules.

## Evaluation integrity

The evaluator is instructed to use only the supplied rubric, distinguish missing evidence from weak evidence, avoid inventing requirements, and cite extracted page/slide markers. AI output still requires human review.
