import { useMemo, useState } from "react";
import { extractDocument } from "./lib/extract.js";

function FilePicker({ label, hint, file, onChange, accept }) {
  return (
    <label className="file-picker">
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <span className="file-icon">↑</span>
      <span className="file-copy">
        <strong>{file ? file.name : label}</strong>
        <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Selected` : hint}</small>
      </span>
      <span className="file-action">{file ? "Replace" : "Browse"}</span>
    </label>
  );
}

function Score({ overall }) {
  const percentage = typeof overall?.percentage === "number" ? Math.max(0, Math.min(100, overall.percentage)) : null;
  return (
    <section className="score-panel">
      <div>
        <span className="eyebrow">ESTIMATED RUBRIC RESULT</span>
        <div className="score-number">{overall?.score ?? "—"}<span>{overall?.maxScore != null ? ` / ${overall.maxScore}` : ""}</span></div>
        <strong>{overall?.rating || "Evaluation complete"}</strong>
      </div>
      <div className="score-ring" style={{ "--score": percentage == null ? 0 : percentage }}>
        <div>{percentage == null ? "N/A" : `${Math.round(percentage)}%`}</div>
      </div>
    </section>
  );
}

export default function App() {
  const [submission, setSubmission] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [competition, setCompetition] = useState("FTC / FIRST Tech Challenge");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(0);

  const canEvaluate = Boolean(submission && rubric && !loading);
  const criterionCount = useMemo(() => result?.criteria?.length || 0, [result]);

  async function runEvaluation() {
    setError("");
    setStatus("Extracting submission and rubric...");
    setLoading(true);
    setResult(null);
    try {
      const [submissionText, rubricText] = await Promise.all([
        extractDocument(submission),
        extractDocument(rubric)
      ]);
      if (!submissionText.trim() || !rubricText.trim()) {
        throw new Error("Text could not be extracted from one of the files.");
      }
      setStatus("Sending extracted content to Ling 3.2 Flash...");
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OpenRouter API key is missing. Add VITE_OPENROUTER_API_KEY to your local .env.local file, then rebuild and redeploy.");
      }

      setStatus("Sending extracted content to Ling 3.2 Flash...");
      const systemPrompt = `You are a rigorous engineering competition evaluator. Evaluate a team's submitted engineering portfolio or presentation ONLY against the supplied competition rules and judging rubric.

Core rules:
- Treat the supplied rubric and manual as the source of truth. Do not invent criteria, point values, rules, or requirements.
- Distinguish missing evidence from weak evidence and from evidence that is present but unclear.
- Do not assume a team performed work that is not documented.
- Cite page or slide markers in evidence when available.
- Do not penalize a team for requirements not present in the supplied rubric.
- Use the rubric's actual scoring scale and weights. If no numeric scale is supplied, return null numeric scores and explain why.
- Be specific, constructive, and technically grounded. Clearly label uncertainty.
- This is an AI practice evaluation, not an official competition score.

Return ONLY valid JSON with this shape:
{
  "overall": {"score": number|null, "maxScore": number|null, "percentage": number|null, "rating": "Strong"|"Competitive"|"Developing"|"Needs substantial work"|"Insufficient rubric information", "summary": "string"},
  "criteria": [{"name":"criterion","score":number|null,"maxScore":number|null,"performanceLevel":"string","assessment":"string","evidence":[{"location":"page/slide or Unknown","description":"evidence"}],"gaps":["string"],"recommendations":["string"]}],
  "strengths":["string"],
  "priorityImprovements":[{"priority":"High"|"Medium"|"Low","change":"string","reason":"string","where":"string","rubricCriterion":"string"}],
  "missingRequirements":[{"requirement":"string","sourceReference":"string","status":"Missing"|"Unclear"|"Partially demonstrated"}],
  "questionsForTeam":["string"],
  "limitations":["string"]
}
Do not calculate an overall score if the rubric does not provide enough information.`;

      const userPrompt = `Competition: ${competition}

OFFICIAL RUBRIC / MANUAL:
---
${rubricText}
---

TEAM SUBMISSION:
---
${submissionText}
---

Evaluate the submission against the supplied rubric. Cite page/slide markers where available. Return the required JSON only.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "FTC Grader"
        },
        body: JSON.stringify({
          model: "inclusionai/ling-3.2-flash:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 6000,
          response_format: { type: "json_object" }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || `OpenRouter request failed (${response.status}).`);
      }
      const raw = payload?.choices?.[0]?.message?.content;
      if (typeof raw !== "string" || !raw.trim()) {
        throw new Error("The model returned an empty response. Try again.");
      }
      let evaluation;
      try {
        evaluation = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      } catch {
        throw new Error("The model response was not valid JSON. Try the evaluation again.");
      }
      setResult(evaluation);
      setStatus("");
      setExpanded(0);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">F</span><span>FTC <b>Grader</b></span></a>
        <span className="topbar-note"><span className="status-dot" /> AI evaluation workspace</span>
      </header>

      <div className="page">
        <section className="hero">
          <div className="eyebrow">ENGINEERING COMPETITION TOOLKIT</div>
          <h1>Make every page<br /><span>judge-ready.</span></h1>
          <p>Evaluate engineering portfolios and presentations against the actual rubric. Find evidence gaps, understand your score, and get specific improvements.</p>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div><span className="step">01</span><div><h2>Set up your evaluation</h2><p>Choose the competition and provide the team's work and judging criteria.</p></div></div>
          </div>
          <div className="form-grid">
            <label className="field full">
              <span>Competition or evaluation type</span>
              <input value={competition} onChange={(event) => setCompetition(event.target.value)} placeholder="e.g. FIRST Tech Challenge" />
            </label>
            <div className="field">
              <span>Team submission</span>
              <FilePicker label="Upload portfolio or presentation" hint="PDF, PPTX, TXT, or MD" file={submission} onChange={setSubmission} accept=".pdf,.pptx,.txt,.md" />
              <small className="field-hint">The document being evaluated.</small>
            </div>
            <div className="field">
              <span>Official rubric / manual</span>
              <FilePicker label="Upload rubric or manual" hint="PDF, PPTX, TXT, or MD" file={rubric} onChange={setRubric} accept=".pdf,.pptx,.txt,.md" />
              <small className="field-hint">The rules and scoring criteria used to grade the submission.</small>
            </div>
          </div>
          <div className="action-row">
            <button className="primary-button" disabled={!canEvaluate} onClick={runEvaluation}>
              {loading ? <><span className="spinner" /> Evaluating...</> : "Evaluate submission"} <span>→</span>
            </button>
            <span className="privacy-note">Documents are processed in your browser before extracted text is sent for evaluation.</span>
          </div>
          {status && <div className="inline-status"><span className="spinner dark" />{status}</div>}
          {error && <div className="error-box"><strong>Evaluation couldn't finish</strong><span>{error}</span></div>}
        </section>

        {result && (
          <section className="results">
            <div className="section-heading result-heading">
              <div><span className="step">02</span><div><h2>Evaluation report</h2><p>AI-generated practice assessment based on the uploaded rubric.</p></div></div>
              <button className="secondary-button" onClick={() => window.print()}>Print report ↗</button>
            </div>
            <Score overall={result.overall || {}} />
            {result.overall?.summary && <p className="summary">{result.overall.summary}</p>}

            <div className="report-grid">
              <section className="report-card">
                <div className="card-title"><h3>Rubric breakdown</h3><span>{criterionCount} criteria</span></div>
                {(result.criteria || []).map((criterion, index) => (
                  <article className="criterion" key={`${criterion.name}-${index}`}>
                    <button className="criterion-toggle" onClick={() => setExpanded(expanded === index ? -1 : index)}>
                      <span className="criterion-name"><b>{criterion.name}</b><small>{criterion.performanceLevel || "Assessment"}</small></span>
                      <span className="criterion-score">{criterion.score ?? "—"}{criterion.maxScore != null ? ` / ${criterion.maxScore}` : ""}</span>
                      <span className="chevron">{expanded === index ? "−" : "+"}</span>
                    </button>
                    {expanded === index && <div className="criterion-detail">
                      <p>{criterion.assessment}</p>
                      {criterion.evidence?.length > 0 && <div><h4>Evidence found</h4><ul>{criterion.evidence.map((item, i) => <li key={i}><b>{item.location}:</b> {item.description}</li>)}</ul></div>}
                      {criterion.gaps?.length > 0 && <div><h4>Evidence gaps</h4><ul>{criterion.gaps.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
                      {criterion.recommendations?.length > 0 && <div><h4>Recommended improvements</h4><ul>{criterion.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
                    </div>}
                  </article>
                ))}
              </section>
              <aside className="side-column">
                <section className="report-card">
                  <div className="card-title"><h3>Priority improvements</h3></div>
                  {(result.priorityImprovements || []).map((item, index) => (
                    <div className="priority-item" key={index}>
                      <span className={`priority-tag ${(item.priority || "medium").toLowerCase()}`}>{item.priority || "Medium"}</span>
                      <b>{item.change}</b><p>{item.reason}</p><small>{item.where || "Location not specified"} · {item.rubricCriterion || "Rubric criterion"}</small>
                    </div>
                  ))}
                  {!result.priorityImprovements?.length && <p className="muted">No priority improvements were returned.</p>}
                </section>
                <section className="report-card">
                  <div className="card-title"><h3>Strengths</h3></div>
                  <ul className="simple-list">{(result.strengths || []).map((item, index) => <li key={index}>{item}</li>)}</ul>
                </section>
                <section className="report-card">
                  <div className="card-title"><h3>Questions to prepare</h3></div>
                  <ul className="simple-list">{(result.questionsForTeam || []).map((item, index) => <li key={index}>{item}</li>)}</ul>
                </section>
              </aside>
            </div>

            {result.missingRequirements?.length > 0 && <section className="report-card lower-card">
              <div className="card-title"><h3>Missing or unclear requirements</h3><span>{result.missingRequirements.length} items</span></div>
              <div className="requirement-list">{result.missingRequirements.map((item, index) => <div key={index}><span className="priority-tag high">{item.status}</span><b>{item.requirement}</b><small>{item.sourceReference}</small></div>)}</div>
            </section>}
            {result.limitations?.length > 0 && <section className="notice"><b>Evaluation limitations</b><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
            <p className="disclaimer">This is an AI-generated practice evaluation, not an official score or guarantee of judging results. Verify every finding against the original competition manual and submission.</p>
          </section>
        )}
        <footer><span>FTC Grader</span><span>Built for better engineering documentation.</span></footer>
      </div>
    </main>
  );
}