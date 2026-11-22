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
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionName: competition,
          submissionName: submission.name,
          rubricName: rubric.name,
          submissionText,
          rubricText
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Evaluation failed (${response.status}).`);
      setResult(payload.evaluation);
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