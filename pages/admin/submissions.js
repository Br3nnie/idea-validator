import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";

const colours = {
  processing: { bg: "#eff6ff", fg: "#1d4ed8" },
  completed: { bg: "#f0fdf4", fg: "#15803d" },
  failed: { bg: "#fef2f2", fg: "#b91c1c" },
  GO: { bg: "#f0fdf4", fg: "#15803d" },
  TEST: { bg: "#fff7ed", fg: "#b45309" },
  KILL: { bg: "#fef2f2", fg: "#b91c1c" },
};

function Pill({ value }) {
  const style = colours[value] || { bg: "#f1f5f9", fg: "#475569" };
  return <span style={{ display:"inline-block", background:style.bg, color:style.fg, borderRadius:99, padding:"5px 9px", fontSize:11, fontWeight:800, textTransform:"uppercase" }}>{value || "—"}</span>;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
}

function money(value, currency) {
  return new Intl.NumberFormat("en-GB", { style:"currency", currency, minimumFractionDigits:4, maximumFractionDigits:4 }).format(Number(value || 0));
}

function tokens(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function SubmissionsDashboard() {
  const [auth, setAuth] = useState("checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [data, setData] = useState({ submissions:[], summary:{ total:0, processing:0, completed:0, failed:0, inputTokens:0, outputTokens:0, costUsd:0, costGbp:0, averageCostGbp:0 } });
  const [filters, setFilters] = useState({ search:"", status:"", verdict:"" });
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    const query = new URLSearchParams(Object.entries(activeFilters).filter(([, value]) => value));
    try {
      const response = await fetch(`/api/admin/submissions?${query}`, { cache:"no-store" });
      if (response.status === 401) { setAuth("loggedOut"); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load submissions");
      setData(payload); setAuth("authenticated"); setError(""); setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetch("/api/admin/login", { cache:"no-store" }).then(response => response.json()).then(result => {
      if (!result.configured) { setLoginError("Dashboard password is not configured."); setAuth("loggedOut"); }
      else if (result.authenticated) load();
      else setAuth("loggedOut");
    }).catch(() => setAuth("loggedOut"));
  }, []);

  useEffect(() => {
    if (auth !== "authenticated") return;
    const timer = setInterval(() => load(), 10000);
    return () => clearInterval(timer);
  }, [auth, load]);

  const login = async event => {
    event.preventDefault(); setLoginError("");
    const response = await fetch("/api/admin/login", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ password }) });
    const result = await response.json();
    if (!response.ok) return setLoginError(result.error || "Could not sign in");
    setPassword(""); setAuth("authenticated"); load();
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method:"DELETE" });
    setData({ submissions:[], summary:{ total:0, processing:0, completed:0, failed:0, inputTokens:0, outputTokens:0, costUsd:0, costGbp:0, averageCostGbp:0 } });
    setAuth("loggedOut");
  };

  const exportCsv = () => {
    const headings = ["created_at","status","email","idea_name","verdict","average_score","confidence","loops_captured","report_email_sent","owner_notification_sent","email_error","model","input_tokens","output_tokens","cost_usd","usd_to_gbp_rate","cost_gbp","answers","result","error_message"];
    const lines = [headings.map(csvCell).join(","), ...data.submissions.map(item => headings.map(key => csvCell(typeof item[key] === "object" ? JSON.stringify(item[key]) : item[key])).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `test-my-idea-submissions-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const cards = useMemo(() => [["Total",data.summary.total],["Processing",data.summary.processing],["Completed",data.summary.completed],["Failed",data.summary.failed]], [data.summary]);
  const usageCards = useMemo(() => [
    ["Input tokens", tokens(data.summary.inputTokens)],
    ["Output tokens", tokens(data.summary.outputTokens)],
    ["Average cost / submission", money(data.summary.averageCostGbp, "GBP")],
    ["Cumulative cost", money(data.summary.costGbp, "GBP")],
    ["Cumulative cost (USD)", money(data.summary.costUsd, "USD")],
  ], [data.summary]);

  if (auth !== "authenticated") return (
    <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#f0f4f8", color:"#1a1a2e", fontFamily:"Arial,sans-serif", padding:24 }}>
      <Head><title>Submissions · Test My Idea</title></Head>
      <form onSubmit={login} style={{ width:"min(400px,100%)", background:"white", border:"1px solid #e2e8f0", borderRadius:16, padding:32, boxSizing:"border-box", boxShadow:"0 18px 50px #1a56db18" }}>
        <div style={{ color:"#1a56db", fontSize:11, fontWeight:800, letterSpacing:".14em" }}>PRIVATE ADMIN</div>
        <h1 style={{ margin:"10px 0 8px", fontSize:28 }}>Submission dashboard</h1>
        <p style={{ margin:"0 0 22px", color:"#64748b", lineHeight:1.5, fontSize:14 }}>{auth === "checking" ? "Checking your session…" : "Enter the dashboard password to continue."}</p>
        {auth !== "checking" && <><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoFocus placeholder="Dashboard password" style={{ width:"100%", boxSizing:"border-box", padding:"13px 14px", border:"1px solid #cbd5e1", borderRadius:9, fontSize:15 }} /><button style={{ width:"100%", marginTop:12, padding:13, border:0, borderRadius:9, background:"#1a56db", color:"white", fontWeight:800, cursor:"pointer" }}>Sign in</button></>}
        {loginError && <p style={{ color:"#b91c1c", fontSize:13, margin:"12px 0 0" }}>{loginError}</p>}
      </form>
    </main>
  );

  return (
    <main style={{ minHeight:"100vh", background:"#f0f4f8", color:"#1e293b", fontFamily:"Arial,sans-serif", padding:"28px clamp(16px,4vw,52px) 60px" }}>
      <Head><title>Submissions · Test My Idea</title></Head>
      <div style={{ maxWidth:1500, margin:"0 auto" }}>
        <header style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"center", flexWrap:"wrap", marginBottom:26 }}>
          <div><div style={{ color:"#1a56db", fontSize:11, fontWeight:800, letterSpacing:".14em" }}>TEST MY IDEA</div><h1 style={{ margin:"7px 0 4px", fontSize:"clamp(26px,4vw,38px)" }}>Submission dashboard</h1><div style={{ color:"#64748b", fontSize:12 }}>Updates every 10 seconds{lastUpdated ? ` · Last updated ${lastUpdated.toLocaleTimeString("en-GB")}` : ""}</div></div>
          <div style={{ display:"flex", gap:9 }}><button onClick={() => load()} style={buttonStyle}>Refresh</button><button onClick={exportCsv} style={buttonStyle}>Export CSV</button><button onClick={logout} style={buttonStyle}>Sign out</button></div>
        </header>

        <section style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:18 }}>
          {cards.map(([label,value]) => <div key={label} style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12, padding:"18px 20px" }}><div style={{ color:"#64748b", fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div><div style={{ marginTop:6, fontSize:30, fontWeight:800 }}>{value}</div></div>)}
        </section>

        <section style={{ marginBottom:18 }}>
          <div style={{ color:"#64748b", fontSize:10, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", margin:"0 0 8px 2px" }}>Claude usage and estimated cost</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            {usageCards.map(([label,value]) => <div key={label} style={{ background:"#172554", color:"white", borderRadius:12, padding:"16px 18px" }}><div style={{ color:"#bfdbfe", fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".07em" }}>{label}</div><div style={{ marginTop:7, fontSize:23, fontWeight:800 }}>{value}</div></div>)}
          </div>
          <p style={{ color:"#64748b", fontSize:10, margin:"7px 2px 0" }}>Estimated using Claude Sonnet 4.6 standard pricing ($3 input / $15 output per million tokens) and the stored USD→GBP rate.</p>
        </section>

        <section style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12, padding:14, marginBottom:14, display:"grid", gridTemplateColumns:"minmax(220px,1fr) 180px 160px", gap:10 }}>
          <input aria-label="Search" placeholder="Search email or idea name" value={filters.search} onChange={event => setFilters({ ...filters, search:event.target.value })} onKeyDown={event => event.key === "Enter" && load()} style={inputStyle} />
          <select value={filters.status} onChange={event => { const next={ ...filters, status:event.target.value }; setFilters(next); load(next); }} style={inputStyle}><option value="">All statuses</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="failed">Failed</option></select>
          <select value={filters.verdict} onChange={event => { const next={ ...filters, verdict:event.target.value }; setFilters(next); load(next); }} style={inputStyle}><option value="">All verdicts</option><option>GO</option><option>TEST</option><option>KILL</option></select>
        </section>

        {error && <div style={{ background:"#fef2f2", color:"#b91c1c", padding:14, borderRadius:9, marginBottom:12 }}>{error}</div>}
        <section style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1280 }}><thead><tr>{["Created","Submitter","Idea","Status","Verdict","Score","Tokens","Cost","Confidence","Loops","Emails",""] .map(label => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
            <tbody>{data.submissions.map(item => <SubmissionRow key={item.id} item={item} open={expanded === item.id} toggle={() => setExpanded(expanded === item.id ? null : item.id)} />)}</tbody>
          </table>
          {!data.submissions.length && <div style={{ padding:48, textAlign:"center", color:"#64748b" }}>{loading ? "Loading submissions…" : "No submissions match these filters."}</div>}
        </section>
        <p style={{ color:"#94a3b8", fontSize:11, marginTop:10 }}>Showing the newest {data.submissions.length} matching submissions (maximum 250).</p>
      </div>
      <style>{`@media(max-width:760px){section:has(> input[aria-label="Search"]){grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}

function SubmissionRow({ item, open, toggle }) {
  const answerLabels = { idea:"The Idea", user:"The User", evidence:"Evidence", competition:"Competition", monetisation:"Monetisation", blockers:"Biggest Fear" };
  return <>
    <tr style={{ borderTop:"1px solid #e2e8f0" }}><td style={tdStyle}>{formatDate(item.created_at)}</td><td style={tdStyle}>{item.email}</td><td style={{ ...tdStyle, fontWeight:700 }}>{item.idea_name || "Pending…"}</td><td style={tdStyle}><Pill value={item.status} /></td><td style={tdStyle}><Pill value={item.verdict} /></td><td style={tdStyle}>{item.average_score == null ? "—" : `${item.average_score}/10`}</td><td style={tdStyle}>{tokens(Number(item.input_tokens || 0) + Number(item.output_tokens || 0))}</td><td style={{ ...tdStyle, fontWeight:700 }}>{money(item.cost_gbp, "GBP")}</td><td style={tdStyle}>{item.confidence == null ? "—" : `${item.confidence}%`}</td><td style={tdStyle}>{item.loops_captured ? "Yes" : "No"}</td><td style={tdStyle}><span title={item.email_error || ""} style={{ color:item.report_email_sent && item.owner_notification_sent ? "#15803d" : "#b45309", fontWeight:800 }}>{item.report_email_sent && item.owner_notification_sent ? "2/2 sent" : `${Number(item.report_email_sent)+Number(item.owner_notification_sent)}/2 sent`}</span></td><td style={tdStyle}><button onClick={toggle} style={{ ...buttonStyle, color:"#1a56db" }}>{open ? "Close" : "View"}</button></td></tr>
    {open && <tr><td colSpan="12" style={{ padding:0, background:"#f8fafc", borderTop:"1px solid #e2e8f0" }}><div style={{ padding:22, display:"grid", gridTemplateColumns:"minmax(280px,1fr) minmax(320px,1.4fr)", gap:24 }}>
      <div><h3 style={detailHeading}>Submitted answers</h3>{Object.entries(answerLabels).map(([key,label]) => <div key={key} style={{ marginBottom:15 }}><div style={detailLabel}>{label}</div><div style={detailText}>{item.answers?.[key] || "—"}</div></div>)}</div>
      <div><h3 style={detailHeading}>Generated report</h3><div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}><Pill value={item.model || "No usage data"} /><span style={metricChip}>{tokens(item.input_tokens)} input</span><span style={metricChip}>{tokens(item.output_tokens)} output</span><span style={metricChip}>{money(item.cost_usd,"USD")}</span><span style={metricChip}>{money(item.cost_gbp,"GBP")}</span><span style={metricChip}>FX {Number(item.usd_to_gbp_rate || 0).toFixed(4)}</span><span style={metricChip}>Report email: {item.report_email_sent ? "sent" : "not sent"}</span><span style={metricChip}>Owner email: {item.owner_notification_sent ? "sent" : "not sent"}</span></div>{item.email_error && <div style={{ padding:12, background:"#fff7ed", color:"#b45309", borderRadius:8, marginBottom:12 }}>Email: {item.email_error}</div>}{item.error_message && <div style={{ padding:12, background:"#fef2f2", color:"#b91c1c", borderRadius:8, marginBottom:12 }}>{item.error_message}</div>}<pre style={{ margin:0, whiteSpace:"pre-wrap", overflowWrap:"anywhere", background:"white", border:"1px solid #e2e8f0", borderRadius:9, padding:16, fontSize:12, lineHeight:1.55, maxHeight:620, overflow:"auto" }}>{item.result ? JSON.stringify(item.result, null, 2) : "Report not completed yet."}</pre></div>
    </div></td></tr>}
  </>;
}

const buttonStyle = { background:"white", border:"1px solid #cbd5e1", borderRadius:8, color:"#475569", padding:"9px 12px", cursor:"pointer", fontWeight:700, fontSize:12 };
const inputStyle = { width:"100%", boxSizing:"border-box", border:"1px solid #cbd5e1", borderRadius:8, padding:"11px 12px", background:"white", color:"#1e293b", fontSize:13 };
const thStyle = { textAlign:"left", padding:"12px 14px", color:"#64748b", fontSize:10, letterSpacing:".08em", textTransform:"uppercase", whiteSpace:"nowrap" };
const tdStyle = { padding:"13px 14px", fontSize:12, verticalAlign:"middle", whiteSpace:"nowrap" };
const detailHeading = { margin:"0 0 16px", color:"#1a1a2e", fontSize:17 };
const detailLabel = { color:"#64748b", fontSize:10, fontWeight:800, letterSpacing:".08em", textTransform:"uppercase", marginBottom:4 };
const detailText = { color:"#334155", fontSize:13, lineHeight:1.55, whiteSpace:"pre-wrap" };
const metricChip = { background:"#e2e8f0", color:"#334155", borderRadius:99, padding:"5px 8px", fontSize:10, fontWeight:700 };
