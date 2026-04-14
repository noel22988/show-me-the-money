import { useState, useEffect, useRef, useCallback } from "react";

// ── Privacy Modal ─────────────────────────────────────────────────────────────
export function PrivacyModal({ onClose }) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(4px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0F0F17",border:"1px solid rgba(200,255,87,0.2)",borderRadius:20,padding:36,maxWidth:540,width:"100%",maxHeight:"80vh",overflowY:"auto",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:"#555568",cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:12,textTransform:"uppercase"}}>Privacy</div>
        <h2 style={{margin:"0 0 20px",fontSize:22,fontWeight:700,color:"#EEEAE0",letterSpacing:-0.5}}>Your data stays on your device. Full stop.</h2>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {[
            {icon:"🔒", title:"Local-first storage", body:"Everything you enter — transactions, income, budgets — is stored only in your browser's localStorage. Nothing is sent to our servers. Nothing is stored in a database. Ever."},
            {icon:"🤖", title:"AI parsing is temporary", body:"When you upload a bank statement, its contents are sent to Anthropic's Claude API for parsing. This is the only time your data leaves your device. Anthropic does not store your statement or transaction data after processing."},
            {icon:"📵", title:"No tracking, no analytics", body:"We don't use Google Analytics, Mixpanel, or any tracking tools. We don't know who you are, where you are, or how you use the app. There are no cookies for advertising or profiling."},
            {icon:"💾", title:"Backups are yours", body:"The backup files you download are JSON files stored on your own device. We have no access to them. If you lose them, we cannot recover them — there is no copy on our end."},
            {icon:"🗑️", title:"Deleting your data", body:"Tap Reset Everything in Profile to permanently delete all data from your device. Since we don't hold a copy, this is the complete and final deletion."},
          ].map(({icon,title,body})=>(
            <div key={title} style={{display:"flex",gap:14,padding:"16px",background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.07)"}}>
              <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{icon}</span>
              <div><div style={{fontSize:14,fontWeight:600,color:"#EEEAE0",marginBottom:4}}>{title}</div><div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>{body}</div></div>
            </div>
          ))}
        </div>
        <div style={{marginTop:24,padding:"14px 16px",background:"rgba(200,255,87,0.08)",borderRadius:12,border:"1px solid rgba(200,255,87,0.2)",fontSize:13,color:"#C8FF57",lineHeight:1.6}}>
          <strong>PDPA note:</strong> Since we don't collect or store personal data on our servers, the Personal Data Protection Act (Singapore) does not apply to this app in the traditional sense. Your data is yours.
        </div>
        <button onClick={onClose} style={{marginTop:20,width:"100%",padding:"13px",background:"#C8FF57",border:"none",borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,color:"#0C0C12",cursor:"pointer"}}>Got it</button>
      </div>
    </div>
  );
}

// ── UIGallery — autoplay + tappable carousel of UI screens ───────────────────
function UIGallery(){
  const [active,setActive]=useState(0);
  const timerRef=useRef(null);
  const SLIDES=[
    {
      label:"Dashboard",
      desc:"See your full month at a glance",
      content:<>
        <div style={{marginBottom:10,fontSize:12,color:"#888898",fontFamily:"'DM Mono',monospace"}}>April 2026</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[["Income","S$6,200","#51CF66","+S$400 vs last mo"],["Fixed","S$1,800","#60AAFF","-S$0 vs last mo"],["Spent","S$2,100","#FF6B6B","-S$340 vs last mo"],["Saved","S$2,300","#C8FF57","+S$740 vs last mo"]].map(([l,v,c,d])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"12px 10px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:9,color:"#555568",letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
              <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div>
              <div style={{fontSize:9,color:c,fontFamily:"'DM Mono',monospace",marginTop:3,opacity:.7}}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:4,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#888898"}}>Savings rate</span><span style={{fontSize:11,color:"#C8FF57",fontFamily:"'DM Mono',monospace",fontWeight:700}}>37.1%</span></div>
        <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:"37%",background:"#C8FF57",borderRadius:5}}/></div>
        <div style={{marginTop:8,fontSize:11,color:"#888898"}}>Top spend: <span style={{color:"#EEEAE0"}}>🍔 Food & Dining</span> · <span style={{color:"#C8FF57",fontFamily:"'DM Mono',monospace"}}>S$680</span></div>
      </>
    },
    {
      label:"Review",
      desc:"Approve transactions before they're saved",
      content:<>
        <div style={{marginBottom:10,fontSize:12,color:"#888898"}}>3 transactions imported</div>
        {[
          {desc:"GRAB*RIDE",cat:"🚗 Transport",amt:"S$14.50",checked:true},
          {desc:"FAIRPRICE XTRA",cat:"🛒 Groceries",amt:"S$67.80",checked:true},
          {desc:"NETFLIX.COM",cat:"📱 Subscription",amt:"S$15.98",checked:false,flag:"usually excluded"},
        ].map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${t.checked?"#C8FF57":"rgba(255,255,255,0.2)"}`,background:t.checked?"#C8FF57":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {t.checked&&<div style={{width:8,height:8,background:"#0C0C12",borderRadius:2}}/>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#EEEAE0",fontWeight:500}}>{t.desc}</div>
              <div style={{fontSize:10,color:"#555568",marginTop:1}}>{t.cat}{t.flag&&<span style={{marginLeft:6,color:"#FAB005",fontSize:9,border:"1px solid rgba(250,176,5,0.3)",borderRadius:4,padding:"1px 5px"}}>{t.flag}</span>}</div>
            </div>
            <div style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:t.checked?"#EEEAE0":"#555568"}}>{t.amt}</div>
          </div>
        ))}
        <div style={{marginTop:12,padding:"10px 14px",background:"#C8FF57",borderRadius:10,textAlign:"center",fontSize:12,fontWeight:700,color:"#0C0C12"}}>Save 2 transactions → April 2026</div>
      </>
    },
    {
      label:"Breakdown",
      desc:"Understand exactly where money goes",
      content:<>
        <div style={{marginBottom:10,fontSize:12,color:"#888898"}}>Variable spending · April 2026</div>
        {[
          {cat:"🍔 Food & Dining",amt:680,pct:32,col:"#FF6B6B",budget:800},
          {cat:"🛒 Groceries",amt:420,pct:20,col:"#51CF66",budget:500},
          {cat:"🚗 Transport",amt:210,pct:10,col:"#339AF0",budget:null},
          {cat:"🎬 Entertainment",amt:180,pct:9,col:"#CC5DE8",budget:200},
        ].map(({cat,amt,pct,col,budget})=>(
          <div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,color:"#EEEAE0"}}>{cat}</span>
              <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:col}}>S${amt}</span>
            </div>
            <div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct*3}%`,background:col,borderRadius:4}}/>
            </div>
            {budget&&<div style={{fontSize:9,color:"#555568",marginTop:2,fontFamily:"'DM Mono',monospace"}}>S${amt} / S${budget} budget</div>}
          </div>
        ))}
      </>
    },
    {
      label:"Insights",
      desc:"AI analysis of your spending patterns",
      content:<>
        <div style={{marginBottom:10,fontSize:12,color:"#888898"}}>Claude Insights · April 2026</div>
        {[
          {icon:"📉",text:"Your food spending dropped S$340 this month — your best result in 4 months."},
          {icon:"⚠️",text:"Entertainment is at 90% of your S$200 budget with a week left."},
          {icon:"💡",text:"You've saved consistently above 30% for 3 months. Well above the average of 20%."},
          {icon:"🎯",text:"At your current rate you'll hit your Emergency Fund goal in 4 months."},
        ].map(({icon,text},i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
            <span style={{fontSize:12,color:"#EEEAE0",lineHeight:1.5}}>{text}</span>
          </div>
        ))}
      </>
    },
  ];

  const restart=()=>{ clearTimeout(timerRef.current); timerRef.current=setTimeout(()=>setActive(a=>(a+1)%SLIDES.length),3500); };
  useEffect(()=>{ timerRef.current=setTimeout(()=>setActive(a=>(a+1)%SLIDES.length),3500); return()=>clearTimeout(timerRef.current); },[]);
  const go=i=>{ setActive(i); restart(); };

  return <div style={{maxWidth:480,margin:"0 auto 96px",padding:"0 24px"}}>
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:8,textTransform:"uppercase"}}>App Preview</div>
      <div style={{fontSize:13,color:"#888898"}}>{SLIDES[active].desc}</div>
    </div>
    {/* Card */}
    <div onClick={()=>go((active+1)%SLIDES.length)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"20px",cursor:"pointer",minHeight:280,transition:"border-color .2s",userSelect:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:13,fontWeight:700,color:"#EEEAE0"}}>{SLIDES[active].label}</span>
        <span style={{fontSize:11,color:"#555568",fontFamily:"'DM Mono',monospace"}}>tap to advance →</span>
      </div>
      {SLIDES[active].content}
    </div>
    {/* Dots */}
    <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:16}}>
      {SLIDES.map((_,i)=>(
        <div key={i} onClick={()=>go(i)} style={{width:i===active?24:7,height:7,borderRadius:4,background:i===active?"#C8FF57":"rgba(255,255,255,0.15)",transition:"all .3s",cursor:"pointer"}}/>
      ))}
    </div>
  </div>;
}

// ── NavTypewriter — types Show Me / The Money on loop ────────────────────────
function NavTypewriter(){
  const LINES=["Show Me","The Money"];
  const full=LINES[0]+"||"+LINES[1];
  const [typed,setTyped]=useState("");
  const timerRef=useRef(null);

  useEffect(()=>{
    let cancelled=false;
    const cycle=()=>{
      if(cancelled) return;
      setTyped("");
      let i=0;
      const tick=()=>{
        if(cancelled) return;
        i++; setTyped(full.slice(0,i));
        if(i<full.length) timerRef.current=setTimeout(tick,42);
        else timerRef.current=setTimeout(()=>{ if(!cancelled){ setTyped(""); cycle(); } },3000);
      };
      timerRef.current=setTimeout(tick,42);
    };
    cycle();
    return()=>{ cancelled=true; clearTimeout(timerRef.current); };
  },[]);

  const parts=typed.split("||");
  return <div style={{lineHeight:1.2,minWidth:80}}>
    <div style={{fontSize:15,fontWeight:800,color:"#C8FF57",letterSpacing:-0.3}}>{parts[0]||""}<span style={{animation:"blink .7s step-end infinite",opacity:.5}}>|</span></div>
    {parts.length>1&&<div style={{fontSize:15,fontWeight:800,color:"#C8FF57",letterSpacing:-0.3}}>{parts[1]}</div>}
  </div>;
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function Landing({ onEnter }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  const features = [
    { icon: "📄", title: "Import any statement", body: "PDF, CSV, or photo. Claude reads your bank statement and extracts every transaction automatically." },
    { icon: "🔍", title: "Review before saving", body: "Nothing gets saved until you approve it. Edit categories, catch errors, uncheck anything you don't want." },
    { icon: "📊", title: "Understand your money", body: "See spending by category, savings rate, fixed vs variable, and how this month compares to last." },
    { icon: "🤖", title: "AI insights", body: "After 3 months of data, Claude analyses your patterns and gives you specific, actionable advice." },
    { icon: "🔒", title: "100% private", body: "Your data never leaves your device. No accounts, no cloud sync, no tracking. Just you and your money." },
    { icon: "💾", title: "Always backed up", body: "Auto-backup runs in the background. Download a full JSON backup anytime. Your data, your terms." },
  ];

  const faqs = [
    { q: "Do I need to create an account?", a: "No. The app works entirely from your browser. There are no accounts, no sign-ups, no passwords." },
    { q: "What banks does it support?", a: "Any bank, anywhere. Upload a PDF or CSV statement and Claude will parse it — DBS, OCBC, UOB, Maybank, HSBC, or any other." },
    { q: "Is my financial data safe?", a: "Yes. All data is stored locally in your browser. When you import a statement, it's sent to Anthropic's Claude API for parsing only — not stored anywhere. See our full privacy policy for details." },
    { q: "What if I clear my browser?", a: "Your data will be lost — this is the trade-off of local-first storage. We strongly recommend using the backup feature regularly. Download a JSON backup from Profile → Data & Backup." },
    { q: "Is it free?", a: "The core app is free forever. AI-powered features like Claude Insights will be part of a paid plan in the future. Import and tracking are always free." },
  ];

  return (
    <>
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      <div style={{minHeight:"100vh",background:"#0C0C12",color:"#EEEAE0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",overflowX:"hidden"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
        <style>{`
          @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @keyframes blink{0%,100%{opacity:.4}50%{opacity:0}}
          @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
          .fade-up{opacity:0;animation:fadeUp .7s ease forwards;}
          .d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}.d4{animation-delay:.4s}.d5{animation-delay:.5s}.d6{animation-delay:.6s}.d7{animation-delay:.7s}
          .enter-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(200,255,87,0.35);}
          .feature-card:hover{border-color:rgba(200,255,87,0.3);transform:translateY(-2px);}
          .faq-item:hover{background:rgba(255,255,255,0.05);}
          @media(min-width:600px){.mock-grid{grid-template-columns:repeat(4,1fr)!important;}}
        `}</style>

        {/* Nav */}
        <nav style={{padding:"20px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.06)",position:"sticky",top:0,background:"rgba(12,12,18,0.9)",backdropFilter:"blur(12px)",zIndex:50}}>
          <NavTypewriter/>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <button onClick={()=>setPrivacyOpen(true)} style={{background:"none",border:"none",color:"#888898",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Privacy</button>
            <button onClick={onEnter} style={{padding:"8px 20px",background:"#C8FF57",border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:13,color:"#0C0C12",cursor:"pointer",transition:"all .2s"}}>Launch App →</button>
          </div>
        </nav>

        {/* Hero */}
        <section style={{maxWidth:860,margin:"0 auto",padding:"96px 32px 80px",textAlign:"center"}}>
          <div className="fade-up d1" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(200,255,87,0.1)",border:"1px solid rgba(200,255,87,0.25)",borderRadius:20,padding:"6px 14px",marginBottom:28}}>
            <span style={{fontSize:12,color:"#C8FF57",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>BETA — Free to use</span>
          </div>
          <h1 className="fade-up d2" style={{fontSize:"clamp(36px,7vw,72px)",fontWeight:800,lineHeight:1.1,letterSpacing:-2,margin:"0 0 24px",background:"linear-gradient(135deg,#EEEAE0 0%,#C8FF57 60%,#EEEAE0 100%)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"shimmer 4s linear infinite"}}>
            Finally understand<br/>where your money goes
          </h1>
          <p className="fade-up d3" style={{fontSize:"clamp(16px,2.5vw,20px)",color:"#888898",lineHeight:1.7,maxWidth:560,margin:"0 auto 40px"}}>
            Upload your bank statement. Claude extracts every transaction. You see exactly where your money goes — no accounts, no cloud, no tracking.
          </p>
          <div className="fade-up d4" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={onEnter} className="enter-btn" style={{padding:"16px 36px",background:"#C8FF57",border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:800,fontSize:16,color:"#0C0C12",cursor:"pointer",transition:"all .2s",letterSpacing:-0.3}}>
              Start for free →
            </button>
            <button onClick={()=>setPrivacyOpen(true)} style={{padding:"16px 24px",background:"transparent",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,fontFamily:"inherit",fontWeight:500,fontSize:15,color:"#888898",cursor:"pointer",transition:"all .2s"}}>
              🔒 100% private — how?
            </button>
          </div>
        </section>

        {/* UI Gallery */}
        <UIGallery/>

        {/* Features */}
        <section style={{maxWidth:960,margin:"0 auto 96px",padding:"0 32px"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:12,textTransform:"uppercase"}}>Features</div>
            <h2 style={{fontSize:"clamp(26px,4vw,40px)",fontWeight:700,margin:0,letterSpacing:-1}}>Everything you need.<br/>Nothing you don't.</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
            {features.map(({icon,title,body})=>(
              <div key={title} className="feature-card" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"24px",transition:"all .2s",cursor:"default"}}>
                <div style={{fontSize:28,marginBottom:14}}>{icon}</div>
                <div style={{fontSize:15,fontWeight:600,color:"#EEEAE0",marginBottom:8}}>{title}</div>
                <div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>{body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy callout */}
        <section style={{maxWidth:720,margin:"0 auto 96px",padding:"0 32px"}}>
          <div style={{background:"rgba(200,255,87,0.06)",border:"1px solid rgba(200,255,87,0.2)",borderRadius:20,padding:"40px 36px",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:16}}>🔒</div>
            <h2 style={{fontSize:24,fontWeight:700,margin:"0 0 12px",letterSpacing:-0.5}}>Your data never leaves your device</h2>
            <p style={{fontSize:14,color:"#888898",lineHeight:1.7,margin:"0 0 24px",maxWidth:480,marginLeft:"auto",marginRight:"auto"}}>
              No accounts. No cloud storage. No tracking. Everything is stored locally in your browser. 
              The only time data leaves your device is when Claude parses your statement — and even then, it's not stored anywhere.
            </p>
            <button onClick={()=>setPrivacyOpen(true)} style={{padding:"11px 24px",background:"transparent",border:"1px solid rgba(200,255,87,0.4)",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:13,color:"#C8FF57",cursor:"pointer"}}>Read our privacy policy →</button>
          </div>
        </section>

        {/* FAQ */}
        <section style={{maxWidth:640,margin:"0 auto 96px",padding:"0 32px"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:12,textTransform:"uppercase"}}>FAQ</div>
            <h2 style={{fontSize:"clamp(22px,3.5vw,34px)",fontWeight:700,margin:0,letterSpacing:-0.5}}>Common questions</h2>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {faqs.map(({q,a})=><FaqItem key={q} q={q} a={a}/>)}
          </div>
        </section>

        {/* CTA */}
        <section style={{maxWidth:640,margin:"0 auto 0",padding:"0 32px 80px",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(24px,4vw,42px)",fontWeight:800,letterSpacing:-1,margin:"0 0 16px"}}>Ready to see where<br/>your money goes?</h2>
          <p style={{fontSize:15,color:"#888898",marginBottom:32,lineHeight:1.6}}>Free to start. No account needed. Takes 2 minutes.</p>
          <button onClick={onEnter} className="enter-btn" style={{padding:"18px 48px",background:"#C8FF57",border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:800,fontSize:17,color:"#0C0C12",cursor:"pointer",transition:"all .2s",letterSpacing:-0.3}}>
            Start tracking for free →
          </button>
        </section>

        {/* Footer */}
        <footer style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"28px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,maxWidth:960,margin:"0 auto"}}>
          <span style={{fontSize:13,color:"#444454",fontFamily:"'DM Mono',monospace"}}>Show Me The Money · Beta</span>
          <div style={{display:"flex",gap:20}}>
            <button onClick={()=>setPrivacyOpen(true)} style={{background:"none",border:"none",color:"#444454",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Privacy</button>
            <button onClick={onEnter} style={{background:"none",border:"none",color:"#444454",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Launch App</button>
          </div>
        </footer>
      </div>
    </>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item" onClick={() => setOpen(o => !o)} style={{padding:"18px 20px",borderRadius:12,cursor:"pointer",transition:"background .15s",border:"1px solid rgba(255,255,255,0.06)",marginBottom:4}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
        <span style={{fontSize:14,fontWeight:500,color:"#EEEAE0"}}>{q}</span>
        <span style={{color:"#C8FF57",fontSize:18,flexShrink:0,transition:"transform .2s",transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </div>
      {open && <p style={{margin:"12px 0 0",fontSize:13,color:"#888898",lineHeight:1.65}}>{a}</p>}
    </div>
  );
}
