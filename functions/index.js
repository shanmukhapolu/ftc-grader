const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

const openRouterKey = defineSecret("OPENROUTER_API_KEY");
const MODEL = "inclusionai/ling-3.2-flash:free";
const MAX_TEXT_LENGTH = 85000;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 5;
const requestsByIp = new Map();

const SYSTEM_PROMPT = `You are a rigorous engineering competition evaluator. Evaluate a team's submitted engineering portfolio or presentation ONLY against the supplied competition rules and judging rubric.

Core rules:
- Treat the supplied rubric and manual as the source of truth. Do not invent criteria, point values, rules, or requirements.
- Distinguish missing evidence from weak evidence and from evidence that is present but unclear.
- Do not assume a team performed work that is not documented.
- Every finding must cite the submission page or slide marker when one is available, and cite the relevant rubric criterion. If the source does not contain enough information, say so.
- Do not penalize a team for a requirement that is not in the supplied rubric.
- Use the rubric's actual scoring scale and weights. If the rubric does not specify a numeric scale, do not fabricate a numeric score; return null for numeric scores and explain the limitation.
- Be specific, constructive, and technically grounded. Recommendations must say what to change or add and why it matters.
- Clearly label uncertain judgments. This is an AI practice evaluation, not an official competition score.

Return ONLY valid JSON, with this shape:
{
  "overall": {
    "score": number|null,
    "maxScore": number|null,
    "percentage": number|null,
    "rating": "Strong"|"Competitive"|"Developing"|"Needs substantial work"|"Insufficient rubric information",
    "summary": "string"
  },
  "criteria": [
    {
      "name": "criterion name exactly or faithfully from rubric",
      "score": number|null,
      "maxScore": number|null,
      "performanceLevel": "string",
      "assessment": "string",
      "evidence": [{"location":"page or slide reference, or Unknown","description":"what the submission demonstrates"}],
      "gaps": ["specific missing or weak evidence"],
      "recommendations": ["specific actionable improvement"]
    }
  ],
  "strengths": ["specific demonstrated strengths"],
  "priorityImprovements": [
    {"priority":"High"|"Medium"|"Low","change":"specific change","reason":"why it matters","where":"page/slide or suggested location","rubricCriterion":"criterion"}
  ],
  "missingRequirements": [
    {"requirement":"requirement grounded in supplied rubric/manual","sourceReference":"rubric/manual page or section","status":"Missing"|"Unclear"|"Partially demonstrated"}
  ],
  "questionsForTeam": ["useful questions that would clarify evidence or prepare the team for judging"],
  "limitations": ["important limitations caused by missing, unreadable, or incomplete source material"]
}

Ensure all scores are within the rubric's allowed ranges. Do not calculate an overall score if the rubric does not provide enough information to do so.`;

function send(res, status, body) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(body));
}

function allowRequest(ip) {
  const now = Date.now();
  const record = requestsByIp.get(ip);
  if (!record || now - record.start >= WINDOW_MS) {
    requestsByIp.set(ip, { start: now, count: 1 });
    return true;
  }
  if (record.count >= WINDOW_LIMIT) return false;
  record.count += 1;
  return true;
}

exports.evaluate = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    maxInstances: 3,
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openRouterKey]
  },
  async (req, res) => {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

    const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
    if (!allowRequest(ip)) return send(res, 429, { error: "Rate limit reached. Please wait a minute and try again." });

    const body = req.body || {};
    const submissionText = typeof body.submissionText === "string" ? body.submissionText : "";
    const rubricText = typeof body.rubricText === "string" ? body.rubricText : "";

    if (!submissionText.trim() || !rubricText.trim()) {
      return send(res, 400, { error: "Both a submission and a rubric/manual are required." });
    }
    if (submissionText.length > MAX_TEXT_LENGTH || rubricText.length > MAX_TEXT_LENGTH) {
      return send(res, 413, { error: "One of the extracted documents is too long. Shorten it or split it into sections." });
    }

    const competitionName = String(body.competitionName || "Engineering competition").slice(0, 160);
    const userPrompt = `Competition: ${competitionName}

OFFICIAL RUBRIC / MANUAL EXCERPTS:
---
${rubricText}
---

TEAM SUBMISSION (page and slide markers are included where extraction supports them):
---
${submissionText}
---

Evaluate the submission against the supplied rubric. Cite page/slide markers in evidence. Return the required JSON only.`;

    let upstream;
    try {
      upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey.value()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ftc-grader.web.app",
          "X-Title": "FTC Grader"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 6000,
          response_format: { type: "json_object" }
        })
      });
    } catch {
      return send(res, 502, { error: "Could not reach OpenRouter. Check function logs and try again." });
    }

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = payload?.error?.message || "OpenRouter could not complete the evaluation.";
      const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status;
      return send(res, status, { error: message, upstreamStatus: upstream.status });
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return send(res, 502, { error: "The model returned an empty response. Try again." });
    }

    try {
      const cleaned = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
      const evaluation = JSON.parse(cleaned);
      return send(res, 200, { evaluation, usage: payload.usage || null, model: MODEL });
    } catch {
      return send(res, 502, { error: "The model response was not valid JSON. Try the evaluation again." });
    }
  }
);
