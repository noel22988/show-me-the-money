import { useState, useEffect, useRef } from "react";

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
            {icon:"🔒",title:"Local-first storage",body:"Everything you enter — transactions, income, budgets — is stored only in your browser's localStorage. Nothing is sent to our servers. Nothing is stored in a database. Ever."},
            {icon:"🤖",title:"AI parsing is temporary",body:"When you upload a bank statement, its contents are sent to Anthropic's Claude API for parsing. This is the only time your data leaves your device. Anthropic does not store your statement or transaction data after processing."},
            {icon:"📵",title:"No tracking, no analytics",body:"We don't use Google Analytics, Mixpanel, or any tracking tools. We don't know who you are, where you are, or how you use the app. There are no cookies for advertising or profiling."},
            {icon:"💾",title:"Backups are yours",body:"The backup files you download are JSON files stored on your own device. We have no access to them. If you lose them, we cannot recover them — there is no copy on our end."},
            {icon:"🗑️",title:"Deleting your data",body:"Tap Reset Everything in Profile to permanently delete all data from your device. Since we don't hold a copy, this is the complete and final deletion."},
          ].map(({icon,title,body})=>(
            <div key={title} style={{display:"flex",gap:14,padding:"16px",background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.07)"}}>
              <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{icon}</span>
              <div><div style={{fontSize:14,fontWeight:600,color:"#EEEAE0",marginBottom:4}}>{title}</div><div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>{body}</div></div>
            </div>
          ))}
        </div>
        <div style={{marginTop:24,padding:"14px 16px",background:"rgba(200,255,87,0.08)",borderRadius:12,border:"1px solid rgba(200,255,87,0.2)",fontSize:13,color:"#C8FF57",lineHeight:1.6}}>
          <strong>PDPA note:</strong> Since we do not collect or store personal data on our servers, the Personal Data Protection Act (Singapore) does not apply in the traditional sense. Your data is yours.
        </div>
        <button onClick={onClose} style={{marginTop:20,width:"100%",padding:"13px",background:"#C8FF57",border:"none",borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,color:"#0C0C12",cursor:"pointer"}}>Got it</button>
      </div>
    </div>
  );
}

// ── UIGallery ─────────────────────────────────────────────────────────────────
function UIGallery(){
  const [active,setActive]=useState(0);
  const [fading,setFading]=useState(false);
  const timerRef=useRef(null);

  const SLIDES=[
    {label:"Dashboard",desc:"Your full month, at a glance",content:<>
      <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:12,color:"#888898",fontFamily:"'DM Mono',monospace"}}>April 2026</div>
        <div style={{fontSize:11,color:"#555568"}}>Good evening, Leon 👋</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[["Income","S$4,231.80","#51CF66","+S$320 vs last mo"],["Fixed","S$1,247.50","#60AAFF","no change"],["Spent","S$1,893.45","#FF6B6B","-S$247 vs last mo"],["Saved","S$1,090.85","#C8FF57","+S$567 vs last mo"]].map(([l,v,c,d])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"11px 10px",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:9,color:"#555568",letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
            <div style={{fontSize:15,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>{v}</div>
            <div style={{fontSize:9,color:c,fontFamily:"'DM Mono',monospace",marginTop:3,opacity:.7}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#888898"}}>Savings rate</span>
        <span style={{fontSize:11,color:"#C8FF57",fontFamily:"'DM Mono',monospace",fontWeight:700}}>25.8%</span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:5,overflow:"hidden",marginBottom:10}}>
        <div style={{height:"100%",width:"26%",background:"#C8FF57",borderRadius:5}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888898"}}>
        <span>Top: <span style={{color:"#EEEAE0"}}>🍔 Food</span> · <span style={{color:"#FF6B6B",fontFamily:"'DM Mono',monospace"}}>S$643.20</span></span>
        <span style={{color:"#555568"}}>6 months tracked</span>
      </div>
    </>},

    {label:"Import",desc:"Claude reads your statement — any bank, any format",content:<>
      <div style={{marginBottom:14,padding:"14px 16px",background:"rgba(200,255,87,0.06)",border:"1px solid rgba(200,255,87,0.2)",borderRadius:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:18}}>📄</span>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#EEEAE0"}}>DBS_Statement_Apr2026.pdf</div>
            <div style={{fontSize:10,color:"#888898"}}>2.3 MB · Uploading…</div>
          </div>
        </div>
        <div style={{height:3,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:"72%",background:"#C8FF57",borderRadius:3}}/>
        </div>
      </div>
      <div style={{fontSize:11,color:"#888898",marginBottom:10,fontFamily:"'DM Mono',monospace"}}>Claude is reading your statement…</div>
      {[
        {desc:"Found 47 transactions",done:true},
        {desc:"Categorising by merchant…",done:true},
        {desc:"Flagging recurring payments…",done:true},
        {desc:"Ready for review",done:false},
      ].map(({desc,done},i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{fontSize:12,flexShrink:0}}>{done?"✅":"⏳"}</span>
          <span style={{fontSize:12,color:done?"#888898":"#EEEAE0"}}>{desc}</span>
        </div>
      ))}
      <div style={{marginTop:12,padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:8,fontSize:11,color:"#555568"}}>📶 Use WiFi for best results on large files</div>
    </>},

    {label:"Review",desc:"Nothing saves until you approve it",content:<>
      <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"#888898"}}>47 transactions · April 2026</span>
        <span style={{fontSize:11,color:"#C8FF57",fontFamily:"'DM Mono',monospace"}}>44 selected</span>
      </div>
      {[
        {desc:"KOUFU FOOD COURT",cat:"🍔 Food & Dining",amt:"S$6.80",checked:true,flag:null},
        {desc:"COMFORT DELGRO*9234",cat:"🚗 Transport",amt:"S$18.40",checked:true,flag:null},
        {desc:"NETFLIX.COM",cat:"📱 Subscription",amt:"S$15.98",checked:false,flag:"excluded before"},
        {desc:"GRABFOOD-MCDONALDS",cat:"🍔 Food & Dining",amt:"S$23.70",checked:true,flag:null},
        {desc:"NTUC FAIRPRICE #047",cat:"🛒 Groceries",amt:"S$84.35",checked:true,flag:null},
      ].map((t,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${t.checked?"#C8FF57":"rgba(255,255,255,0.2)"}`,background:t.checked?"#C8FF57":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {t.checked&&<div style={{width:7,height:7,background:"#0C0C12",borderRadius:1}}/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:t.checked?"#EEEAE0":"#555568",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</div>
            <div style={{fontSize:9,color:"#555568",marginTop:1}}>{t.cat}{t.flag&&<span style={{marginLeft:5,color:"#FAB005",fontSize:8,border:"1px solid rgba(250,176,5,0.3)",borderRadius:3,padding:"1px 4px"}}>{t.flag}</span>}</div>
          </div>
          <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:t.checked?"#EEEAE0":"#555568",flexShrink:0}}>{t.amt}</div>
        </div>
      ))}
      <div style={{marginTop:10,padding:"9px 12px",background:"#C8FF57",borderRadius:9,textAlign:"center",fontSize:12,fontWeight:700,color:"#0C0C12"}}>Save 44 transactions → April 2026</div>
    </>},

    {label:"Breakdown",desc:"See every dollar, by category",content:<>
      <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"#888898"}}>Variable spending · April 2026</span>
        <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"#FF6B6B"}}>S$1,893.45</span>
      </div>
      {[
        {cat:"🍔 Food & Dining",amt:"S$643.20",pct:34,col:"#FF6B6B",budget:700,over:false},
        {cat:"🛒 Groceries",amt:"S$387.15",pct:20,col:"#51CF66",budget:400,over:false},
        {cat:"🚗 Transport",amt:"S$234.80",pct:12,col:"#339AF0",budget:null,over:false},
        {cat:"🎬 Entertainment",amt:"S$198.50",pct:10,col:"#CC5DE8",budget:150,over:true},
        {cat:"🏥 Health",amt:"S$156.30",pct:8,col:"#FF922B",budget:null,over:false},
        {cat:"📦 Other",amt:"S$273.50",pct:14,col:"#868E96",budget:null,over:false},
      ].map(({cat,amt,pct,col,budget,over})=>(
        <div key={cat} style={{marginBottom:9}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#EEEAE0"}}>{cat}</span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {over&&<span style={{fontSize:9,color:"#FAB005",border:"1px solid rgba(250,176,5,0.3)",borderRadius:3,padding:"1px 4px"}}>over budget</span>}
              <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:col}}>{amt}</span>
            </div>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(pct*2.8,100)}%`,background:over?"#FAB005":col,borderRadius:4}}/>
          </div>
          {budget&&<div style={{fontSize:9,color:over?"#FAB005":"#444454",marginTop:2,fontFamily:"'DM Mono',monospace"}}>budget: S${budget}</div>}
        </div>
      ))}
    </>},

    {label:"Insights",desc:"AI tells you what the numbers mean",content:<>
      <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"#888898"}}>Claude Insights · April 2026</span>
        <span style={{fontSize:10,color:"#555568",fontFamily:"'DM Mono',monospace"}}>4 months data</span>
      </div>
      {[
        {icon:"📉",col:"#51CF66",text:"Food spending dropped S$247 vs March — your best month yet. GrabFood orders fell from 18 to 11."},
        {icon:"⚠️",col:"#FAB005",text:"Entertainment hit S$198 against a S$150 budget. Two concert tickets in one month skewed this."},
        {icon:"💡",col:"#60AAFF",text:"Your savings rate has climbed from 18% → 22% → 26% over 3 months. Strong upward trend."},
        {icon:"🎯",col:"#C8FF57",text:"Your fixed commitments are 29% of income — healthy, below the 40% warning threshold."},
      ].map(({icon,col,text},i)=>(
        <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
          <span style={{fontSize:11,color:"#EEEAE0",lineHeight:1.6}}>{text}</span>
        </div>
      ))}
    </>},

    {label:"Goals",desc:"Track what you're saving toward",content:<>
      <div style={{marginBottom:12,fontSize:12,color:"#888898"}}>Savings goals · all time</div>
      {[
        {name:"Emergency Fund",target:"S$15,000",saved:"S$8,420",pct:56,col:"#51CF66",eta:"Dec 2026"},
        {name:"Japan Trip 2026",target:"S$4,500",saved:"S$3,150",pct:70,col:"#C8FF57",eta:"Jun 2026"},
        {name:"New Laptop",target:"S$2,800",saved:"S$2,800",pct:100,col:"#60AAFF",eta:"Done ✓"},
      ].map(({name,target,saved,pct,col,eta})=>(
        <div key={name} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#EEEAE0"}}>{name}</div>
              <div style={{fontSize:10,color:"#555568",marginTop:1}}>{saved} of {target}</div>
            </div>
            <span style={{fontSize:10,color:pct===100?"#51CF66":"#888898",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{eta}</span>
          </div>
          <div style={{height:5,background:"rgba(255,255,255,0.07)",borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:5,transition:"width .4s"}}/>
          </div>
          <div style={{fontSize:9,color:col,fontFamily:"'DM Mono',monospace",marginTop:3}}>{pct}%</div>
        </div>
      ))}
    </>},
  ];

  const restart=()=>{ clearTimeout(timerRef.current); timerRef.current=setTimeout(()=>advance(),4200); };
  const advance=()=>{ setFading(true); setTimeout(()=>{ setActive(a=>(a+1)%SLIDES.length); setFading(false); },260); };
  useEffect(()=>{ timerRef.current=setTimeout(()=>advance(),4200); return()=>clearTimeout(timerRef.current); },[]);
  const go=i=>{ if(i===active) return; setFading(true); setTimeout(()=>{ setActive(i); setFading(false); },260); restart(); };

  return <div style={{maxWidth:500,margin:"0 auto",padding:"0 24px"}}>
    <div style={{textAlign:"center",marginBottom:18}}>
      <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:6,textTransform:"uppercase"}}>App Preview</div>
      <div style={{fontSize:13,color:"#888898",minHeight:20,transition:"opacity .2s",opacity:fading?0:1}}>{SLIDES[active].desc}</div>
    </div>
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"20px",transition:"opacity .26s ease",opacity:fading?0:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:13,fontWeight:700,color:"#EEEAE0"}}>{SLIDES[active].label}</span>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>go((active-1+SLIDES.length)%SLIDES.length)} style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"#EEEAE0",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <button onClick={()=>go((active+1)%SLIDES.length)} style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"#EEEAE0",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
      </div>
      {SLIDES[active].content}
    </div>
    <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:10}}>
      {SLIDES.map((_,i)=>(
        <div key={i} onClick={()=>go(i)} style={{width:i===active?22:6,height:6,borderRadius:3,background:i===active?"#C8FF57":"rgba(255,255,255,0.15)",transition:"all .3s",cursor:"pointer"}}/>
      ))}
    </div>
  </div>;
}

// ── Waitlist Form ─────────────────────────────────────────────────────────────
// Update this number manually when you want to show progress
const WAITLIST_COUNT = 0;

function WaitlistForm() {
  const [email,setEmail]=useState("");
  const [status,setStatus]=useState("idle");

  const submit=async()=>{
    if(!email||!/\S+@\S+\.\S+/.test(email)) return;
    setStatus("loading");
    try {
      await fetch("https://formspree.io/f/mqewaqro",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({email,_subject:"$how Me The Money Waitlist"})});
      setStatus("done");
    } catch(e){ setStatus("error"); }
  };

  if(status==="done") return <div style={{textAlign:"center",padding:"16px 0"}}>
    <div style={{fontSize:26,marginBottom:10}}>🎉</div>
    <div style={{fontSize:15,fontWeight:700,color:"#EEEAE0",marginBottom:6}}>You're on the list!</div>
    <div style={{fontSize:13,color:"#888898",lineHeight:1.6,marginBottom:12}}>We'll reach out when founding member pricing goes live.</div>
    {WAITLIST_COUNT>0&&<div style={{fontSize:12,color:"#C8FF57",fontFamily:"'DM Mono',monospace"}}>{WAITLIST_COUNT} of 200 founding spots claimed</div>}
  </div>;

  return <div>
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
      <input type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
        style={{flex:1,minWidth:180,padding:"13px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,color:"#EEEAE0",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}}/>
      <button onClick={submit} disabled={status==="loading"} style={{padding:"13px 22px",background:"#C8FF57",border:"none",borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,color:"#0C0C12",cursor:status==="loading"?"wait":"pointer",whiteSpace:"nowrap",opacity:status==="loading"?0.7:1}}>
        {status==="loading"?"Joining…":"Join the waitlist →"}
      </button>
    </div>
    {status==="error"&&<div style={{fontSize:12,color:"#FF6B6B",marginBottom:8}}>Something went wrong — try again.</div>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      {WAITLIST_COUNT>0&&<div style={{fontSize:12,color:"#888898",fontFamily:"'DM Mono',monospace"}}><span style={{color:"#C8FF57",fontWeight:700}}>{WAITLIST_COUNT}</span> of 200 founding spots</div>}
      <div style={{fontSize:12,color:"#555568"}}>No spam. One email when we launch.</div>
    </div>
  </div>;
}

// ── NavTypewriter ─────────────────────────────────────────────────────────────
function NavTypewriter(){
  const full="$how Me||The Money";
  const [typed,setTyped]=useState("");
  const timerRef=useRef(null);
  useEffect(()=>{
    let cancelled=false;
    const cycle=()=>{
      if(cancelled) return; setTyped(""); let i=0;
      const tick=()=>{ if(cancelled) return; i++; setTyped(full.slice(0,i)); if(i<full.length) timerRef.current=setTimeout(tick,42); else timerRef.current=setTimeout(()=>{ if(!cancelled){ setTyped(""); cycle(); }},3000); };
      timerRef.current=setTimeout(tick,42);
    };
    cycle(); return()=>{ cancelled=true; clearTimeout(timerRef.current); };
  },[]);
  const parts=typed.split("||");
  return <div style={{lineHeight:1.2,minWidth:80}}>
    <div style={{fontSize:15,fontWeight:800,color:"#C8FF57",letterSpacing:-0.3}}>{parts[0]||""}<span style={{animation:"blink .7s step-end infinite",opacity:.5}}>|</span></div>
    {parts.length>1&&<div style={{fontSize:15,fontWeight:800,color:"#C8FF57",letterSpacing:-0.3}}>{parts[1]}</div>}
  </div>;
}

// ── FaqItem ───────────────────────────────────────────────────────────────────
function FaqItem({q,a}){
  const [open,setOpen]=useState(false);
  return <div className="faq-item" onClick={()=>setOpen(o=>!o)} style={{padding:"18px 20px",borderRadius:12,cursor:"pointer",transition:"background .15s",border:"1px solid rgba(255,255,255,0.06)",marginBottom:4}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
      <span style={{fontSize:14,fontWeight:500,color:"#EEEAE0"}}>{q}</span>
      <span style={{color:"#C8FF57",fontSize:18,flexShrink:0,transition:"transform .2s",transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
    </div>
    {open&&<p style={{margin:"12px 0 0",fontSize:13,color:"#888898",lineHeight:1.65}}>{a}</p>}
  </div>;
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing({onEnter}){
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const features=[
    {icon:"📄",title:"Import any statement",body:"PDF or CSV from your bank. Claude reads every transaction and extracts it all — Singapore banks tested, others should work too."},
    {icon:"🔍",title:"Review before saving",body:"Nothing gets saved until you approve it. Edit categories, catch errors, uncheck anything you don't want tracked."},
    {icon:"📊",title:"Understand your money",body:"Spending by category, savings rate, fixed vs variable, and how this month compares to last."},
    {icon:"🤖",title:"AI insights",body:"After 3 full months of data (with both income and spending), Claude analyses your patterns and gives specific, actionable observations."},
    {icon:"🔒",title:"100% private by design",body:"Your data never leaves your device. No accounts, no cloud sync, no tracking. Just you and your money."},
    {icon:"💾",title:"Always backed up",body:"Auto-backup runs silently in the background. Download a full JSON backup anytime. Your data, your terms."},
  ];
  const faqs=[
    {q:"Do I need to create an account?",a:"No. The app works entirely in your browser. No accounts, no sign-ups, no passwords — ever."},
    {q:"What banks does it support?",a:"Tested with Singapore banks — DBS, OCBC, UOB, Standard Chartered, and others. If your bank provides a PDF or CSV statement, Claude can likely parse it. If it doesn't work well, tell us and we'll improve."},
    {q:"Is my financial data safe?",a:"Yes. All data is stored locally in your browser. When you import a statement, it's sent to Claude for parsing only — not stored. See our privacy policy for details."},
    {q:"What if I clear my browser?",a:"Your data will be lost — the trade-off of local-first storage. We strongly recommend downloading a backup regularly from Profile → Data & Backup."},
    {q:"What's the founding member price?",a:"We haven't set it yet — that's partly up to you. The first 200 on the waitlist get the best price we offer, locked in for life."},
    {q:"When does it launch publicly?",a:"We're currently in early access. Public launch is tied to hitting 200 waitlist signups. The closer we get, the sooner it happens."},
  ];

  return <>
    {privacyOpen&&<PrivacyModal onClose={()=>setPrivacyOpen(false)}/>}
    <div style={{minHeight:"100vh",background:"#0C0C12",color:"#EEEAE0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",overflowX:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:.4}50%{opacity:0}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .fu{opacity:0;animation:fadeUp .65s ease forwards;}
        .d1{animation-delay:.05s}.d2{animation-delay:.15s}.d3{animation-delay:.28s}.d4{animation-delay:.4s}.d5{animation-delay:.52s}.d6{animation-delay:.64s}
        .enter-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(200,255,87,0.3);}
        .feat:hover{border-color:rgba(200,255,87,0.25);transform:translateY(-2px);}
        .faq-item:hover{background:rgba(255,255,255,0.04);}
        input::placeholder{color:#444454!important;}
      `}</style>

      {/* Nav */}
      <nav style={{padding:"18px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.06)",position:"sticky",top:0,background:"rgba(12,12,18,0.92)",backdropFilter:"blur(12px)",zIndex:50}}>
        <NavTypewriter/>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <button onClick={()=>setPrivacyOpen(true)} style={{background:"none",border:"none",color:"#888898",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Privacy</button>
        </div>
      </nav>

      {/* Hero: badge → headline → gallery → waitlist */}
      <section style={{maxWidth:640,margin:"0 auto",padding:"28px 28px 0",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(200,255,87,0.08)",border:"1px solid rgba(200,255,87,0.2)",borderRadius:20,padding:"6px 16px",marginBottom:10}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#C8FF57",display:"inline-block"}}/>
          <span style={{fontSize:12,color:"#C8FF57",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>Waitlist open</span>
        </div>
        <h1 style={{fontSize:"clamp(30px,6vw,58px)",fontWeight:800,lineHeight:1.1,letterSpacing:-2,margin:"0 0 16px",background:"linear-gradient(135deg,#EEEAE0 0%,#C8FF57 55%,#EEEAE0 100%)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"shimmer 4s linear infinite"}}>
          Your bank statement,<br/>parsed by AI,<br/>stored by nobody
        </h1>
        <p style={{fontSize:"clamp(14px,2vw,17px)",color:"#888898",lineHeight:1.75,maxWidth:500,margin:"0 auto 24px"}}>
          Upload your statement. Claude reads every transaction. You get a clear picture of your money — with zero data leaving your device.
        </p>
      </section>

      {/* Gallery */}
      <div style={{marginBottom:16}}><UIGallery/></div>

      {/* Waitlist */}
      <section style={{maxWidth:640,margin:"0 auto",padding:"0 28px 32px",textAlign:"center"}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"26px",marginBottom:18,textAlign:"left"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:700,color:"#EEEAE0",marginBottom:5}}>Get founding member pricing</div>
            <div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>First 200 on the waitlist lock in a special price when paid features launch.</div>
          </div>
          <WaitlistForm/>
        </div>
      </section>

      {/* How it works */}
      <section style={{maxWidth:760,margin:"0 auto 88px",padding:"0 28px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:10,textTransform:"uppercase"}}>How it works</div>
          <h2 style={{fontSize:"clamp(22px,4vw,34px)",fontWeight:700,margin:0,letterSpacing:-0.5}}>Three steps. Two minutes.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
          {[
            {n:"01",icon:"📤",title:"Upload your statement",body:"PDF or CSV from your bank. Claude handles the parsing."},
            {n:"02",icon:"✅",title:"Review and approve",body:"Check what Claude extracted. Edit categories, uncheck anything. You decide what gets saved."},
            {n:"03",icon:"📊",title:"See your breakdown",body:"Spending by category, savings rate, vs-last-month deltas, and AI insights after 3 full months."},
          ].map(({n,icon,title,body})=>(
            <div key={n} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:10,color:"#C8FF57",fontFamily:"'DM Mono',monospace",fontWeight:700,opacity:.6}}>{n}</span>
                <span style={{fontSize:22}}>{icon}</span>
              </div>
              <div style={{fontSize:14,fontWeight:600,color:"#EEEAE0",marginBottom:7}}>{title}</div>
              <div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{maxWidth:940,margin:"0 auto 88px",padding:"0 28px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:10,textTransform:"uppercase"}}>Features</div>
          <h2 style={{fontSize:"clamp(24px,4vw,38px)",fontWeight:700,margin:0,letterSpacing:-1}}>Everything you need.<br/>Nothing you don't.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
          {features.map(({icon,title,body})=>(
            <div key={title} className="feat" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"22px",transition:"all .2s"}}>
              <div style={{fontSize:26,marginBottom:12}}>{icon}</div>
              <div style={{fontSize:14,fontWeight:600,color:"#EEEAE0",marginBottom:7}}>{title}</div>
              <div style={{fontSize:13,color:"#888898",lineHeight:1.65}}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy callout */}
      <section style={{maxWidth:640,margin:"0 auto 88px",padding:"0 28px"}}>
        <div style={{background:"rgba(200,255,87,0.05)",border:"1px solid rgba(200,255,87,0.18)",borderRadius:20,padding:"36px 32px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:14}}>🔒</div>
          <h2 style={{fontSize:20,fontWeight:700,margin:"0 0 10px",letterSpacing:-0.3}}>Your data never leaves your device</h2>
          <p style={{fontSize:13,color:"#888898",lineHeight:1.75,margin:"0 0 20px"}}>No accounts. No cloud. No tracking. The only time data leaves is when Claude parses your statement — and even then, nothing is stored.</p>
          <button onClick={()=>setPrivacyOpen(true)} style={{padding:"9px 20px",background:"transparent",border:"1px solid rgba(200,255,87,0.35)",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:13,color:"#C8FF57",cursor:"pointer"}}>Read our privacy policy →</button>
        </div>
      </section>

      {/* FAQ */}
      <section style={{maxWidth:600,margin:"0 auto 88px",padding:"0 28px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:11,letterSpacing:3,color:"#C8FF57",fontFamily:"'DM Mono',monospace",marginBottom:10,textTransform:"uppercase"}}>FAQ</div>
          <h2 style={{fontSize:"clamp(20px,3.5vw,32px)",fontWeight:700,margin:0,letterSpacing:-0.5}}>Common questions</h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          {faqs.map(({q,a})=><FaqItem key={q} q={q} a={a}/>)}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{maxWidth:560,margin:"0 auto 0",padding:"0 28px 80px",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(22px,4vw,38px)",fontWeight:800,letterSpacing:-1,margin:"0 0 12px"}}>Be one of the first 200.</h2>
        <p style={{fontSize:14,color:"#888898",marginBottom:28,lineHeight:1.65}}>Lock in founding member pricing before we launch publicly.</p>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"24px"}}>
          <WaitlistForm/>
        </div>
      </section>

      {/* Founder */}
      <section style={{maxWidth:540,margin:"0 auto 72px",padding:"0 28px"}}>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:36,textAlign:"center"}}>
          <p style={{fontSize:14,color:"#888898",lineHeight:1.85,fontStyle:"italic",margin:"0 0 14px"}}>
            "I built $how Me The Money because I wanted to understand my own money without handing my bank statements to a company I'd never heard of. Turns out a lot of people feel the same way."
          </p>
          <div style={{fontSize:13,color:"#555568"}}>— Leon, Founder</div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"22px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,maxWidth:940,margin:"0 auto"}}>
        <span style={{fontSize:12,color:"#444454",fontFamily:"'DM Mono',monospace"}}>$how Me The Money</span>
        <div style={{display:"flex",gap:18}}>
          <button onClick={()=>setPrivacyOpen(true)} style={{background:"none",border:"none",color:"#444454",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Privacy</button>
        </div>
      </footer>
    </div>
  </>;
}
