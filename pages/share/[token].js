import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SharedReport() {
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!router.isReady) return;
    fetch(`/api/shared/${encodeURIComponent(router.query.token)}`, { cache:"no-store" }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load report");
      setReport(payload);
    }).catch(loadError => setError(loadError.message));
  }, [router.isReady, router.query.token]);

  if (!report) return <main style={pageStyle}><Head><title>Shared report · Test My Idea</title><meta name="robots" content="noindex,nofollow" /></Head><div style={cardStyle}>{error || "Loading private report…"}</div></main>;
  const model = report.result;
  return <main style={pageStyle}><Head><title>{model.ideaName} · Test My Idea</title><meta name="robots" content="noindex,nofollow" /></Head><article style={{ ...cardStyle, maxWidth:900 }}>
    <div style={{ color:"#1a56db", fontSize:11, fontWeight:800, letterSpacing:".14em" }}>SHARED TEST MY IDEA REPORT</div>
    <h1 style={{ color:"#1a1a2e", fontSize:"clamp(34px,6vw,58px)", margin:"12px 0 6px" }}>{model.ideaName}</h1><p style={{ color:"#64748b", fontSize:18 }}>{model.tagline}</p>
    <div style={{ display:"flex", gap:12, margin:"24px 0", flexWrap:"wrap" }}><strong style={chipStyle}>{model.verdict}</strong><span style={chipStyle}>{report.average_score}/10</span><span style={chipStyle}>{model.confidence}% confidence</span><span style={chipStyle}>{model.evidenceStrength?.level || "Unrated"} evidence</span></div>
    <h2>Decision</h2><p style={copyStyle}>{model.rationale}</p>
    <h2>What would change it</h2><p style={copyStyle}>{model.evidenceStrength?.wouldChangeVerdict}</p>
    <h2>Critical assumptions</h2>{model.assumptions?.map((item,index) => <div key={index} style={sectionStyle}><strong>{item.label} · {item.risk} risk</strong><p style={copyStyle}>{item.assumption}</p></div>)}
    <h2>Validation plan</h2>{model.validationSteps?.map((item,index) => <div key={index} style={sectionStyle}><strong>{index + 1}. {item.label}</strong><p style={copyStyle}>{item.description}</p></div>)}
    <p style={{ color:"#94a3b8", fontSize:11, marginTop:32 }}>Private link expires {new Date(report.expires_at).toLocaleDateString("en-GB")}. Submitter email and metadata are never shown.</p>
  </article></main>;
}

const pageStyle = { minHeight:"100vh", background:"#f0f4f8", padding:"32px 18px", fontFamily:"Arial,sans-serif", color:"#334155" };
const cardStyle = { maxWidth:520, margin:"0 auto", background:"white", border:"1px solid #e2e8f0", borderRadius:14, padding:"clamp(24px,5vw,48px)" };
const chipStyle = { background:"#eff6ff", color:"#1a56db", borderRadius:99, padding:"8px 12px", fontSize:12 };
const copyStyle = { color:"#475569", lineHeight:1.65 };
const sectionStyle = { borderTop:"1px solid #e2e8f0", padding:"14px 0" };
