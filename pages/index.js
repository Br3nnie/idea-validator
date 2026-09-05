import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";

const STEPS = [
  { id: "idea", label: "The Idea", question: "Describe your idea in plain language. What is it, who is it for, and what problem does it solve?" },
  { id: "user", label: "The User", question: "Who feels this pain most? Be specific — age, situation, context. Solo user or shared (e.g. couples, teams)?" },
  { id: "evidence", label: "Your Evidence", question: "What evidence do you have that this problem is real? Lived it, heard complaints, or a hunch?" },
  { id: "competition", label: "Competition", question: "What do people do today to solve this? Any apps, tools, or workarounds? What's missing?" },
  { id: "monetisation", label: "Monetisation", question: "How would this make money? One-off, subscription, freemium, B2B? Price instinct?" },
  { id: "blockers", label: "Biggest Fear", question: "What's the one thing that would kill this idea? What are you most uncertain about?" },
];

const MIN_ANSWER_CHARS = 40;

const riskColor = { low: "#16a34a", medium: "#b45309", high: "#dc2626" };
const riskBg   = { low: "#f0fdf4", medium: "#fff7ed", high: "#fef2f2" };
const verdictCfg = {
  GO:   { color: "#16a34a", bg: "#f0fdf4", border: "#16a34a" },
  TEST: { color: "#b45309", bg: "#fff7ed", border: "#b45309" },
  KILL: { color: "#dc2626", bg: "#fef2f2", border: "#dc2626" },
};

// Axis calculations from scoring array
function getAxes(scoring) {
  const get = name => (scoring.find(s => s.name === name)?.score || 5);
  const market = Math.round((get("Market size") + get("Differentiation") + get("Problem clarity")) / 3);
  const exec   = Math.round((get("Technical feasibility") + get("Monetisation fit") + get("Speed to test")) / 3);
  return { market, exec };
}

function getQuadrant(market, exec) {
  if (market >= 6 && exec >= 6) return { label: "GO ZONE", desc: "Strong market, strong execution path", color: "#16a34a" };
  if (market >= 6 && exec < 6)  return { label: "PARTNER UP", desc: "Big opportunity, hard to execute alone", color: "#b45309" };
  if (market < 6  && exec >= 6) return { label: "LIFESTYLE", desc: "Easy to build, limited upside", color: "#2563eb" };
  return { label: "RETHINK", desc: "Hard to build, small market", color: "#dc2626" };
}

function Matrix({ scoring, ideaName }) {
  const { market, exec } = getAxes(scoring);
  const q = getQuadrant(market, exec);

  // Convert 1-10 scores to % position in matrix (10% padding each side)
  const xPct = 10 + (exec   / 10) * 80;
  const yPct = 10 + ((10 - market) / 10) * 80; // invert Y so high = top

  const quadrants = [
    { x:"50%", y:"25%", label:"GO ZONE",    color:"#dcfce7", textColor:"#16a34a" },
    { x:"0%",  y:"25%", label:"PARTNER UP", color:"#ffedd5", textColor:"#b45309" },
    { x:"50%", y:"75%", label:"LIFESTYLE",  color:"#dbeafe", textColor:"#2563eb" },
    { x:"0%",  y:"75%", label:"RETHINK",    color:"#fee2e2", textColor:"#dc2626" },
  ];

  return (
    <div className="print-section">
      <div style={{ marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#1a56db", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Opportunity Matrix</div>
          <div style={{ fontSize:13, color:"#475569" }}>Market Attractiveness vs Execution Feasibility</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:11, fontFamily:"monospace", color:q.color, letterSpacing:"0.1em" }}>{q.label}</div>
          <div style={{ fontSize:11, color:"#64748b" }}>{q.desc}</div>
        </div>
      </div>

      <div style={{ position:"relative", width:"100%", paddingBottom:"60%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
        {/* Quadrant backgrounds */}
        {quadrants.map(qd => (
          <div key={qd.label} style={{ position:"absolute", width:"50%", height:"50%", left:qd.x, top:qd.y, transform:"translate(0,-50%) translate(0,0)", background:qd.color }}>
            <span style={{ position:"absolute", bottom:8, right:8, fontSize:9, fontFamily:"monospace", color:qd.textColor, letterSpacing:"0.12em", opacity:0.7 }}>{qd.label}</span>
          </div>
        ))}

        {/* Axis lines */}
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"#cbd5e1" }}/>
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:"#cbd5e1" }}/>

        {/* Axis labels */}
        <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", fontSize:9, fontFamily:"monospace", color:"#94a3b8", letterSpacing:"0.1em" }}>EXECUTION FEASIBILITY →</div>
        <div style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%) rotate(-90deg)", fontSize:9, fontFamily:"monospace", color:"#94a3b8", letterSpacing:"0.1em", transformOrigin:"center" }}>MARKET ATTRACTIVENESS →</div>
        <div style={{ position:"absolute", bottom:6, right:8, fontSize:9, fontFamily:"monospace", color:"#94a3b8" }}>HIGH</div>
        <div style={{ position:"absolute", bottom:6, left:20, fontSize:9, fontFamily:"monospace", color:"#94a3b8" }}>LOW</div>
        <div style={{ position:"absolute", top:6, left:20, fontSize:9, fontFamily:"monospace", color:"#94a3b8" }}>HIGH</div>

        {/* Dot */}
        <div style={{
          position:"absolute",
          left:`${xPct}%`,
          top:`${yPct}%`,
          transform:"translate(-50%,-50%)",
          width:14, height:14,
          borderRadius:"50%",
          background:q.color,
          boxShadow:`0 0 12px ${q.color}88`,
          zIndex:2,
        }}/>

        {/* Label */}
        <div style={{
          position:"absolute",
          left:`${xPct}%`,
          top:`${yPct}%`,
          transform:`translate(${xPct > 70 ? "-110%" : "16px"}, -50%)`,
          fontSize:11, fontFamily:"monospace", color:q.color,
          background:"#ffffffee",
          padding:"3px 7px", borderRadius:4,
          border:`1px solid ${q.color}44`,
          whiteSpace:"nowrap",
          zIndex:3,
        }}>{ideaName}</div>
      </div>

      {/* Axis score breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 16px" }}>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#1a56db", letterSpacing:"0.1em", marginBottom:8 }}>MARKET ATTRACTIVENESS</div>
          <div style={{ fontSize:28, fontFamily:"monospace", color: market>=7?"#16a34a":market>=5?"#b45309":"#dc2626", marginBottom:6 }}>{market}<span style={{ fontSize:12, color:"#94a3b8" }}>/10</span></div>
          <div style={{ fontSize:11, color:"#64748b" }}>Problem clarity · Market size · Differentiation</div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 16px" }}>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#1a56db", letterSpacing:"0.1em", marginBottom:8 }}>EXECUTION FEASIBILITY</div>
          <div style={{ fontSize:28, fontFamily:"monospace", color: exec>=7?"#16a34a":exec>=5?"#b45309":"#dc2626", marginBottom:6 }}>{exec}<span style={{ fontSize:12, color:"#94a3b8" }}>/10</span></div>
          <div style={{ fontSize:11, color:"#64748b" }}>Technical feasibility · Monetisation fit · Speed to test</div>
        </div>
      </div>
    </div>
  );
}

function RadarChart({ scoring, compact = false }) {
  const dimensions = [
    ["Problem clarity", ["Problem", "clarity"]],
    ["Market size", ["Market", "size"]],
    ["Differentiation", ["Differentiation"]],
    ["Technical feasibility", ["Technical", "feasibility"]],
    ["Monetisation fit", ["Monetisation", "fit"]],
    ["Speed to test", ["Speed", "to test"]],
  ];
  const size = 420;
  const centre = size / 2;
  const radius = compact ? 118 : 132;
  const labelRadius = compact ? 148 : 166;
  const point = (index, value, distance = radius) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / dimensions.length;
    const scaled = distance * value;
    return [centre + Math.cos(angle) * scaled, centre + Math.sin(angle) * scaled];
  };
  const scoreFor = name => Math.max(0, Math.min(10, Number(scoring?.find(item => item.name === name)?.score) || 0));
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const polygon = dimensions.map(([name], index) => point(index, scoreFor(name) / 10).join(",")).join(" ");

  return (
    <div style={{ width:"100%", maxWidth:compact ? 300 : 460, margin:"0 auto" }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Six-dimension Test My Idea score radar chart" style={{ display:"block", width:"100%", height:"auto" }}>
        <title>Test My Idea score profile</title>
        <desc>Scores for problem clarity, market size, differentiation, technical feasibility, monetisation fit and speed to test.</desc>
        {gridLevels.map(level => (
          <polygon key={level} points={dimensions.map((_, index) => point(index, level).join(",")).join(" ")} fill={level === 1 ? "#f8fafc" : "none"} stroke="#cbd5e1" strokeWidth="1" />
        ))}
        {dimensions.map((_, index) => {
          const [x, y] = point(index, 1);
          return <line key={index} x1={centre} y1={centre} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" />;
        })}
        <polygon points={polygon} fill="#1a56db24" stroke="#1a56db" strokeWidth="3" strokeLinejoin="round" />
        {dimensions.map(([name], index) => {
          const score = scoreFor(name);
          const [x, y] = point(index, score / 10);
          return <g key={name}><circle cx={x} cy={y} r="5" fill="#1a56db" stroke="#fff" strokeWidth="2" /><title>{name}: {score}/10</title></g>;
        })}
        {dimensions.map(([name, lines], index) => {
          const [x, y] = point(index, 1, labelRadius);
          const anchor = x < centre - 20 ? "end" : x > centre + 20 ? "start" : "middle";
          return (
            <text key={name} x={x} y={y - (lines.length - 1) * 7} textAnchor={anchor} fill="#475569" fontFamily="Arial, sans-serif" fontSize={compact ? 12 : 13} fontWeight="600">
              {lines.map((line, lineIndex) => <tspan key={line} x={x} dy={lineIndex === 0 ? 0 : 15}>{line}</tspan>)}
              <tspan x={x} dy="16" fill="#1a56db" fontWeight="800">{scoreFor(name)}/10</tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function TestMyIdea() {
  const [phase, setPhase]   = useState("intro");
  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({});
  const [answer, setAnswer] = useState("");
  const [model, setModel]   = useState(null);
  const [tab, setTab]       = useState("overview");
  const [error, setError]   = useState(null);
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const ref = useRef(null);

  useEffect(() => { if (phase === "intake") ref.current?.focus(); }, [phase, step]);

  const next = () => {
    const updated = { ...answers, [STEPS[step].id]: answer.trim() };
    setAnswers(updated);
    setAnswer("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else setPhase("review");
  };

  const keyDown = e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim().length >= MIN_ANSWER_CHARS) next(); };

  const generate = async (submittedEmail) => {
    setPhase("generating"); setError(null);
    setStatus("Analysing your idea…");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email:submittedEmail, answers, marketingConsent, pageUrl:window.location.href, referrer:document.referrer }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate the report");
      setModel(payload.result);
      setPhase("results"); setTab("overview");
    } catch (err) {
      setError(err.message);
      setPhase("emailGate");
    }
  };

  const submitEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    generate(email);
  };

  const reset = () => { setPhase("intro"); setStep(0); setAnswers({}); setAnswer(""); setModel(null); setError(null); setStatus(""); setEmail(""); setMarketingConsent(false); setEmailError(""); };

  const avg = model?.scoring ? Math.round(model.scoring.reduce((s,c) => s+c.score,0)/model.scoring.length) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", color:"#334155", fontFamily:"'DM Sans',Arial,sans-serif" }}>
      <Head>
        <title>Test My Idea</title>
        <meta name="description" content="Test your business idea before you build it. Get assumptions, scores, validation tests and a clear verdict." />
      </Head>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        html, body { margin:0; }
        .intake-page { min-height:100dvh; box-sizing:border-box; display:grid; place-items:center; padding:12px; background:radial-gradient(circle at 75% 0%,#dbeafe 0,transparent 36%),#f0f4f8; }
        .intake-card { width:min(820px,100%); height:min(720px,calc(100dvh - 24px)); box-sizing:border-box; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden; padding:clamp(20px,3vw,36px); border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 24px 80px #1a56db20; }
        .intake-question { min-height:0; overflow:hidden; padding-top:clamp(16px,3vh,30px); }
        @media (max-height:640px) { .intake-card { height:calc(100dvh - 16px); padding:18px 22px; border-radius:10px; } .intake-question { padding-top:14px; } }
        @media (max-width:600px) { .intake-page { padding:0; } .intake-card { height:100dvh; width:100%; border-radius:0; border-left:0; border-right:0; padding:20px; } }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #__next { background: white !important; color: #111 !important; height: auto !important; margin: 0 !important; min-height: 0 !important; }
          .no-print { display: none !important; }
          .print-all { display: block !important; padding: 0 !important; }
          .print-page { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 14mm 16mm; break-after: page; page-break-after: always; }
          .print-page:last-child { break-after: auto; page-break-after: auto; }
          .print-card, .print-action, .print-assumption { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* INTRO */}
      {phase === "intro" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
          <div style={{ width:56, height:56, borderRadius:"50%", border:"1px solid #1a56db", color:"#1a56db", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:32, fontSize:22 }}>◈</div>
          <h1 style={{ margin:"0 0 12px", fontSize:40, fontWeight:600, color:"#1a1a2e" }}>Test My Idea</h1>
          <p style={{ margin:"0 0 8px", color:"#4a5568", fontSize:16, fontStyle:"italic" }}>Answer 6 questions. Get a full validation model.</p>
          <p style={{ margin:"0 0 48px", color:"#64748b", fontSize:13, maxWidth:380, lineHeight:1.7 }}>Assumptions mapped. Risks ranked. Go/Test/Kill verdict. Before you write a single line of code.</p>
          <button onClick={() => setPhase("intake")} style={{ background:"#1a56db", color:"#fff", border:"none", borderRadius:8, padding:"14px 40px", fontSize:15, fontFamily:"inherit", cursor:"pointer" }}>Test my idea →</button>
          <p style={{ margin:"24px 0 0", color:"#94a3b8", fontSize:11, fontFamily:"monospace" }}>Built on the 60-Minute Validation Framework</p>
        </div>
      )}

      {/* INTAKE */}
      {phase === "intake" && (
        <div className="intake-page">
          <div className="intake-card">
          <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, color:"#475569", fontSize:11, fontFamily:"monospace", letterSpacing:"0.07em", textTransform:"uppercase" }}><span>{step+1} of {STEPS.length} — {STEPS[step].label}</span><span>{Math.round(((step+1)/STEPS.length)*100)}%</span></div>
          <div style={{ display:"flex", gap:6 }}>
            {STEPS.map((_,i) => <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<step?"#1a56db":i===step?"#93c5fd":"#e2e8f0", transition:"background 0.3s" }}/>)}
          </div>
          </div>
          <div className="intake-question">
            <div style={{ fontSize:10, fontFamily:"monospace", color:"#1a56db", letterSpacing:"0.15em", marginBottom:10 }}>QUESTION 0{step+1}</div>
            <h2 style={{ margin:"0 0 clamp(12px,2vh,18px)", fontSize:"clamp(26px,3.4vw,40px)", fontWeight:600, color:"#1a1a2e", letterSpacing:"-.035em", lineHeight:1.12 }}>{STEPS[step].question}</h2>
            <p style={{ margin:"0 0 14px", color:"#64748b", fontSize:14, lineHeight:1.45 }}>Be specific. The quality of this answer determines the quality of the recommendation.</p>
            <textarea ref={ref} value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={keyDown} placeholder="Type your answer..." rows={5}
              style={{ width:"100%", height:"clamp(96px,17vh,148px)", background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:9, padding:"14px 16px", color:"#1a1a2e", fontSize:15, fontFamily:"inherit", lineHeight:1.55, resize:"none", outline:"none", boxSizing:"border-box" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, margin:"8px 0 0", fontSize:11, fontFamily:"monospace", color:answer.trim().length >= MIN_ANSWER_CHARS ? "#16a34a" : "#64748b" }}>
              <span>{answer.trim().length >= MIN_ANSWER_CHARS ? "Enough detail to continue" : `${MIN_ANSWER_CHARS - answer.trim().length} more characters for a useful answer`}</span>
              <span style={{ color:"#64748b", whiteSpace:"nowrap" }}>{answer.length} characters</span>
            </div>
            <p style={{ margin:"7px 0 0", fontSize:11, color:"#64748b", fontFamily:"monospace" }}>⌘+Enter to continue</p>
          </div>
          <div>
          {error && <div style={{ color:"#dc2626", fontSize:12, marginBottom:10, fontFamily:"monospace", background:"#fef2f2", padding:"8px 12px", borderRadius:6, wordBreak:"break-word" }}>{error}</div>}
          <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10 }}>
            <button onClick={() => { if(step===0) reset(); else { setStep(step-1); setAnswer(answers[STEPS[step-1].id]||""); }}}
              style={{ background:"none", border:"1px solid #cbd5e1", borderRadius:8, color:"#64748b", padding:"10px 20px", cursor:"pointer", fontSize:13, fontFamily:"monospace" }}>← Back</button>
            <button onClick={next} disabled={answer.trim().length<MIN_ANSWER_CHARS}
              style={{ background:answer.trim().length>=MIN_ANSWER_CHARS?"#1a56db":"#e2e8f0", color:answer.trim().length>=MIN_ANSWER_CHARS?"#fff":"#94a3b8", border:"none", borderRadius:8, padding:"12px 28px", cursor:answer.trim().length>=MIN_ANSWER_CHARS?"pointer":"default", fontSize:14, fontFamily:"inherit", transition:"all 0.2s" }}>
              {step===STEPS.length-1?"Generate Model →":"Next →"}
            </button>
          </div>
          </div>
          </div>
        </div>
      )}

      {/* REVIEW */}
      {phase === "review" && (
        <div style={{ minHeight:"100dvh", boxSizing:"border-box", display:"grid", placeItems:"center", padding:"clamp(16px,4vw,48px)", background:"radial-gradient(circle at 100% 0%,#dbeafe 0,transparent 32%),#f0f4f8" }}>
          <section style={{ width:"min(1080px,100%)", background:"#fff", border:"1px solid #e2e8f0", borderRadius:18, boxShadow:"0 24px 80px #1a56db16", padding:"clamp(24px,5vw,52px)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:16, alignItems:"flex-start", marginBottom:26 }}>
              <div>
                <div style={{ color:"#1a56db", fontSize:11, fontFamily:"monospace", fontWeight:700, letterSpacing:".15em" }}>REVIEW YOUR MODEL</div>
                <div style={{ color:"#64748b", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".15em", marginTop:4 }}>BEFORE THE VERDICT</div>
              </div>
              <div style={{ color:"#64748b", fontSize:11, fontFamily:"monospace", fontWeight:700, letterSpacing:".1em", whiteSpace:"nowrap" }}>6 ANSWERS READY</div>
            </div>
            <h2 style={{ margin:"0 0 12px", color:"#1a1a2e", fontSize:"clamp(34px,5vw,58px)", lineHeight:1, letterSpacing:"-.045em" }}>Check the raw material.</h2>
            <p style={{ margin:"0 0 28px", color:"#475569", fontSize:16, lineHeight:1.55 }}>Good decisions begin with accurate inputs. Edit any answer before we score the model.</p>
            <div style={{ borderTop:"1px solid #e2e8f0" }}>
              {STEPS.map((item, index) => (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"64px 1fr auto auto", gap:16, alignItems:"center", borderBottom:"1px solid #e2e8f0", padding:"17px 2px" }}>
                  <span style={{ color:"#64748b", fontSize:12, fontFamily:"monospace" }}>{String(index+1).padStart(2,"0")}</span>
                  <span style={{ color:"#1a1a2e", fontSize:18, fontWeight:600 }}>{item.label}</span>
                  <span style={{ color:"#64748b", fontSize:12, fontFamily:"monospace", whiteSpace:"nowrap" }}>{(answers[item.id] || "").length} characters</span>
                  <button onClick={() => { setStep(index); setAnswer(answers[item.id] || ""); setPhase("intake"); }} style={{ border:0, background:"transparent", color:"#1a56db", cursor:"pointer", fontSize:14, fontWeight:700, whiteSpace:"nowrap" }}>Edit →</button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginTop:30, alignItems:"center" }}>
              <button onClick={() => { setStep(STEPS.length - 1); setAnswer(answers[STEPS[STEPS.length - 1].id] || ""); setPhase("intake"); }} style={{ background:"#fff", color:"#1a56db", border:"1px solid #cbd5e1", borderRadius:9, padding:"13px 22px", cursor:"pointer", fontSize:14, fontWeight:700 }}>← Back</button>
              <button onClick={() => setPhase("emailGate")} style={{ background:"#1a56db", color:"#fff", border:0, borderRadius:9, padding:"15px 28px", cursor:"pointer", fontSize:15, fontWeight:700 }}>Generate validation model →</button>
            </div>
          </section>
        </div>
      )}

      {/* EMAIL GATE */}
      {phase === "emailGate" && (
        <div style={{ minHeight:"100dvh", display:"grid", placeItems:"center", padding:"24px", background:"#f0f4f8", fontFamily:"'DM Sans', Arial, sans-serif", color:"#1a1a2e" }}>
          <section style={{ width:"min(520px,100%)", background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, boxShadow:"0 18px 50px #1a56db18", padding:"clamp(28px,5vw,44px)" }}>
            <h2 style={{ margin:"0 0 12px", color:"#1a1a2e", fontSize:"clamp(25px,4vw,32px)", lineHeight:1.18 }}>Your validation model is ready.</h2>
            <p style={{ margin:"0 0 8px", color:"#4a5568", fontSize:15, lineHeight:1.7 }}>Enter your email to unlock your personal assessment: assumptions ranked by risk, the opportunity matrix, scoring, a test plan and your Go/Test/Kill verdict.</p>
            <p style={{ margin:"0 0 24px", color:"#6b7280", fontSize:12, lineHeight:1.55 }}>You will never receive any spam. Ever.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitEmail()} placeholder="Your work email address" autoFocus
              style={{ width:"100%", boxSizing:"border-box", background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:10, color:"#1a1a2e", fontSize:15, padding:"14px 16px", outline:"none" }} />
            {emailError && <p style={{ color:"#b91c1c", fontSize:12, margin:"8px 0 0" }}>{emailError}</p>}
            {error && <p role="alert" style={{ color:"#b91c1c", fontSize:12, margin:"8px 0 0" }}>{error}</p>}
            <label style={{ display:"flex", alignItems:"flex-start", gap:9, color:"#475569", fontSize:12, lineHeight:1.45, marginTop:14 }}>
              <input type="checkbox" checked={marketingConsent} onChange={event => setMarketingConsent(event.target.checked)} style={{ marginTop:2 }} />
              <span>Email me occasional Test My Idea updates. This is optional and does not affect my report.</span>
            </label>
            <p style={{ color:"#64748b", fontSize:11, lineHeight:1.5, margin:"9px 0 0" }}>We store your answers and generated report to provide the service. See our <Link href="/privacy" style={{ color:"#1a56db" }}>privacy notice</Link>.</p>
            <button onClick={submitEmail} style={{ width:"100%", border:0, borderRadius:50, background:"#1a56db", color:"#fff", cursor:"pointer", fontSize:15, fontWeight:600, marginTop:20, padding:"14px 28px" }}>Show my assessment →</button>
            <button onClick={() => { setPhase("intake"); setStep(STEPS.length - 1); setAnswer(answers[STEPS[STEPS.length - 1].id] || ""); }} style={{ width:"100%", background:"transparent", border:"1.5px solid #1a56db", borderRadius:50, color:"#1a56db", cursor:"pointer", fontSize:14, fontWeight:600, marginTop:10, padding:"12px 28px" }}>← Back to answers</button>
          </section>
        </div>
      )}

      {/* GENERATING */}
      {phase === "generating" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:40 }}>
          <div style={{ width:48, height:48, border:"1px solid #bfdbfe", borderTop:"1px solid #1a56db", borderRadius:"50%", animation:"spin 1s linear infinite", marginBottom:32 }}/>
          <p style={{ color:"#475569", fontSize:16, margin:0 }}>{status||"Building your validation model..."}</p>
          <p style={{ color:"#94a3b8", fontSize:12, margin:"8px 0 0", fontFamily:"monospace" }}>3 analysis passes · ~15–30 seconds</p>
        </div>
      )}

      {/* RESULTS */}
      {phase === "results" && model && (
        <div>
          {/* Header */}
          {tab !== "overview" && <div className="no-print" style={{ borderBottom:"1px solid #e2e8f0", padding:"28px 32px 20px", background:"#fff" }}>
            <div style={{ maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:"monospace", color:"#1a56db", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>Validation Model</div>
                <h1 style={{ margin:0, fontSize:32, fontWeight:600, color:"#1a1a2e" }}>{model.ideaName}</h1>
                <p style={{ margin:"6px 0 0", color:"#64748b", fontSize:14, fontStyle:"italic" }}>{model.tagline}</p>
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#64748b", fontFamily:"monospace", marginBottom:2 }}>SCORE</div>
                  <div style={{ fontSize:32, color:avg>=7?"#16a34a":avg>=5?"#b45309":"#dc2626" }}>{avg}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>/10</div>
                </div>
                <div style={{ background:verdictCfg[model.verdict]?.bg||"#f8fafc", border:`1px solid ${verdictCfg[model.verdict]?.border||"#cbd5e1"}`, borderRadius:10, padding:"12px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#64748b", fontFamily:"monospace", marginBottom:2 }}>VERDICT</div>
                  <div style={{ fontSize:20, color:verdictCfg[model.verdict]?.color||"#1a1a2e", fontFamily:"monospace" }}>{model.verdict}</div>
                  <div style={{ fontSize:10, color:"#64748b" }}>{model.confidence}% conf.</div>
                </div>
                {/* Print button */}
                <button onClick={() => window.print()} style={{ background:"#fff", border:"1px solid #cbd5e1", borderRadius:10, padding:"12px 16px", color:"#1a56db", cursor:"pointer", fontSize:12, fontFamily:"monospace", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:18 }}>⎙</span>
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
          </div>}

          {/* Tabs */}
          {tab !== "overview" && <div className="no-print" style={{ borderBottom:"1px solid #e2e8f0", padding:"0 32px", background:"#fff" }}>
            <div style={{ maxWidth:900, margin:"0 auto", display:"flex" }}>
              {["overview","matrix","assumptions","steps","scoring","verdict"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ background:"none", border:"none", borderBottom:tab===t?"2px solid #1a56db":"2px solid transparent", color:tab===t?"#1a56db":"#64748b", padding:"12px 14px", cursor:"pointer", fontSize:12, fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase" }}>{t}</button>
              ))}
            </div>
          </div>}

          {/* Tab content — screen */}
          <div className="no-print" style={{ maxWidth:tab === "overview" ? "none" : 900, margin:"0 auto", padding:tab === "overview" ? 0 : 32 }}>

            {tab === "overview" && (
              <V2Overview model={model} avg={avg} answers={answers} onDetails={() => setTab("assumptions")} onReset={reset} />
            )}

            {tab === "matrix" && model.scoring && (
              <Matrix scoring={model.scoring} ideaName={model.ideaName} />
            )}

            {tab === "assumptions" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:"0 0 8px", color:"#64748b", fontSize:12, fontFamily:"monospace" }}>Sorted by risk. High-risk = kill conditions.</p>
                {[...(model.assumptions||[])].sort((a,b)=>({high:0,medium:1,low:2}[a.risk]-{high:0,medium:1,low:2}[b.risk])).map((a,i) => (
                  <div key={i} style={{ background:"#fff", border:`1px solid ${riskColor[a.risk]}44`, borderLeft:`3px solid ${riskColor[a.risk]}`, borderRadius:8, padding:"14px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ color:"#1a1a2e", fontSize:14 }}>{a.label}</div>
                      <span style={{ background:riskBg[a.risk], color:riskColor[a.risk], fontSize:9, fontFamily:"monospace", letterSpacing:"0.15em", padding:"2px 7px", borderRadius:3, textTransform:"uppercase" }}>{a.risk}</span>
                    </div>
                    <p style={{ margin:"0 0 6px", color:"#475569", fontSize:13, lineHeight:1.6 }}>{a.assumption}</p>
                    <p style={{ margin:0, color:"#64748b", fontSize:11, fontFamily:"monospace", fontStyle:"italic" }}>Evidence: {a.evidence}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "steps" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:"0 0 8px", color:"#64748b", fontSize:12, fontFamily:"monospace" }}>Do these before writing a line of code.</p>
                {(model.validationSteps||[]).map((s,i) => (
                  <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"14px 18px", display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:s.priority==="high"?"#eff6ff":"#f8fafc", border:`1px solid ${s.priority==="high"?"#1a56db":"#cbd5e1"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:s.priority==="high"?"#1a56db":"#64748b", fontFamily:"monospace" }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <div style={{ color:"#1a1a2e", fontSize:14 }}>{s.label}</div>
                        <div style={{ fontSize:11, fontFamily:"monospace", color:"#64748b" }}>{s.effort}</div>
                      </div>
                      <p style={{ margin:0, color:"#475569", fontSize:13, lineHeight:1.6 }}>{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "scoring" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {(model.scoring||[]).map((c,i) => {
                  const col = c.score>=7?"#16a34a":c.score>=5?"#b45309":"#dc2626";
                  return (
                    <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"14px 18px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ color:"#1a1a2e", fontSize:14 }}>{c.name}</div>
                        <div style={{ fontFamily:"monospace", color:col, fontSize:20 }}>{c.score}<span style={{ color:"#94a3b8", fontSize:12 }}>/10</span></div>
                      </div>
                      <div style={{ background:"#e2e8f0", borderRadius:3, height:3, marginBottom:8 }}>
                        <div style={{ background:col, width:`${c.score*10}%`, height:"100%", borderRadius:3 }}/>
                      </div>
                      <p style={{ margin:0, color:"#64748b", fontSize:11, fontFamily:"monospace", fontStyle:"italic" }}>{c.note}</p>
                    </div>
                  );
                })}
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ color:"#1a56db", fontFamily:"monospace", fontSize:12, letterSpacing:"0.1em" }}>COMPOSITE</div>
                  <div style={{ fontFamily:"monospace", fontSize:28, color:"#1a56db" }}>{avg}<span style={{ color:"#64748b", fontSize:14 }}>/10</span></div>
                </div>
              </div>
            )}

            {tab === "verdict" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ background:verdictCfg[model.verdict]?.bg||"#fff", border:`2px solid ${verdictCfg[model.verdict]?.border||"#cbd5e1"}`, borderRadius:12, padding:"24px 28px", display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#64748b", marginBottom:4 }}>DECISION</div>
                    <div style={{ fontSize:36, color:verdictCfg[model.verdict]?.color, fontFamily:"monospace" }}>{model.verdict}</div>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#64748b", marginTop:2 }}>{model.confidence}% confidence</div>
                  </div>
                  <div style={{ width:1, height:60, background:"#cbd5e1", flexShrink:0 }}/>
                  <p style={{ margin:0, color:"#334155", lineHeight:1.8, fontSize:14, flex:1 }}>{model.rationale}</p>
                </div>
                <Card title="Next 5 Actions">
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {(model.nextSteps||[]).map((s,i) => (
                      <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 14px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7 }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, background:"#eff6ff", border:"1px solid #1a56db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#1a56db", fontFamily:"monospace" }}>{i+1}</div>
                        <p style={{ margin:0, color:"#475569", fontSize:13, lineHeight:1.6 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            <div style={{ marginTop:40, textAlign:"center" }}>
              <button onClick={reset} style={{ background:"#fff", border:"1px solid #cbd5e1", borderRadius:8, color:"#1a56db", padding:"10px 24px", cursor:"pointer", fontSize:12, fontFamily:"monospace" }}>← Validate another idea</button>
            </div>
          </div>

          <PrintReport model={model} avg={avg} />
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 22px" }}>
      <div style={{ fontSize:10, fontFamily:"monospace", letterSpacing:"0.15em", color:"#1a56db", textTransform:"uppercase", marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"#999", marginBottom:6 }}>{title}</div>
      <p style={{ margin:0, lineHeight:1.7, fontSize:14 }}>{children}</p>
    </div>
  );
}

function V2Overview({ model, avg, answers, onDetails, onReset }) {
  const strongest = [...(model.scoring || [])].sort((a,b) => b.score - a.score)[0];
  const riskiest = [...(model.assumptions || [])].sort((a,b) => ({high:0,medium:1,low:2}[a.risk] - {high:0,medium:1,low:2}[b.risk]))[0];
  const firstTest = model.validationSteps?.[0];
  const successSignal = model.nextSteps?.[0] || "Define a measurable commitment before you build.";
  const verdict = verdictCfg[model.verdict] || verdictCfg.TEST;

  return (
    <div style={{ minHeight:"100dvh", boxSizing:"border-box", padding:"clamp(28px,4vw,58px)", background:"radial-gradient(circle at 100% 0%,#dbeafe 0,transparent 34%),#f0f4f8" }}>
      <div style={{ maxWidth:1320, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:24 }}>
          <div>
            <div style={{ color:"#1a56db", fontSize:11, fontFamily:"monospace", fontWeight:700, letterSpacing:".16em", marginBottom:18 }}>YOUR VALIDATION MODEL</div>
            <h1 style={{ margin:0, maxWidth:900, color:"#1a1a2e", fontSize:"clamp(42px,7vw,82px)", lineHeight:.96, letterSpacing:"-.06em" }}>Decide what earns the next hour.</h1>
          </div>
          <div style={{ minWidth:160, border:`1.5px solid ${verdict.border}`, background:verdict.bg, borderRadius:14, padding:"17px 22px", textAlign:"center" }}>
            <div style={{ color:"#64748b", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".13em" }}>VERDICT</div>
            <div style={{ color:verdict.color, fontSize:28, fontWeight:800, marginTop:6 }}>{model.verdict}</div>
          </div>
        </div>
        <p style={{ margin:"28px 0 34px", maxWidth:960, color:"#475569", fontSize:"clamp(17px,2vw,23px)", lineHeight:1.45 }}>{model.rationale}</p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden", background:"#fff" }}>
          <div style={{ padding:"24px 28px", borderRight:"1px solid #e2e8f0" }}>
            <div style={{ color:"#1a56db", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".12em" }}>READINESS SCORE</div>
            <div style={{ marginTop:14, color:"#1a56db", fontSize:54, lineHeight:.9, fontWeight:700 }}>{avg * 10}<span style={{ color:"#94a3b8", fontSize:22 }}>/100</span></div>
          </div>
          <div style={{ padding:"24px 28px", borderRight:"1px solid #e2e8f0" }}>
            <div style={{ color:"#1a56db", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".12em" }}>STRONGEST SIGNAL</div>
            <div style={{ color:"#1a1a2e", marginTop:14, fontSize:28, fontWeight:700, lineHeight:1.08 }}>{strongest?.name || "Clarity"}</div>
            <div style={{ color:"#64748b", marginTop:8, fontSize:14 }}>Make this your foundation for the first test.</div>
          </div>
          <div style={{ padding:"24px 28px" }}>
            <div style={{ color:"#1a56db", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".12em" }}>RISKEST ASSUMPTION</div>
            <div style={{ color:"#1a1a2e", marginTop:14, fontSize:22, fontWeight:700, lineHeight:1.16 }}>{riskiest?.assumption || answers.blockers}</div>
          </div>
        </div>

        <div style={{ marginTop:28, border:"1px solid #e2e8f0", borderRadius:13, background:"#fff", padding:"22px clamp(14px,3vw,30px) 16px" }}>
          <div style={{ color:"#1a56db", fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:".12em", textAlign:"center" }}>SIX-DIMENSION SCORE PROFILE</div>
          <div style={{ color:"#64748b", fontSize:13, lineHeight:1.45, textAlign:"center", marginTop:7 }}>See where the idea is balanced—and where one weak dimension could constrain the whole opportunity.</div>
          <RadarChart scoring={model.scoring || []} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:28 }}>
          {[
            ["01 — CORE BET", model.solution],
            ["02 — CUSTOMER", answers.user],
            ["03 — FIRST TEST", firstTest?.description || "Run a focused test before committing to build."],
            ["04 — SUCCESS SIGNAL", successSignal],
          ].map(([label, text]) => (
            <div key={label} style={{ border:"1px solid #e2e8f0", borderRadius:13, background:"#fff", padding:"22px 26px" }}>
              <div style={{ color:"#1a56db", fontSize:11, fontFamily:"monospace", fontWeight:700, letterSpacing:".12em", marginBottom:14 }}>{label}</div>
              <div style={{ color:"#334155", fontSize:17, lineHeight:1.45 }}>{text}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginTop:30, flexWrap:"wrap" }}>
          <button onClick={onReset} style={{ background:"#fff", border:"1px solid #cbd5e1", borderRadius:9, color:"#1a56db", padding:"13px 20px", cursor:"pointer", fontSize:14, fontWeight:700 }}>← Edit answers</button>
          <button onClick={onDetails} style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:9, color:"#1a56db", padding:"13px 20px", cursor:"pointer", fontSize:14, fontWeight:700 }}>View full analysis →</button>
          <button onClick={() => window.print()} style={{ background:"#1a56db", border:0, borderRadius:9, color:"#fff", padding:"13px 20px", cursor:"pointer", fontSize:14, fontWeight:700 }}>Export PDF</button>
        </div>
      </div>
    </div>
  );
}

function PrintReport({ model, avg }) {
  const assumptions = [...(model.assumptions || [])].sort((a,b) => ({high:0,medium:1,low:2}[a.risk] - {high:0,medium:1,low:2}[b.risk]));
  const scoring = model.scoring || [];
  const strongest = scoring.length ? [...scoring].sort((a,b) => b.score - a.score)[0] : null;
  const riskiest = assumptions[0];
  const verdict = verdictCfg[model.verdict] || verdictCfg.TEST;
  const footer = (page) => (
    <div style={{ marginTop:"auto", paddingTop:10, borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", color:"#64748b", fontFamily:"Arial,sans-serif", fontSize:8 }}>
      <span>TEST MY IDEA · FOUNDER DECISION BRIEF</span><span>{page} / 3</span>
    </div>
  );

  return (
    <div className="print-all" style={{ display:"none", color:"#1a1a2e", fontFamily:"Arial,sans-serif", background:"#fff" }}>
      <section className="print-page" style={{ display:"flex", flexDirection:"column", background:"#fff" }}>
        <div style={{ color:"#1a56db", fontSize:9, fontWeight:700, letterSpacing:"0.18em", marginBottom:14 }}>TEST MY IDEA · DECISION BRIEF</div>
        <div style={{ display:"flex", justifyContent:"space-between", gap:24, alignItems:"flex-start", borderBottom:"1px solid #e2e8f0", paddingBottom:20 }}>
          <div style={{ maxWidth:"68%" }}>
            <h1 style={{ margin:0, color:"#1a1a2e", fontSize:34, lineHeight:1.05, letterSpacing:"-0.04em" }}>{model.ideaName}</h1>
            <p style={{ margin:"10px 0 0", color:"#475569", fontSize:15, lineHeight:1.45 }}>{model.tagline}</p>
          </div>
          <div style={{ minWidth:110, border:`2px solid ${verdict.border}`, borderRadius:10, padding:"12px", background:verdict.bg, textAlign:"center" }}>
            <div style={{ color:"#64748b", fontSize:8, fontWeight:700, letterSpacing:"0.12em" }}>VERDICT</div>
            <div style={{ color:verdict.color, fontWeight:800, fontSize:25, margin:"4px 0" }}>{model.verdict}</div>
            <div style={{ color:"#475569", fontSize:9 }}>{model.confidence}% confidence</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:20 }}>
          <div className="print-card" style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:12 }}>
            <div style={{ color:"#1a56db", fontSize:8, fontWeight:700, letterSpacing:"0.12em" }}>READINESS</div>
            <div style={{ color:"#1a1a2e", fontSize:30, fontWeight:800, marginTop:5 }}>{avg}<span style={{ fontSize:12, color:"#64748b" }}>/10</span></div>
          </div>
          <div className="print-card" style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:12 }}>
            <div style={{ color:"#64748b", fontSize:8, fontWeight:700, letterSpacing:"0.12em" }}>STRONGEST SIGNAL</div>
            <div style={{ color:"#1a1a2e", fontSize:14, fontWeight:700, marginTop:8 }}>{strongest?.name || "To be tested"}</div>
            <div style={{ color:"#64748b", fontSize:10, marginTop:4 }}>{strongest ? `${strongest.score}/10` : "No score"}</div>
          </div>
          <div className="print-card" style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:8, padding:12 }}>
            <div style={{ color:"#b45309", fontSize:8, fontWeight:700, letterSpacing:"0.12em" }}>RISKEST BET</div>
            <div style={{ color:"#1a1a2e", fontSize:13, fontWeight:700, marginTop:8, lineHeight:1.2 }}>{riskiest?.label || "Define the primary risk"}</div>
          </div>
        </div>

        <div style={{ marginTop:24 }}>
          <div style={{ color:"#1a56db", fontSize:9, fontWeight:700, letterSpacing:"0.14em", marginBottom:8 }}>THE DECISION</div>
          <p style={{ color:"#1a1a2e", fontSize:18, lineHeight:1.42, margin:0, fontWeight:600 }}>{model.rationale}</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:22 }}>
          {[["THE PROBLEM",model.problem],["THE PROMISE",model.solution],["WHY IT COULD WIN",model.differentiation]].map(([title,text]) => (
            <div key={title} className="print-card" style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:14, gridColumn:title === "WHY IT COULD WIN" ? "span 2" : "span 1" }}>
              <div style={{ color:"#64748b", fontSize:8, fontWeight:700, letterSpacing:"0.13em", marginBottom:6 }}>{title}</div>
              <div style={{ color:"#334155", fontSize:11, lineHeight:1.5 }}>{text}</div>
            </div>
          ))}
        </div>
        {footer(1)}
      </section>

      <section className="print-page" style={{ display:"flex", flexDirection:"column", background:"#fff" }}>
        <div style={{ color:"#1a56db", fontSize:9, fontWeight:700, letterSpacing:"0.18em" }}>WHAT MUST BE TRUE</div>
        <h2 style={{ margin:"8px 0 6px", fontSize:25, letterSpacing:"-0.03em" }}>The assumptions worth proving first.</h2>
        <p style={{ margin:"0 0 18px", color:"#64748b", fontSize:11, lineHeight:1.5 }}>Start with the risks that can invalidate the business—not the features that are easiest to build.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {assumptions.map((a,i) => (
            <div key={i} className="print-assumption" style={{ border:"1px solid #e2e8f0", borderLeft:`4px solid ${riskColor[a.risk]}`, borderRadius:8, padding:"13px 15px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center" }}>
                <div style={{ color:"#1a1a2e", fontSize:14, fontWeight:700 }}>{a.label}</div>
                <div style={{ color:riskColor[a.risk], background:riskBg[a.risk], borderRadius:99, padding:"3px 7px", fontSize:8, fontWeight:800, letterSpacing:"0.1em" }}>{a.risk.toUpperCase()} RISK</div>
              </div>
              <div style={{ color:"#334155", fontSize:11, lineHeight:1.45, marginTop:6 }}>{a.assumption}</div>
              <div style={{ color:"#64748b", fontSize:9, lineHeight:1.35, marginTop:6 }}><strong>Current evidence:</strong> {a.evidence}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:18, color:"#1a56db", fontSize:9, fontWeight:700, letterSpacing:"0.18em" }}>SCORE PROFILE</div>
        <div style={{ display:"grid", gridTemplateColumns:"210px 1fr", gap:20, alignItems:"center", marginTop:6 }}>
          <RadarChart scoring={scoring} compact />
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:7 }}>
            {scoring.map((s,i) => {
              const color = s.score >= 7 ? "#16a34a" : s.score >= 5 ? "#b45309" : "#dc2626";
              return <div key={i} className="print-card" style={{ borderBottom:"1px solid #e2e8f0", paddingBottom:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", color:"#334155", fontSize:9, fontWeight:700 }}><span>{s.name}</span><span style={{ color }}>{s.score}/10</span></div>
                <div style={{ height:3, background:"#e2e8f0", borderRadius:99, margin:"4px 0" }}><div style={{ width:`${s.score * 10}%`, height:"100%", borderRadius:99, background:color }}/></div>
                <div style={{ color:"#64748b", fontSize:7, lineHeight:1.2 }}>{s.note}</div>
              </div>;
            })}
          </div>
        </div>
        {footer(2)}
      </section>

      <section className="print-page" style={{ display:"flex", flexDirection:"column", background:"#fff" }}>
        <div style={{ color:"#1a56db", fontSize:9, fontWeight:700, letterSpacing:"0.18em" }}>30-DAY VALIDATION PLAN</div>
        <h2 style={{ margin:"8px 0 6px", fontSize:25, letterSpacing:"-0.03em" }}>Earn the right to build.</h2>
        <p style={{ margin:"0 0 16px", color:"#64748b", fontSize:11, lineHeight:1.5 }}>Each test should change a decision. Record the result, then either advance, adapt or stop.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {(model.validationSteps || []).map((s,i) => (
            <div key={i} className="print-action" style={{ display:"grid", gridTemplateColumns:"30px 1fr auto", gap:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 14px", alignItems:"start" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", display:"grid", placeItems:"center", background:"#eff6ff", color:"#1a56db", border:"1px solid #bfdbfe", fontSize:11, fontWeight:800 }}>{i+1}</div>
              <div><div style={{ color:"#1a1a2e", fontSize:13, fontWeight:700 }}>{s.label}</div><div style={{ color:"#475569", fontSize:10, lineHeight:1.4, marginTop:4 }}>{s.description}</div></div>
              <div style={{ color:"#1a56db", fontSize:8, fontWeight:700, whiteSpace:"nowrap", paddingTop:3 }}>{s.effort}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:20, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:16 }}>
          <div style={{ color:"#1a56db", fontSize:9, fontWeight:800, letterSpacing:"0.14em", marginBottom:8 }}>THIS WEEK&apos;S FOUNDER CHECKLIST</div>
          {(model.nextSteps || []).map((s,i) => <div key={i} style={{ display:"flex", gap:8, color:"#334155", fontSize:10, lineHeight:1.35, marginBottom:i === (model.nextSteps || []).length - 1 ? 0 : 7 }}><span style={{ color:"#1a56db", fontWeight:800 }}>{String(i+1).padStart(2,"0")}</span><span>{s}</span></div>)}
        </div>
        <div style={{ marginTop:16, borderTop:"1px solid #e2e8f0", paddingTop:12, color:"#64748b", fontSize:9, lineHeight:1.4 }}><strong style={{ color:"#334155" }}>Decision rule:</strong> Move forward only when the highest-risk assumption has evidence stronger than an opinion or vanity metric.</div>
        {footer(3)}
      </section>
    </div>
  );
}
