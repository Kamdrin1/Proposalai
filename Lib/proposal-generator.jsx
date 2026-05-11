import { useState, useMemo } from "react";

const TRADES = [
  "Auto Detailing","Auto Repair","Roofing","Landscaping","HVAC",
  "Plumbing","Electrical","Painting","Flooring","General Contracting",
  "Pressure Washing","Fencing","Concrete","Carpentry","Other"
];

const TRADE_CONTEXT = {
  "Auto Detailing": { payment: "Full payment due at vehicle pickup", extra: "All surfaces inspected with client before and after service" },
  "Auto Repair":    { payment: "Full payment due upon vehicle pickup", extra: "30-day warranty on all labor performed" },
  "Roofing":        { payment: "40% deposit to begin, balance due upon completion", extra: "All work warranted against defects for 2 years" },
  "Landscaping":    { payment: "50% deposit to begin, balance due upon completion", extra: "Client responsible for marking irrigation lines before work begins" },
  "HVAC":           { payment: "Full payment due upon job completion", extra: "90-day warranty on all parts and labor" },
  "Plumbing":       { payment: "Full payment due upon job completion", extra: "30-day warranty on all labor; parts covered by manufacturer warranty" },
  "Electrical":     { payment: "50% deposit to begin, balance due upon completion", extra: "All work performed to local code; permit pulled if required" },
  "Painting":       { payment: "30% deposit for materials, balance due upon completion", extra: "Client to remove fragile items and wall decor before crew arrives" },
  "Flooring":       { payment: "50% deposit for materials, balance due upon completion", extra: "Existing flooring removal included unless otherwise noted" },
  "General Contracting": { payment: "Draws per project milestone as outlined above", extra: "All subcontractors licensed and insured" },
  "Pressure Washing": { payment: "Full payment due upon completion", extra: "Client to move vehicles and fragile items from work area" },
  "Fencing":        { payment: "50% deposit to begin, balance due upon completion", extra: "Client responsible for property line verification before installation" },
  "Concrete":       { payment: "50% deposit to begin, balance due upon completion", extra: "Curing time 7 days minimum; no heavy loads during cure period" },
  "Carpentry":      { payment: "50% deposit to begin, balance due upon completion", extra: "Custom work is non-refundable once fabrication begins" },
  "Other":          { payment: "50% deposit to begin, balance due upon completion", extra: "Any changes to scope must be agreed upon in writing" },
};

const STATUS = {
  ready:    { label: "Ready",    color: "#34d399" },
  sent:     { label: "Sent",     color: "#f59e0b" },
  accepted: { label: "Accepted", color: "#60a5fa" },
  declined: { label: "Declined", color: "#f87171" },
};

const Field = ({ label, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    <label style={{ fontSize:12, color:"var(--muted)", fontWeight:500, letterSpacing:"0.02em" }}>{label}</label>
    {children}
  </div>
);

const inp = {
  width:"100%", padding:"9px 12px", borderRadius:8,
  border:"1px solid var(--border)", background:"var(--inp)",
  color:"var(--text)", fontSize:14, outline:"none",
  boxSizing:"border-box", fontFamily:"inherit",
};

const btn = (accent, extra={}) => ({
  padding:"9px 18px", borderRadius:8, cursor:"pointer",
  fontFamily:"inherit", fontSize:13, fontWeight:500,
  background: accent ? "var(--accent)" : "var(--surface)",
  color: accent ? "#000" : "var(--muted)",
  border: accent ? "none" : "1px solid var(--border)",
  ...extra,
});

const BLANK_LINES = () => [{ id:1, desc:"", amount:"" }, { id:2, desc:"", amount:"" }];

export default function ProposalApp() {
  const [view,  setView]  = useState("form");
  const [step,  setStep]  = useState(1);
  const [biz,   setBiz]   = useState({ name:"", owner:"", trade:"", phone:"", email:"" });
  const [job,   setJob]   = useState({ clientName:"", clientEmail:"", description:"", timeline:"" });
  const [lineItems, setLineItems] = useState(BLANK_LINES());
  const [nextId, setNextId]       = useState(3);
  const [proposals, setProposals] = useState([]);
  const [activeProposal, setActiveProposal] = useState(null);
  const [proposalCount, setProposalCount]   = useState(0);
  const [proposal, setProposal] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState(false);

  // useMemo for all derived values
  const lineTotal = useMemo(() =>
    lineItems.reduce((sum, item) => {
      const n = parseFloat(item.amount.replace(/[^0-9.]/g, ""));
      return sum + (isNaN(n) ? 0 : n);
    }, 0), [lineItems]);

  const formatTotal = useMemo(() =>
    lineTotal > 0 ? `$${lineTotal.toFixed(2)}` : "$0.00", [lineTotal]);

  const lineItemsForPrompt = useMemo(() =>
    lineItems.filter(i => i.desc || i.amount)
             .map(i => `${i.desc || "Item"}: ${i.amount || "TBD"}`)
             .join("\n"), [lineItems]);

  const ctx = useMemo(() => TRADE_CONTEXT[biz.trade] || TRADE_CONTEXT["Other"], [biz.trade]);

  const systemPrompt = useMemo(() =>
`You are a professional proposal writer for trade and service businesses. Write concise, professional proposals that win jobs — confident and clear, not stuffy. This proposal is for a ${biz.trade || "trade"} business.

Use this exact format:

PROJECT PROPOSAL
[Business Name] · [Date]
────────────────────────────

PREPARED FOR
[Client name]
[Client email if provided]

PROJECT OVERVIEW
[2-3 sentences summarizing the job for ${biz.trade || "this trade"}]

SCOPE OF WORK
• [specific bullet]
• [specific bullet]
• [specific bullet]

INVESTMENT
[CRITICAL: Copy every line item EXACTLY as provided — do not rename, reorder, combine, or replace. List each with its amount, then a divider, then the total.]

ESTIMATED TIMELINE
[Timeline]

TERMS
• ${ctx.payment}
• ${ctx.extra}
• Any work outside the agreed scope requires a written change order

────────────────────────────
[Owner name]
[Business name]
[Phone if provided] · [Email if provided]

Under 400 words. No fluff.`, [biz.trade, ctx]);

  // Line item helpers
  const addLineItem    = () => { setLineItems(p => [...p, { id:nextId, desc:"", amount:"" }]); setNextId(n => n+1); };
  const removeLineItem = id => { if (lineItems.length <= 1) return; setLineItems(p => p.filter(i => i.id !== id)); };
  const updateLineItem = (id, field, val) => setLineItems(p => p.map(i => i.id === id ? {...i, [field]:val} : i));

  // Generate
  const generate = async () => {
    if (!job.clientName || !job.description || lineItems.filter(i => i.desc || i.amount).length === 0) {
      setError("Please fill in client name, job description, and at least one price line item."); return;
    }
    setError(""); setLoading(true); setStep(3);
    const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role:"user", content:
`Business: ${biz.name}\nOwner: ${biz.owner}\nTrade: ${biz.trade}\nPhone: ${biz.phone||"N/A"}\nEmail: ${biz.email||"N/A"}\nDate: ${today}\n\nClient: ${job.clientName}\nClient email: ${job.clientEmail||"N/A"}\nJob description: ${job.description}\nTimeline: ${job.timeline||"To be confirmed"}\n\nINVESTMENT LINE ITEMS (copy verbatim — do not change names):\n${lineItemsForPrompt}\n─────────────────\nTotal: ${formatTotal}` }]
        })
      });
      const data = await res.json();
      if (data.error) {
        const msg = data.error.type === "overloaded_error" ? "Claude is overloaded. Wait a moment and try again."
          : data.error.type === "rate_limit_error" ? "Rate limit hit. Please wait a few seconds."
          : `API error: ${data.error.message}`;
        throw new Error(msg);
      }
      const text = data.content[0].text;
      setProposal(text);
      setProposalCount(c => c+1);
      setProposals(prev => [{
        id: Date.now(), clientName: job.clientName, clientEmail: job.clientEmail,
        bizName: biz.name, trade: biz.trade, total: formatTotal,
        createdAt: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
        status: "ready", output: text,
      }, ...prev]);
    } catch(e) {
      setProposal("");
      setError(e.message.includes("fetch") ? "Network error — check your connection." : e.message || "Something went wrong.");
    }
    setLoading(false);
  };

  const copy = () => { navigator.clipboard.writeText(proposal); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const resetForNew = () => { setProposal(""); setError(""); setJob({ clientName:"", clientEmail:"", description:"", timeline:"" }); setLineItems(BLANK_LINES()); setNextId(3); setStep(2); };
  const updateStatus = (id, status) => setProposals(p => p.map(prop => prop.id === id ? {...prop, status} : prop));

  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:22 }}>
      {[1,2].map(n => <div key={n} style={{ height:3, width:32, borderRadius:2, background: step>=n ? "var(--accent)" : "var(--border)", transition:"background 0.2s" }} />)}
      <span style={{ fontSize:12, color:"var(--muted)", marginLeft:4 }}>
        {step===1 ? "Step 1 of 2 — Business profile" : step===2 ? "Step 2 of 2 — Job details" : "Generating..."}
      </span>
    </div>
  );

  const css = `
    :root { --bg:#0f1117; --surface:#1a1d27; --border:#2a2d3a; --text:#e8e9ed; --muted:#8b8fa8; --accent:#f59e0b; --acdim:#92400e22; --inp:#13151f; --success:#34d399; --error:#f87171; }
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body { background:#070911; color:var(--text); font-family:'DM Sans',system-ui,sans-serif; }
    input, select, textarea { transition:border-color 0.15s; }
    input:focus, select:focus, textarea:focus { border-color:var(--accent) !important; outline:none; }
    input::placeholder, textarea::placeholder { color:var(--muted); opacity:0.55; }
    select option { background:#1a1d27; color:#e8e9ed; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .lp-outer { display:flex; flex-direction:column; align-items:center; padding:32px 16px 0; min-height:100vh; }
    .lp-lid   { width:100%; max-width:860px; background:#1c202e; border-radius:14px 14px 0 0; border:1.5px solid #2d3248; border-bottom:none; padding:12px 12px 0; box-shadow:0 0 0 1px #0d0f1a,0 40px 100px rgba(0,0,0,.7); }
    .lp-cambar{ height:22px; display:flex; align-items:center; justify-content:center; }
    .lp-cam   { width:7px; height:7px; border-radius:50%; background:#363952; box-shadow:0 0 0 1px #252840; }
    .lp-screen{ background:var(--bg); border-radius:4px 4px 0 0; height:580px; overflow-y:auto; }
    .lp-screen::-webkit-scrollbar { width:5px; }
    .lp-screen::-webkit-scrollbar-track { background:transparent; }
    .lp-screen::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
    .lp-base  { width:100%; max-width:900px; background:#171b2c; border-radius:0 0 18px 18px; border:1.5px solid #2d3248; border-top:2px solid #0a0c16; height:68px; display:flex; align-items:center; justify-content:center; box-shadow:0 24px 60px rgba(0,0,0,.5); }
    .lp-pad   { width:150px; height:40px; border-radius:7px; border:1px solid #2d3248; background:#1c202e; }

    @media (max-width:680px) {
      body { background:var(--bg); }
      .lp-outer { padding:0; }
      .lp-lid { max-width:100%; border-radius:0; border:none; padding:0; box-shadow:none; }
      .lp-cambar, .lp-base { display:none; }
      .lp-screen { height:auto; min-height:100vh; border-radius:0; overflow-y:visible; }
    }

    .li-grid { display:grid; grid-template-columns:1fr 90px 30px; }
    @media (max-width:420px) { .li-grid { grid-template-columns:1fr 72px 28px; } }

    select.ssel { padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid var(--border); background:var(--surface); color:var(--text); cursor:pointer; font-family:inherit; }
  `;

  const AppContent = () => (
    <div style={{ padding:"26px 28px 40px" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:6, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>✦</div>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--accent)", letterSpacing:"0.09em", textTransform:"uppercase" }}>ProposalAI</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {["form","history"].map(v => (
            <button key={v} onClick={() => { setView(v); setActiveProposal(null); }} style={{ ...btn(false), padding:"6px 13px", fontSize:12, background: view===v ? "var(--surface)" : "transparent", border: view===v ? "1px solid var(--border)" : "1px solid transparent", color: view===v ? "var(--text)" : "var(--muted)" }}>
              {v === "form" ? "New proposal" : `History${proposals.length ? ` (${proposals.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* ══ FORM VIEW ══════════════════════════════════════════════════════ */}
      {view === "form" && (
        <>
          <div style={{ marginBottom:20 }}>
            <h1 style={{ fontSize:21, fontWeight:600, marginBottom:3 }}>
              {step===3 ? (loading ? "Writing your proposal..." : "Your proposal is ready") : "Generate a proposal"}
            </h1>
            <p style={{ fontSize:13, color:"var(--muted)" }}>
              {step===1 ? "Set up your business info once — it auto-fills every proposal."
               : step===2 ? "Client and job details for this proposal."
               : loading ? "Give it a few seconds..." : "Copy and send directly to your client."}
            </p>
          </div>
          {step < 3 && <StepBar />}

          {/* Step 1 — Business */}
          {step === 1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                <Field label="Business name"><input style={inp} placeholder="Kam's Auto Detail" value={biz.name} onChange={e => setBiz({...biz, name:e.target.value})} /></Field>
                <Field label="Your name"><input style={inp} placeholder="Kam" value={biz.owner} onChange={e => setBiz({...biz, owner:e.target.value})} /></Field>
              </div>
              <Field label="Trade / service type">
                <select style={inp} value={biz.trade} onChange={e => setBiz({...biz, trade:e.target.value})}>
                  <option value="">Select your trade...</option>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                <Field label="Phone"><input style={inp} placeholder="(208) 555-0100" value={biz.phone} onChange={e => setBiz({...biz, phone:e.target.value})} /></Field>
                <Field label="Email"><input style={inp} type="email" placeholder="you@business.com" value={biz.email} onChange={e => setBiz({...biz, email:e.target.value})} /></Field>
              </div>
              {error && <p style={{ fontSize:12, color:"var(--error)" }}>{error}</p>}
              <button style={{ ...btn(true), marginTop:4, width:"100%" }} onClick={() => {
                if (!biz.name || !biz.owner || !biz.trade) { setError("Please fill in business name, your name, and trade type."); return; }
                setError(""); setStep(2);
              }}>Continue →</button>
            </div>
          )}

          {/* Step 2 — Job */}
          {step === 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                <Field label="Client name"><input style={inp} placeholder="John Smith" value={job.clientName} onChange={e => setJob({...job, clientName:e.target.value})} /></Field>
                <Field label="Client email"><input style={inp} type="email" placeholder="client@email.com" value={job.clientEmail} onChange={e => setJob({...job, clientEmail:e.target.value})} /></Field>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <label style={{ fontSize:12, color:"var(--muted)", fontWeight:500 }}>Job description</label>
                <textarea style={{ ...inp, resize:"vertical", lineHeight:1.6 }} rows={4}
                  placeholder="Describe the work — scope, materials, any specifics..."
                  value={job.description} onChange={e => setJob({...job, description:e.target.value})} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                  <span style={{ fontSize:11, color:"var(--muted)", opacity:.7 }}>More detail = better proposal. Include size, condition, materials, specifics.</span>
                  <span style={{ fontSize:11, flexShrink:0, marginLeft:8, color: job.description.length > 40 ? "var(--success)" : "var(--muted)" }}>{job.description.length} chars</span>
                </div>
              </div>

              {/* Line items */}
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <label style={{ fontSize:12, color:"var(--muted)", fontWeight:500 }}>Price breakdown</label>
                <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                  <div className="li-grid">
                    <div style={{ padding:"6px 10px", fontSize:11, color:"var(--muted)", borderBottom:"1px solid var(--border)", fontWeight:500 }}>Item</div>
                    <div style={{ padding:"6px 10px", fontSize:11, color:"var(--muted)", borderBottom:"1px solid var(--border)", borderLeft:"1px solid var(--border)", fontWeight:500 }}>Amount</div>
                    <div style={{ borderBottom:"1px solid var(--border)", background:"var(--inp)" }} />
                  </div>
                  {lineItems.map((item, i) => (
                    <div key={item.id} className="li-grid" style={{ borderBottom: i < lineItems.length-1 ? "1px solid var(--border)" : "none" }}>
                      <input style={{ ...inp, borderRadius:0, border:"none", borderRight:"1px solid var(--border)", fontSize:13 }}
                        placeholder={i===0 ? "e.g. Labor" : i===1 ? "e.g. Materials" : "Item description"}
                        value={item.desc} onChange={e => updateLineItem(item.id, "desc", e.target.value)} />
                      <input style={{ ...inp, borderRadius:0, border:"none", borderRight:"1px solid var(--border)", fontSize:13 }}
                        placeholder="$0.00" value={item.amount} onChange={e => updateLineItem(item.id, "amount", e.target.value)} />
                      <button onClick={() => removeLineItem(item.id)} style={{ background:"var(--inp)", border:"none", cursor: lineItems.length<=1 ? "not-allowed" : "pointer", color: lineItems.length<=1 ? "var(--border)" : "var(--muted)", fontSize:16 }}>×</button>
                    </div>
                  ))}
                  <div className="li-grid" style={{ borderTop:"1px solid var(--border)", background:"var(--inp)" }}>
                    <button onClick={addLineItem} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--accent)", fontSize:12, padding:"8px 10px", textAlign:"left", fontFamily:"inherit" }}>+ Add line</button>
                    <div style={{ padding:"8px 10px", fontSize:13, fontWeight:600, color:"var(--text)", borderLeft:"1px solid var(--border)" }}>{formatTotal}</div>
                    <div />
                  </div>
                </div>
              </div>

              <Field label="Estimated timeline">
                <input style={inp} placeholder="2–3 days" value={job.timeline} onChange={e => setJob({...job, timeline:e.target.value})} />
              </Field>

              {proposalCount < 3 ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:8, background:"var(--acdim)", border:"1px solid #f59e0b33" }}>
                  <span style={{ fontSize:13, color:"var(--accent)" }}>{3 - proposalCount} of 3 free proposals remaining</span>
                  <span style={{ fontSize:11, color:"var(--muted)" }}>Upgrade for unlimited</span>
                </div>
              ) : (
                <div style={{ padding:"10px 14px", borderRadius:8, background:"#f871711a", border:"1px solid #f8717133", textAlign:"center" }}>
                  <span style={{ fontSize:13, color:"var(--error)" }}>You've used all 3 free proposals. </span>
                  <span style={{ fontSize:13, color:"var(--accent)", cursor:"pointer", fontWeight:500 }}>Upgrade to continue →</span>
                </div>
              )}

              {error && <p style={{ fontSize:12, color:"var(--error)" }}>{error}</p>}
              <div style={{ display:"flex", gap:8 }}>
                <button style={btn(false)} onClick={() => { setError(""); setStep(1); }}>← Back</button>
                <button style={{ ...btn(true), flex:1 }} onClick={generate} disabled={proposalCount >= 3}>Generate proposal →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Output */}
          {step === 3 && (
            <div>
              {loading ? (
                <div style={{ textAlign:"center", padding:"70px 0" }}>
                  <div style={{ fontSize:26, marginBottom:12, animation:"spin 1s linear infinite", display:"inline-block", color:"var(--accent)" }}>⟳</div>
                  <p style={{ color:"var(--muted)", fontSize:14 }}>Generating your proposal...</p>
                </div>
              ) : error ? (
                <div style={{ textAlign:"center", padding:"40px 0" }}>
                  <p style={{ color:"var(--error)", marginBottom:16, fontSize:14 }}>{error}</p>
                  <button style={btn(false)} onClick={() => { setError(""); setStep(2); }}>← Go back</button>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
                    <span style={{ fontSize:13, color:"var(--success)", fontWeight:500 }}>✓ Ready to send</span>
                    <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                      <button style={btn(false)} onClick={copy}>{copied ? "✓ Copied" : "Copy text"}</button>
                      <button style={btn(false)} onClick={() => { setProposal(""); setError(""); setLoading(true); generate(); }}>↺ Regenerate</button>
                      <button style={btn(false)} onClick={resetForNew}>New proposal</button>
                      <button style={btn(false)} onClick={() => setView("history")}>History →</button>
                    </div>
                  </div>
                  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"18px 22px", fontFamily:"monospace", fontSize:12.5, lineHeight:1.85, whiteSpace:"pre-wrap", color:"var(--text)" }}>
                    {proposal}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ HISTORY LIST ═══════════════════════════════════════════════════ */}
      {view === "history" && !activeProposal && (
        <>
          <div style={{ marginBottom:20 }}>
            <h1 style={{ fontSize:21, fontWeight:600, marginBottom:3 }}>Proposal history</h1>
            <p style={{ fontSize:13, color:"var(--muted)" }}>
              {proposals.length === 0 ? "No proposals yet — generate your first one." : `${proposals.length} proposal${proposals.length !== 1 ? "s" : ""} generated this session.`}
            </p>
          </div>
          {proposals.length === 0 && (
            <div style={{ textAlign:"center", padding:"50px 0", color:"var(--muted)", fontSize:14 }}>
              <div style={{ fontSize:30, marginBottom:12, opacity:.25 }}>✦</div>
              Nothing here yet.
              <br />
              <button style={{ ...btn(true), marginTop:16 }} onClick={() => setView("form")}>Generate your first →</button>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {proposals.map(p => (
              <div key={p.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"13px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, marginBottom:2 }}>{p.clientName}</div>
                    <div style={{ fontSize:12, color:"var(--muted)" }}>{p.bizName} · {p.trade} · {p.createdAt}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{p.total}</span>
                    <select className="ssel" value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                      style={{ color: STATUS[p.status]?.color }}>
                      {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k} style={{ color:v.color }}>{v.label}</option>)}
                    </select>
                    <button style={{ ...btn(false), padding:"5px 12px", fontSize:12 }} onClick={() => setActiveProposal(p)}>View →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ HISTORY DETAIL ═════════════════════════════════════════════════ */}
      {view === "history" && activeProposal && (
        <>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
            <button style={{ ...btn(false), padding:"6px 14px", fontSize:12 }} onClick={() => setActiveProposal(null)}>← Back to history</button>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <select className="ssel" value={activeProposal.status}
                onChange={e => { const s = e.target.value; updateStatus(activeProposal.id, s); setActiveProposal(p => ({...p, status:s})); }}
                style={{ color: STATUS[activeProposal.status]?.color }}>
                {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k} style={{ color:v.color }}>{v.label}</option>)}
              </select>
              <button style={btn(false)} onClick={() => navigator.clipboard.writeText(activeProposal.output)}>Copy text</button>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:2 }}>{activeProposal.clientName}</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>{activeProposal.bizName} · {activeProposal.trade} · {activeProposal.createdAt} · {activeProposal.total}</div>
          </div>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"18px 22px", fontFamily:"monospace", fontSize:12.5, lineHeight:1.85, whiteSpace:"pre-wrap", color:"var(--text)" }}>
            {activeProposal.output}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="lp-outer">
        <div className="lp-lid">
          <div className="lp-cambar"><div className="lp-cam" /></div>
          <div className="lp-screen"><AppContent /></div>
        </div>
        <div className="lp-base"><div className="lp-pad" /></div>
      </div>
    </>
  );
}
