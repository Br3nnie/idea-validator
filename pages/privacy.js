import Head from "next/head";
import Link from "next/link";

export default function Privacy() {
  return <main style={{ minHeight:"100vh", background:"#f0f4f8", color:"#334155", fontFamily:"Arial,sans-serif", padding:"48px 20px" }}>
    <Head><title>Privacy · Test My Idea</title><meta name="robots" content="index,follow" /></Head>
    <article style={{ maxWidth:760, margin:"0 auto", background:"white", border:"1px solid #e2e8f0", borderRadius:14, padding:"clamp(24px,5vw,48px)", lineHeight:1.65 }}>
      <Link href="/" style={{ color:"#1a56db" }}>← Test My Idea</Link>
      <h1 style={{ color:"#1a1a2e" }}>Privacy notice</h1>
      <p><strong>Last updated:</strong> 5 September 2026</p>
      <p>When you request a report, Test My Idea processes your email address, six answers, generated report, basic request metadata, delivery status and AI usage information. We use this information to provide and improve the service, deliver your report, prevent abuse and monitor operating costs.</p>
      <p>Your answers are sent to Anthropic to generate the assessment, stored in Neon Postgres, and your email and report are sent to Loops for delivery. If you separately select the optional updates checkbox, your address may also be added to the Test My Idea mailing list.</p>
      <h2>Retention and your choices</h2>
      <p>Submission records are retained for up to 365 days by default, unless they must be kept longer for security or legal reasons. You may request access, correction or deletion by emailing <a href="mailto:brendan@corbelle.ai">brendan@corbelle.ai</a>. You can unsubscribe from optional marketing using the link in those emails.</p>
      <h2>Please avoid sensitive information</h2>
      <p>Do not submit passwords, payment details, health information, confidential client data or trade secrets. The report is automated guidance, not legal, financial or investment advice.</p>
    </article>
  </main>;
}
