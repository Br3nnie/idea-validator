import { useState, useRef, useEffect } from "react";

const STEPS = [
  { id: "idea", label: "The Idea", question: "Describe your idea in plain language. What is it, who is it for, and what problem does it solve?" },
  { id: "user", label: "The User", question: "Who feels this pain most? Be specific — age, situation, context. Solo user or shared (e.g. couples, teams)?" },
  { id: "evidence", label: "Your Evidence", question: "What evidence do you have that this problem is real? Lived it, heard complaints, or a hunch?" },
  { id: "competition", label: "Competition", question: "What do people do today to solve this? Any apps, tools, or workarounds? What's missing?" },
  { id: "monetisation", label: "Monetisation", question: "How would this make money? One-off, subscription, freemium, B2B? Price instinct?" },
  { id: "blockers", label: "Biggest Fear", question: "What's the one thing that would kill this idea? What are you most uncertain about?" },
];

const MIN_ANSWER_CHARS = 40;
const MAX_ANSWER_CHARS = 500;

const riskColor = { low: "#4ade80", medium: "#fbbf24", high: "#f87171" };
const riskBg   = { low: "#052e16", medium: "#1c1008", high: "#1c0606" };
const verdictCfg = {
  GO:   { color: "#4ade80", bg: "#052e16", border: "#4ade80" },
  TEST: { color: "#fbbf24", bg: "#1c1008", border: "#fbbf24" },
  KILL: { color: "#f87171", bg: "#1c0606", border: "#f87171" },
};

// Axis calculations from scoring array
function getAxes(scoring) {
  const get = name => (scoring.find(s => s.name === name)?.score || 5);
  const market = Math.round((get("Market size") + get("Differentiation") + get("Problem clarity")) / 3);
  const exec   = Math.round((get("Technical feasibility") + get("Monetisation fit") + get("Speed to test")) / 3);
  return { market, exec };
}

function getQuadrant(market, exec) {
  if (market >= 6 && exec >= 6) return { label: "GO ZONE", desc: "Strong market, strong execution path", color: "#4ade80" };
  if (market >= 6 && exec < 6)  return { label: "PARTNER UP", desc: "Big opportunity, hard to execute alone", color: "#fbbf24" };
  if (market < 6  && exec >= 6) return { label: "LIFESTYLE", desc: "Easy to build, limited upside", color: "#60a5fa" };
  return { label: "RETHINK", desc: "Hard to build, small market", color: "#f87171" };
}

async function callAPI(prompt) {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function Matrix({ scoring, ideaName }) {
  const { market, exec } = getAxes(scoring);
  const q = getQuadrant(market, exec);

  // Convert 1-10 scores to % position in matrix (10% padding each side)
  const xPct = 10 + (exec   / 10) * 80;
  const yPct = 10 + ((10 - market) / 10) * 80; // invert Y so high = top

  const quadrants = [
    { x:"50%", y:"25%", label:"GO ZONE",    color:"#4ade8022", textColor:"#4ade80" },
    { x:"0%",  y:"25%", label:"PARTNER UP", color:"#fbbf2422", textColor:"#fbbf24" },
    { x:"50%", y:"75%", label:"LIFESTYLE",  color:"#60a5fa22", textColor:"#60a5fa" },
    { x:"0%",  y:"75%", label:"RETHINK",    color:"#f8717122", textColor:"#f87171" },
  ];

  return (
    <div className="print-section">
      <div style={{ marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#c9a84c", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Opportunity Matrix</div>
          <div style={{ fontSize:13, color:"#9b97b0" }}>Market Attractiveness vs Execution Feasibility</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:11, fontFamily:"monospace", color:q.color, letterSpacing:"0.1em" }}>{q.label}</div>
          <div style={{ fontSize:11, color:"#5a5870" }}>{q.desc}</div>
        </div>
      </div>

      <div style={{ position:"relative", width:"100%", paddingBottom:"60%", background:"#0a0a12", border:"1px solid #1a1a2e", borderRadius:10, overflow:"hidden" }}>
        {/* Quadrant backgrounds */}
        {quadrants.map(qd => (
          <div key={qd.label} style={{ position:"absolute", width:"50%", height:"50%", left:qd.x, top:qd.y, transform:"translate(0,-50%) translate(0,0)", background:qd.color }}>
            <span style={{ position:"absolute", bottom:8, right:8, fontSize:9, fontFamily:"monospace", color:qd.textColor, letterSpacing:"0.12em", opacity:0.7 }}>{qd.label}</span>
          </div>
        ))}

        {/* Axis lines */}
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"#2a2a3e" }}/>
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:"#2a2a3e" }}/>

        {/* Axis labels */}
        <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", fontSize:9, fontFamily:"monospace", color:"#3a3850", letterSpacing:"0.1em" }}>EXECUTION FEASIBILITY →</div>
        <div style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%) rotate(-90deg)", fontSize:9, fontFamily:"monospace", color:"#3a3850", letterSpacing:"0.1em", transformOrigin:"center" }}>MARKET ATTRACTIVENESS →</div>
        <div style={{ position:"absolute", bottom:6, right:8, fontSize:9, fontFamily:"monospace", color:"#3a3850" }}>HIGH</div>
        <div style={{ position:"absolute", bottom:6, left:20, fontSize:9, fontFamily:"monospace", color:"#3a3850" }}>LOW</div>
        <div style={{ position:"absolute", top:6, left:20, fontSize:9, fontFamily:"monospace", color:"#3a3850" }}>HIGH</div>

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
          background:"#080810ee",
          padding:"3px 7px", borderRadius:4,
          border:`1px solid ${q.color}44`,
          whiteSpace:"nowrap",
          zIndex:3,
        }}>{ideaName}</div>
      </div>

      {/* Axis score breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        <div style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:8, padding:"12px 16px" }}>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#c9a84c", letterSpacing:"0.1em", marginBottom:8 }}>MARKET ATTRACTIVENESS</div>
          <div style={{ fontSize:28, fontFamily:"monospace", color: market>=7?"#4ade80":market>=5?"#fbbf24":"#f87171", marginBottom:6 }}>{market}<span style={{ fontSize:12, color:"#3a3850" }}>/10</span></div>
          <div style={{ fontSize:11, color:"#5a5870" }}>Problem clarity · Market size · Differentiation</div>
        </div>
        <div style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:8, padding:"12px 16px" }}>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#c9a84c", letterSpacing:"0.1em", marginBottom:8 }}>EXECUTION FEASIBILITY</div>
          <div style={{ fontSize:28, fontFamily:"monospace", color: exec>=7?"#4ade80":exec>=5?"#fbbf24":"#f87171", marginBottom:6 }}>{exec}<span style={{ fontSize:12, color:"#3a3850" }}>/10</span></div>
          <div style={{ fontSize:11, color:"#5a5870" }}>Technical feasibility · Monetisation fit · Speed to test</div>
        </div>
      </div>
    </div>
  );
}

export default function IdeaValidator() {
  const [phase, setPhase]   = useState("intro");
  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({});
  const [answer, setAnswer] = useState("");
  const [model, setModel]   = useState(null);
  const [tab, setTab]       = useState("overview");
  const [error, setError]   = useState(null);
  const [status, setStatus] = useState("");
  const ref = useRef(null);

  useEffect(() => { if (phase === "intake") ref.current?.focus(); }, [phase, step]);

  const next = () => {
    const updated = { ...answers, [STEPS[step].id]: answer.trim() };
    setAnswers(updated);
    setAnswer("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else generate(updated);
  };

  const keyDown = e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim().length >= MIN_ANSWER_CHARS) next(); };

  const generate = async (a) => {
    setPhase("generating"); setError(null);
    const ctx = STEPS.map(s => `${s.label}: ${a[s.id]}`).join("\n");
    try {
      setStatus("Analysing the idea...");
      const overview = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with keys: ideaName, tagline, problem, solution, differentiation. Short strings only.`);
      setStatus("Mapping assumptions...");
      const part2 = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with:\n"assumptions": array of 4 objects {label,assumption,risk("low"|"medium"|"high"),evidence}\n"validationSteps": array of 4 objects {label,description,effort,priority("high"|"medium")}`);
      setStatus("Reaching verdict...");
      const part3 = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with:\n"scoring": array of 6 objects {name,score(1-10),note} — names must be exactly: "Problem clarity","Market size","Differentiation","Technical feasibility","Monetisation fit","Speed to test"\n"verdict": "GO"|"TEST"|"KILL"\n"confidence": integer 1-100\n"rationale": 2 sentence string\n"nextSteps": array of 5 action strings`);
      setModel({ ...overview, ...part2, ...part3 });
      setPhase("results"); setTab("overview");
    } catch (err) {
      setError(err.message);
      setPhase("intake"); setStep(STEPS.length - 1);
    }
  };

  const reset = () => { setPhase("intro"); setStep(0); setAnswers({}); setAnswer(""); setModel(null); setError(null); setStatus(""); };

  const avg = model?.scoring ? Math.round(model.scoring.reduce((s,c) => s+c.score,0)/model.scoring.length) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#ddd9cc", fontFamily:"'Palatino Linotype',Palatino,serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @media print {
          body { background: white !important; color: #111 !important; }
          .no-print { display: none !important; }
          .print-section { page-break-inside: avoid; }
          .print-all * { display: block !important; }
        }
      `}</style>

      {/* INTRO */}
      {phase === "intro" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
          <div style={{ width:56, height:56, borderRadius:"50%", border:"1px solid #c9a84c", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:32, fontSize:22 }}>◈</div>
          <h1 style={{ margin:"0 0 12px", fontSize:40, fontWeight:400, color:"#f0ede6" }}>Idea Validator</h1>
          <p style={{ margin:"0 0 8px", color:"#9b97b0", fontSize:16, fontStyle:"italic" }}>Answer 6 questions. Get a full validation model.</p>
          <p style={{ margin:"0 0 48px", color:"#5a5870", fontSize:13, maxWidth:380, lineHeight:1.7 }}>Assumptions mapped. Risks ranked. Go/Test/Kill verdict. Before you write a single line of code.</p>
          <button onClick={() => setPhase("intake")} style={{ background:"#c9a84c", color:"#080810", border:"none", borderRadius:8, padding:"14px 40px", fontSize:15, fontFamily:"inherit", cursor:"pointer" }}>Validate an idea →</button>
          <p style={{ margin:"24px 0 0", color:"#3a3850", fontSize:11, fontFamily:"monospace" }}>Built on the 60-Minute Validation Framework</p>
        </div>
      )}

      {/* INTAKE */}
      {phase === "intake" && (
        <div style={{ height:"100svh", minHeight:0, display:"flex", flexDirection:"column", padding:"clamp(16px,3vh,32px) 24px", maxWidth:680, margin:"0 auto" }}>
          <div style={{ display:"flex", gap:6, marginBottom:"clamp(20px,4vh,40px)", flexShrink:0 }}>
            {STEPS.map((_,i) => <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<step?"#c9a84c":i===step?"#c9a84c88":"#1a1a2e", transition:"background 0.3s" }}/>)}
          </div>
          <div style={{ flex:1, minHeight:0 }}>
            <div style={{ fontSize:11, fontFamily:"monospace", color:"#c9a84c", letterSpacing:"0.15em", marginBottom:12 }}>{step+1} of {STEPS.length} — {STEPS[step].label}</div>
            <h2 style={{ margin:"0 0 clamp(16px,2.5vh,24px)", fontSize:"clamp(20px,3vw,24px)", fontWeight:400, color:"#f0ede6", lineHeight:1.35 }}>{STEPS[step].question}</h2>
            <textarea ref={ref} value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={keyDown} placeholder="Type your answer..." rows={5} maxLength={MAX_ANSWER_CHARS}
              style={{ width:"100%", height:"clamp(120px,20vh,170px)", background:"#0f0f1a", border:"1px solid #2a2a3e", borderRadius:10, padding:"16px 18px", color:"#ddd9cc", fontSize:15, fontFamily:"inherit", lineHeight:1.7, resize:"none", outline:"none", boxSizing:"border-box" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, margin:"8px 0 0", fontSize:11, fontFamily:"monospace", color:answer.trim().length >= MIN_ANSWER_CHARS ? "#4ade80" : "#5a5870" }}>
              <span>{answer.trim().length >= MIN_ANSWER_CHARS ? "Enough detail to continue" : `${MIN_ANSWER_CHARS - answer.trim().length} more characters for a useful answer`}</span>
              <span style={{ color:"#5a5870", whiteSpace:"nowrap" }}>{answer.length}/{MAX_ANSWER_CHARS}</span>
            </div>
            <p style={{ margin:"8px 0 0", fontSize:11, color:"#3a3850", fontFamily:"monospace" }}>⌘+Enter to continue</p>
          </div>
          {error && <div style={{ color:"#f87171", fontSize:12, marginBottom:16, fontFamily:"monospace", background:"#1c0606", padding:"10px 14px", borderRadius:6, wordBreak:"break-word" }}>{error}</div>}
          <div style={{ display:"flex", justifyContent:"space-between", paddingTop:"clamp(14px,2vh,22px)", flexShrink:0 }}>
            <button onClick={() => { if(step===0) reset(); else { setStep(step-1); setAnswer(answers[STEPS[step-1].id]||""); }}}
              style={{ background:"none", border:"1px solid #2a2a3e", borderRadius:8, color:"#6b6b8a", padding:"10px 20px", cursor:"pointer", fontSize:13, fontFamily:"monospace" }}>← Back</button>
            <button onClick={next} disabled={answer.trim().length<MIN_ANSWER_CHARS}
              style={{ background:answer.trim().length>=MIN_ANSWER_CHARS?"#c9a84c":"#1a1a2e", color:answer.trim().length>=MIN_ANSWER_CHARS?"#080810":"#3a3850", border:"none", borderRadius:8, padding:"12px 28px", cursor:answer.trim().length>=MIN_ANSWER_CHARS?"pointer":"default", fontSize:14, fontFamily:"inherit", transition:"all 0.2s" }}>
              {step===STEPS.length-1?"Generate Model →":"Next →"}
            </button>
          </div>
        </div>
      )}

      {/* GENERATING */}
      {phase === "generating" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:40 }}>
          <div style={{ width:48, height:48, border:"1px solid #c9a84c44", borderTop:"1px solid #c9a84c", borderRadius:"50%", animation:"spin 1s linear infinite", marginBottom:32 }}/>
          <p style={{ color:"#9b97b0", fontSize:16, margin:0 }}>{status||"Building your validation model..."}</p>
          <p style={{ color:"#3a3850", fontSize:12, margin:"8px 0 0", fontFamily:"monospace" }}>3 analysis passes · ~15–30 seconds</p>
        </div>
      )}

      {/* RESULTS */}
      {phase === "results" && model && (
        <div>
          {/* Header */}
          <div className="no-print" style={{ borderBottom:"1px solid #1a1a2e", padding:"28px 32px 20px", background:"#0a0a12" }}>
            <div style={{ maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:"monospace", color:"#5a5870", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>Validation Model</div>
                <h1 style={{ margin:0, fontSize:32, fontWeight:400, color:"#f0ede6" }}>{model.ideaName}</h1>
                <p style={{ margin:"6px 0 0", color:"#7b79a0", fontSize:14, fontStyle:"italic" }}>{model.tagline}</p>
              </div>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ background:"#0f0f1a", border:"1px solid #2a2a3e", borderRadius:10, padding:"12px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#5a5870", fontFamily:"monospace", marginBottom:2 }}>SCORE</div>
                  <div style={{ fontSize:32, color:avg>=7?"#4ade80":avg>=5?"#fbbf24":"#f87171" }}>{avg}</div>
                  <div style={{ fontSize:10, color:"#3a3850" }}>/10</div>
                </div>
                <div style={{ background:verdictCfg[model.verdict]?.bg||"#1a1a2e", border:`1px solid ${verdictCfg[model.verdict]?.border||"#2a2a3e"}`, borderRadius:10, padding:"12px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#5a5870", fontFamily:"monospace", marginBottom:2 }}>VERDICT</div>
                  <div style={{ fontSize:20, color:verdictCfg[model.verdict]?.color||"#ddd9cc", fontFamily:"monospace" }}>{model.verdict}</div>
                  <div style={{ fontSize:10, color:"#5a5870" }}>{model.confidence}% conf.</div>
                </div>
                {/* Print button */}
                <button onClick={() => window.print()} style={{ background:"#1a1a2e", border:"1px solid #2a2a3e", borderRadius:10, padding:"12px 16px", color:"#9b97b0", cursor:"pointer", fontSize:12, fontFamily:"monospace", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:18 }}>⎙</span>
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="no-print" style={{ borderBottom:"1px solid #1a1a2e", padding:"0 32px" }}>
            <div style={{ maxWidth:900, margin:"0 auto", display:"flex" }}>
              {["overview","matrix","assumptions","steps","scoring","verdict"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ background:"none", border:"none", borderBottom:tab===t?"2px solid #c9a84c":"2px solid transparent", color:tab===t?"#c9a84c":"#5a5870", padding:"12px 14px", cursor:"pointer", fontSize:12, fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase" }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Tab content — screen */}
          <div className="no-print" style={{ maxWidth:900, margin:"0 auto", padding:32 }}>

            {tab === "overview" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[["Problem",model.problem],["Solution",model.solution],["Differentiation",model.differentiation]].map(([t,v]) => (
                  <Card key={t} title={t}><p style={{ margin:0, lineHeight:1.8, color:"#b8b6cc", fontSize:14 }}>{v}</p></Card>
                ))}
              </div>
            )}

            {tab === "matrix" && model.scoring && (
              <Matrix scoring={model.scoring} ideaName={model.ideaName} />
            )}

            {tab === "assumptions" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:"0 0 8px", color:"#5a5870", fontSize:12, fontFamily:"monospace" }}>Sorted by risk. High-risk = kill conditions.</p>
                {[...(model.assumptions||[])].sort((a,b)=>({high:0,medium:1,low:2}[a.risk]-{high:0,medium:1,low:2}[b.risk])).map((a,i) => (
                  <div key={i} style={{ background:"#0f0f1a", border:`1px solid ${riskColor[a.risk]}22`, borderLeft:`3px solid ${riskColor[a.risk]}`, borderRadius:8, padding:"14px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ color:"#f0ede6", fontSize:14 }}>{a.label}</div>
                      <span style={{ background:riskBg[a.risk], color:riskColor[a.risk], fontSize:9, fontFamily:"monospace", letterSpacing:"0.15em", padding:"2px 7px", borderRadius:3, textTransform:"uppercase" }}>{a.risk}</span>
                    </div>
                    <p style={{ margin:"0 0 6px", color:"#9b97b0", fontSize:13, lineHeight:1.6 }}>{a.assumption}</p>
                    <p style={{ margin:0, color:"#5a5870", fontSize:11, fontFamily:"monospace", fontStyle:"italic" }}>Evidence: {a.evidence}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "steps" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:"0 0 8px", color:"#5a5870", fontSize:12, fontFamily:"monospace" }}>Do these before writing a line of code.</p>
                {(model.validationSteps||[]).map((s,i) => (
                  <div key={i} style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:8, padding:"14px 18px", display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:s.priority==="high"?"#c9a84c18":"#1a1a2e", border:`1px solid ${s.priority==="high"?"#c9a84c":"#2a2a3e"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:s.priority==="high"?"#c9a84c":"#5a5870", fontFamily:"monospace" }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <div style={{ color:"#f0ede6", fontSize:14 }}>{s.label}</div>
                        <div style={{ fontSize:11, fontFamily:"monospace", color:"#5a5870" }}>{s.effort}</div>
                      </div>
                      <p style={{ margin:0, color:"#9b97b0", fontSize:13, lineHeight:1.6 }}>{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "scoring" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {(model.scoring||[]).map((c,i) => {
                  const col = c.score>=7?"#4ade80":c.score>=5?"#fbbf24":"#f87171";
                  return (
                    <div key={i} style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:8, padding:"14px 18px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ color:"#f0ede6", fontSize:14 }}>{c.name}</div>
                        <div style={{ fontFamily:"monospace", color:col, fontSize:20 }}>{c.score}<span style={{ color:"#3a3850", fontSize:12 }}>/10</span></div>
                      </div>
                      <div style={{ background:"#1a1a2e", borderRadius:3, height:3, marginBottom:8 }}>
                        <div style={{ background:col, width:`${c.score*10}%`, height:"100%", borderRadius:3 }}/>
                      </div>
                      <p style={{ margin:0, color:"#5a5870", fontSize:11, fontFamily:"monospace", fontStyle:"italic" }}>{c.note}</p>
                    </div>
                  );
                })}
                <div style={{ background:"#0f0f1a", border:"1px solid #c9a84c33", borderRadius:8, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ color:"#c9a84c", fontFamily:"monospace", fontSize:12, letterSpacing:"0.1em" }}>COMPOSITE</div>
                  <div style={{ fontFamily:"monospace", fontSize:28, color:"#c9a84c" }}>{avg}<span style={{ color:"#5a5870", fontSize:14 }}>/10</span></div>
                </div>
              </div>
            )}

            {tab === "verdict" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ background:verdictCfg[model.verdict]?.bg||"#0f0f1a", border:`2px solid ${verdictCfg[model.verdict]?.border||"#2a2a3e"}`, borderRadius:12, padding:"24px 28px", display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#5a5870", marginBottom:4 }}>DECISION</div>
                    <div style={{ fontSize:36, color:verdictCfg[model.verdict]?.color, fontFamily:"monospace" }}>{model.verdict}</div>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#5a5870", marginTop:2 }}>{model.confidence}% confidence</div>
                  </div>
                  <div style={{ width:1, height:60, background:"#2a2a3e", flexShrink:0 }}/>
                  <p style={{ margin:0, color:"#b8b6cc", lineHeight:1.8, fontSize:14, flex:1 }}>{model.rationale}</p>
                </div>
                <Card title="Next 5 Actions">
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {(model.nextSteps||[]).map((s,i) => (
                      <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 14px", background:"#080810", border:"1px solid #1a1a2e", borderRadius:7 }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, background:"#c9a84c18", border:"1px solid #c9a84c", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#c9a84c", fontFamily:"monospace" }}>{i+1}</div>
                        <p style={{ margin:0, color:"#9b97b0", fontSize:13, lineHeight:1.6 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            <div style={{ marginTop:40, textAlign:"center" }}>
              <button onClick={reset} style={{ background:"none", border:"1px solid #2a2a3e", borderRadius:8, color:"#5a5870", padding:"10px 24px", cursor:"pointer", fontSize:12, fontFamily:"monospace" }}>← Validate another idea</button>
            </div>
          </div>

          {/* Print layout — hidden on screen, shown on print */}
          <div className="print-all" style={{ display:"none", padding:"40px", fontFamily:"Georgia, serif", color:"#111" }}>
            <div style={{ marginBottom:32, borderBottom:"2px solid #111", paddingBottom:16 }}>
              <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:8, color:"#666" }}>Validation Model</div>
              <h1 style={{ margin:"0 0 4px", fontSize:32, fontWeight:400 }}>{model.ideaName}</h1>
              <p style={{ margin:0, color:"#666", fontStyle:"italic" }}>{model.tagline}</p>
              <div style={{ marginTop:12, display:"flex", gap:24 }}>
                <span style={{ fontFamily:"monospace", fontSize:13 }}>Score: {avg}/10</span>
                <span style={{ fontFamily:"monospace", fontSize:13 }}>Verdict: {model.verdict}</span>
                <span style={{ fontFamily:"monospace", fontSize:13 }}>Confidence: {model.confidence}%</span>
              </div>
            </div>

            <Section title="Problem">{model.problem}</Section>
            <Section title="Solution">{model.solution}</Section>
            <Section title="Differentiation">{model.differentiation}</Section>

            {model.scoring && <Matrix scoring={model.scoring} ideaName={model.ideaName} />}

            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"#999", marginBottom:12 }}>Assumptions</div>
              {[...(model.assumptions||[])].sort((a,b)=>({high:0,medium:1,low:2}[a.risk]-{high:0,medium:1,low:2}[b.risk])).map((a,i) => (
                <div key={i} style={{ borderLeft:`3px solid ${riskColor[a.risk]}`, paddingLeft:12, marginBottom:12 }}>
                  <div style={{ fontWeight:600, marginBottom:2 }}>{a.label} <span style={{ fontWeight:400, fontSize:11, color:"#999", textTransform:"uppercase" }}>({a.risk} risk)</span></div>
                  <div style={{ fontSize:13, marginBottom:2 }}>{a.assumption}</div>
                  <div style={{ fontSize:11, color:"#999" }}>Evidence: {a.evidence}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"#999", marginBottom:12 }}>Validation Steps</div>
              {(model.validationSteps||[]).map((s,i) => (
                <div key={i} style={{ marginBottom:10, paddingLeft:12, borderLeft:"2px solid #ddd" }}>
                  <div style={{ fontWeight:600 }}>{i+1}. {s.label} <span style={{ fontWeight:400, fontSize:11, color:"#999" }}>({s.effort})</span></div>
                  <div style={{ fontSize:13 }}>{s.description}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"#999", marginBottom:12 }}>Next 5 Actions</div>
              {(model.nextSteps||[]).map((s,i) => (
                <div key={i} style={{ marginBottom:6, fontSize:13 }}>{i+1}. {s}</div>
              ))}
            </div>

            <div style={{ marginTop:24, borderTop:"1px solid #ddd", paddingTop:12, fontSize:11, color:"#999" }}>
              {model.rationale}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:10, padding:"18px 22px" }}>
      <div style={{ fontSize:10, fontFamily:"monospace", letterSpacing:"0.15em", color:"#c9a84c", textTransform:"uppercase", marginBottom:12 }}>{title}</div>
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
