# FTC Grader

AI-assisted engineering portfolio and presentation evaluation against competition-specific manuals and judging rubrics.

## Stack

- React + Vite
- PDF.js for selectable-text PDF extraction in the browser
- JSZip for extracting text from PowerPoint files
- Netlify Function for secure server-side OpenRouter requests
- InclusionAI Ling 3.2 Flash free variant: `inclusionai/ling-3.2-flash:free`

## Local setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Install the Netlify CLI: `npm install -g netlify-cli`.
4. Create a local `.env` file with `OPENROUTER_API_KEY=your_rotated_key`.
5. Run `netlify dev` and open the local URL shown by the CLI.

The API key is read only by the Netlify Function. Do not use a `VITE_` prefix and do not put the key in React code.

## Deploy

1. Import this GitHub repository into Netlify.
2. Set `OPENROUTER_API_KEY` in the Netlify site's environment variables. Enable the **Functions** scope.
3. Deploy the site.

Netlify build settings are in `netlify.toml`.

## Current MVP workflow

1. Upload a team submission (PDF, PPTX, TXT, or Markdown).
2. Upload the official rubric/manual in one of those formats.
3. The browser extracts selectable PDF text or PowerPoint slide text and preserves page/slide markers.
4. The server-side function sends extracted text to OpenRouter using Ling 3.2 Flash.
5. The app displays a structured rubric evaluation, evidence, gaps, recommendations, strengths, and questions.

## Current limitations

- Scanned/image-only PDFs are not OCR'd in this first version.
- PPTX extraction currently reads slide text, not embedded images, charts, or speaker notes.
- PDF extraction reads selectable text; it does not yet send page images for visual inspection.
- Very large files are truncated to fit a single model request. Use reasonably sized submissions and rubrics.
- AI scores are estimates for practice and are not official judging results. Confirm all findings against the source manual.

## Security

The OpenRouter key must be stored as a Netlify environment variable named `OPENROUTER_API_KEY`, with Functions scope. If a key is exposed, revoke it and create a replacement. Never commit API keys.

## Evaluation integrity

The evaluator is instructed to use only the supplied rubric, distinguish missing evidence from weak evidence, avoid inventing requirements, and cite extracted page/slide markers. AI output still requires human review.