import { useState, useRef, useEffect } from "react";

const STEPS = [
  { id: "idea", label: "The Idea", question: "Describe your idea in plain language. What is it, who is it for, and what problem does it solve?" },
  { id: "user", label: "The User", question: "Who feels this pain most? Be specific — age, situation, context. Solo user or shared (e.g. couples, teams)?" },
  { id: "evidence", label: "Your Evidence", question: "What evidence do you have that this problem is real? Lived it, heard complaints, or a hunch?" },
  { id: "competition", label: "Competition", question: "What do people do today to solve this? Any apps, tools, or workarounds? What's missing?" },
  { id: "monetisation", label: "Monetisation", question: "How would this make money? One-off, subscription, freemium, B2B? Price instinct?" },
  { id: "blockers", label: "Biggest Fear", question: "What's the one thing that would kill this idea? What are you most uncertain about?" },
];

const riskColor = { low: "#4ade80", medium: "#fbbf24", high: "#f87171" };
const riskBg   = { low: "#052e16", medium: "#1c1008", high: "#1c0606" };
const verdictCfg = {
  GO:   { color: "#4ade80", bg: "#052e16", border: "#4ade80" },
  TEST: { color: "#fbbf24", bg: "#1c1008", border: "#fbbf24" },
  KILL: { color: "#f87171", bg: "#1c0606", border: "#f87171" },
};

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

export default function IdeaValidator() {
  const [phase, setPhase]               = useState("intro");
  const [step, setStep]                 = useState(0);
  const [answers, setAnswers]           = useState({});
  const [answer, setAnswer]             = useState("");
  const [model, setModel]               = useState(null);
  const [tab, setTab]                   = useState("overview");
  const [error, setError]               = useState(null);
  const [status, setStatus]             = useState("");
  const ref = useRef(null);

  useEffect(() => { if (phase === "intake") ref.current?.focus(); }, [phase, step]);

  const next = () => {
    const updated = { ...answers, [STEPS[step].id]: answer.trim() };
    setAnswers(updated);
    setAnswer("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else generate(updated);
  };

  const keyDown = e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim().length > 10) next(); };

  const generate = async (a) => {
    setPhase("generating"); setError(null);
    const ctx = STEPS.map(s => `${s.label}: ${a[s.id]}`).join("\n");

    try {
      setStatus("Analysing the idea...");
      const overview = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with keys: ideaName, tagline, problem, solution, differentiation. Short strings only.`);

      setStatus("Mapping assumptions...");
      const part2 = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with:\n"assumptions": array of 4 objects {label,assumption,risk("low"|"medium"|"high"),evidence}\n"validationSteps": array of 4 objects {label,description,effort,priority("high"|"medium")}`);

      setStatus("Reaching verdict...");
      const part3 = await callAPI(`You are a startup validator. Given:\n\n${ctx}\n\nReturn ONLY JSON with:\n"scoring": array of 6 objects {name,score(1-10),note} — names: "Problem clarity","Market size","Differentiation","Technical feasibility","Monetisation fit","Speed to test"\n"verdict": "GO"|"TEST"|"KILL"\n"confidence": integer 1-100\n"rationale": 2 sentence string\n"nextSteps": array of 5 action strings`);

      setModel({ ...overview, ...part2, ...part3 });
      setPhase("results"); setTab("overview");
    } catch (err) {
      setError(err.message);
      setPhase("intake"); setStep(STEPS.length - 1);
    }
  };

  const reset = () => { setPhase("intro"); setStep(0); setAnswers({}); setAnswer(""); setModel(null); setError(null); setStatus(""); };

  const avg = model?.scoring ? Math.round(model.scoring.reduce((s,c) => s+c.score,0)/model.scoring.length) : 0;

  const S = { minH: "100vh", bg: "#080810", color: "#ddd9cc", font: "'Palatino Linotype',Palatino,serif" };

  return (
    <div style={{ minHeight: S.minH, background: S.bg, color: S.color, fontFamily: S.font }}>

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

      {phase === "intake" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", padding:"40px 24px", maxWidth:680, margin:"0 auto" }}>
          <div style={{ display:"flex", gap:6, marginBottom:48 }}>
            {STEPS.map((_,i) => <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i<step?"#c9a84c":i===step?"#c9a84c88":"#1a1a2e", transition:"background 0.3s" }}/>)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontFamily:"monospace", color:"#c9a84c", letterSpacing:"0.15em", marginBottom:12 }}>{step+1} of {STEPS.length} — {STEPS[step].label}</div>
            <h2 style={{ margin:"0 0 32px", fontSize:22, fontWeight:400, color:"#f0ede6", lineHeight:1.4 }}>{STEPS[step].question}</h2>
            <textarea ref={ref} value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={keyDown} placeholder="Type your answer..." rows={6}
              style={{ width:"100%", background:"#0f0f1a", border:"1px solid #2a2a3e", borderRadius:10, padding:"16px 18px", color:"#ddd9cc", fontSize:15, fontFamily:"inherit", lineHeight:1.7, resize:"vertical", outline:"none", boxSizing:"border-box" }}/>
            <p style={{ margin:"8px 0 0", fontSize:11, color:"#3a3850", fontFamily:"monospace" }}>⌘+Enter to continue</p>
          </div>
          {error && <div style={{ color:"#f87171", fontSize:12, marginBottom:16, fontFamily:"monospace", background:"#1c0606", padding:"10px 14px", borderRadius:6, wordBreak:"break-word" }}>{error}</div>}
          <div style={{ display:"flex", justifyContent:"space-between", paddingTop:24 }}>
            <button onClick={() => { if(step===0) reset(); else { setStep(step-1); setAnswer(answers[STEPS[step-1].id]||""); }}}
              style={{ background:"none", border:"1px solid #2a2a3e", borderRadius:8, color:"#6b6b8a", padding:"10px 20px", cursor:"pointer", fontSize:13, fontFamily:"monospace" }}>← Back</button>
            <button onClick={next} disabled={answer.trim().length<10}
              style={{ background:answer.trim().length>=10?"#c9a84c":"#1a1a2e", color:answer.trim().length>=10?"#080810":"#3a3850", border:"none", borderRadius:8, padding:"12px 28px", cursor:answer.trim().length>=10?"pointer":"default", fontSize:14, fontFamily:"inherit", transition:"all 0.2s" }}>
              {step===STEPS.length-1?"Generate Model →":"Next →"}
            </button>
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:40 }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width:48, height:48, border:"1px solid #c9a84c44", borderTop:"1px solid #c9a84c", borderRadius:"50%", animation:"spin 1s linear infinite", marginBottom:32 }}/>
          <p style={{ color:"#9b97b0", fontSize:16, margin:0 }}>{status||"Building your validation model..."}</p>
          <p style={{ color:"#3a3850", fontSize:12, margin:"8px 0 0", fontFamily:"monospace" }}>3 analysis passes · ~15–30 seconds</p>
        </div>
      )}

      {phase === "results" && model && (
        <div>
          <div style={{ borderBottom:"1px solid #1a1a2e", padding:"28px 32px 20px", background:"#0a0a12" }}>
            <div style={{ maxWidth:860, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:"monospace", color:"#5a5870", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>Validation Model</div>
                <h1 style={{ margin:0, fontSize:32, fontWeight:400, color:"#f0ede6" }}>{model.ideaName}</h1>
                <p style={{ margin:"6px 0 0", color:"#7b79a0", fontSize:14, fontStyle:"italic" }}>{model.tagline}</p>
              </div>
              <div style={{ display:"flex", gap:12 }}>
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
              </div>
            </div>
          </div>

          <div style={{ borderBottom:"1px solid #1a1a2e", padding:"0 32px" }}>
            <div style={{ maxWidth:860, margin:"0 auto", display:"flex" }}>
              {["overview","assumptions","steps","scoring","verdict"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ background:"none", border:"none", borderBottom:tab===t?"2px solid #c9a84c":"2px solid transparent", color:tab===t?"#c9a84c":"#5a5870", padding:"12px 16px", cursor:"pointer", fontSize:12, fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase" }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ maxWidth:860, margin:"0 auto", padding:32 }}>
            {tab === "overview" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[["Problem",model.problem],["Solution",model.solution],["Differentiation",model.differentiation]].map(([t,v]) => (
                  <Card key={t} title={t}><p style={{ margin:0, lineHeight:1.8, color:"#b8b6cc", fontSize:14 }}>{v}</p></Card>
                ))}
              </div>
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
