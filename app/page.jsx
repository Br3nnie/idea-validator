"use client";

import { useMemo, useState } from "react";

const questions = [
  { label: "The idea", prompt: "Describe your idea in plain language.", helper: "What is it, who is it for, and what problem does it solve?", example: "A service that helps freelance designers turn client feedback into clearer project plans." },
  { label: "The user", prompt: "Who feels this pain most?", helper: "Be specific about their situation, context and whether they decide alone or with others.", example: "Independent consultants who sell complex work but lose time rewriting proposals." },
  { label: "Your evidence", prompt: "What suggests this problem is real?", helper: "Share lived experience, customer conversations, behaviour, or a clearly labelled hunch.", example: "Five recent clients asked for this and I experienced it in my own consulting work." },
  { label: "Competition", prompt: "What do people do today?", helper: "Name tools, workarounds or alternatives—and what they still fail to provide.", example: "They use ChatGPT and spreadsheets, but neither creates a reusable validation trail." },
  { label: "Monetisation", prompt: "How could this make money?", helper: "One-off, subscription, B2B, freemium—include your early price instinct.", example: "£19 per report, then £29/month for ongoing validation and saved projects." },
  { label: "Biggest fear", prompt: "What could kill this idea?", helper: "Name the assumption you would least like to be wrong about.", example: "People may enjoy the report but not pay for it when generic AI tools are free." },
];

const minChars = 40;

function score(answers) {
  const evidence = answers[2].length >= 110 ? 26 : answers[2].length >= 65 ? 18 : 10;
  const user = answers[1].length >= 80 ? 20 : answers[1].length >= 45 ? 14 : 8;
  const commercial = answers[4].length >= 65 ? 18 : answers[4].length >= 40 ? 12 : 7;
  const differentiation = answers[3].length >= 70 ? 18 : answers[3].length >= 40 ? 12 : 6;
  const clarity = answers[0].length >= 80 ? 18 : answers[0].length >= 40 ? 12 : 6;
  return evidence + user + commercial + differentiation + clarity;
}

function verdictFor(total) {
  if (total >= 72) return ["GO", "You have enough signal to run a focused test now.", "good"];
  if (total >= 48) return ["TEST", "Promising, but your riskiest assumptions need evidence before you build.", "test"];
  return ["KILL / REFRAME", "The concept needs a clearer customer, proof point or paid problem before it earns build time.", "kill"];
}

export default function Home() {
  const [stage, setStage] = useState("welcome");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(6).fill(""));
  const [reviewIndex, setReviewIndex] = useState(null);
  const total = useMemo(() => score(answers), [answers]);
  const [verdict, verdictText, verdictTone] = verdictFor(total);
  const current = questions[step];
  const currentAnswer = answers[step];
  const isReady = currentAnswer.trim().length >= minChars;

  const update = (value) => setAnswers((old) => old.map((answer, index) => index === step ? value : answer));
  const goNext = () => step === questions.length - 1 ? setStage("review") : setStep(step + 1);

  if (stage === "welcome") return (
    <main className="shell welcome">
      <section className="hero-card">
        <div className="mark" aria-hidden="true">◈</div>
        <p className="eyebrow">THE 60-MINUTE VALIDATION FRAMEWORK</p>
        <h1>Idea Validator</h1>
        <p className="lead">Six honest answers. One clear next move.</p>
        <p className="sublead">Map assumptions, rank risk and earn a Go, Test or Kill verdict—before you build the wrong thing.</p>
        <button className="primary wide" onClick={() => setStage("questions")}>Start validating <span>→</span></button>
        <div className="trust-row"><span>6 questions</span><span>~8 minutes</span><span>Private by default</span></div>
      </section>
      <p className="footer-note">Built for founders who prefer evidence over enthusiasm.</p>
    </main>
  );

  if (stage === "review") return (
    <main className="shell flow-shell">
      <section className="flow-card review-card">
        <div className="progress-top"><span>Review your model</span><span>6 answers ready</span></div>
        <div className="review-heading"><p className="eyebrow">BEFORE THE VERDICT</p><h1>Check the raw material.</h1><p>Good decisions begin with accurate inputs. Edit any answer before we score the model.</p></div>
        <div className="answer-list">
          {questions.map((question, index) => <button className="answer-row" key={question.label} onClick={() => { setReviewIndex(index); setStep(index); setStage("questions"); }}><span>0{index + 1}</span><strong>{question.label}</strong><em>{answers[index].length} characters</em><b>Edit →</b></button>)}
        </div>
        <div className="actions"><button className="secondary" onClick={() => { setStep(5); setStage("questions"); }}>← Back</button><button className="primary" onClick={() => setStage("results")}>Generate validation model →</button></div>
      </section>
    </main>
  );

  if (stage === "results") return (
    <main className="shell results-shell">
      <section className="result-card">
        <div className="result-header"><div><p className="eyebrow">YOUR VALIDATION MODEL</p><h1>Decide what earns the next hour.</h1></div><div className={`verdict ${verdictTone}`}><span>VERDICT</span><strong>{verdict}</strong></div></div>
        <p className="verdict-copy">{verdictText}</p>
        <div className="score-grid">
          <div className="score"><span>Readiness score</span><strong>{total}<small>/100</small></strong></div>
          <div><span>Strongest signal</span><strong>{answers[2].length >= 65 ? "Evidence" : "Clarity"}</strong><p>Make this your foundation for the first test.</p></div>
          <div><span>Riskiest assumption</span><strong>{answers[5].slice(0, 72)}{answers[5].length > 72 ? "…" : ""}</strong></div>
        </div>
        <div className="model-grid">
          <article><span>01 — Core bet</span><p>{answers[0]}</p></article><article><span>02 — Customer</span><p>{answers[1]}</p></article><article><span>03 — First test</span><p>Speak to 5 people matching your user description. Ask about their current workaround, then ask for a commitment—not an opinion.</p></article><article><span>04 — Success signal</span><p>At least 3 of 5 describe the problem unprompted and one takes a concrete next step.</p></article>
        </div>
        <div className="actions result-actions"><button className="secondary" onClick={() => setStage("review")}>← Edit answers</button><button className="primary" onClick={() => window.print()}>Print / save as PDF</button></div>
      </section>
    </main>
  );

  return (
    <main className="shell flow-shell">
      <section className="flow-card">
        <div className="progress-top"><span>{step + 1} of {questions.length} — {current.label}</span><span>{Math.round(((step + 1) / questions.length) * 100)}%</span></div>
        <div className="progress-track"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
        <div className="question-area">
          <p className="eyebrow">QUESTION 0{step + 1}</p>
          <h1>{current.prompt}</h1>
          <p className="helper">{current.helper}</p>
          <label className="textarea-wrap"><span className="sr-only">Your answer for {current.label}</span><textarea autoFocus value={currentAnswer} onChange={(event) => update(event.target.value)} placeholder={current.example} maxLength={500} /></label>
          <div className="input-meta"><span className={currentAnswer.length < minChars ? "muted" : "ready"}>{currentAnswer.length < minChars ? `${minChars - currentAnswer.length} more characters for a useful answer` : "Enough detail to continue"}</span><span>{currentAnswer.length}/500</span></div>
        </div>
        <div className="tip"><b>Example:</b> {current.example}</div>
        <div className="actions"><button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button><button className="primary" disabled={!isReady} onClick={goNext}>{step === 5 ? "Review answers →" : "Next question →"}</button></div>
      </section>
    </main>
  );
}
