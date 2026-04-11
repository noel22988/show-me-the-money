import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["🍔 Food & Dining","🛒 Groceries","🚗 Transport","🎬 Entertainment","🏥 Health","👕 Shopping","💡 Utilities","✈️ Travel","📦 Other"];
const CAT_COLORS = {"🍔 Food & Dining":"#FF6B6B","🛒 Groceries":"#51CF66","🚗 Transport":"#339AF0","🎬 Entertainment":"#CC5DE8","🏥 Health":"#FF922B","👕 Shopping":"#F06595","💡 Utilities":"#FAB005","✈️ Travel":"#20C997","📦 Other":"#868E96"};
const CURRENCIES = ["SGD","USD","MYR","AUD","GBP","EUR","JPY","HKD","THB","IDR"];
const CURRENCY_SYMBOLS = {"SGD":"S$","USD":"$","MYR":"RM","AUD":"A$","GBP":"£","EUR":"€","JPY":"¥","HKD":"HK$","THB":"฿","IDR":"Rp"};
const STREAM_TYPES = ["fixed","variable","oneoff"];
const HABIT_THRESHOLD = 3;
const todayStr = () => new Date().toISOString().split("T")[0];
const monthKey = d => d.slice(0,7);
const currentMonth = () => monthKey(todayStr());
const monthLabel = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"long",year:"numeric"}); } catch { return m; }};
const prevMonth = m => { const [y,mo]=m.split("-"); const d=new Date(+y,+mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const greeting = () => { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };

const DEFAULT_STREAMS = [
  { id:"s1", name:"Salary", type:"fixed", defaultAmount:0, active:true },
];
const DEFAULT_PROFILE = {
  name:"", occupation:"", currency:"SGD", avatar:"",
  incomeStreams: DEFAULT_STREAMS,
  fixedCommitments:[{id:"c1",name:"Insurance",amount:0},{id:"c2",name:"Investments",amount:0},{id:"c3",name:"Loan Repayment",amount:0}],
  goals:[], onboarded:false, accentColor:"#C8FF57", bgColor:"#0C0C12"
};

// ── localStorage (deployment-ready) ─────────────────────────────────────────
function lsLoad(key){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):null; }catch{ return null; } }
function lsSave(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch(e){ console.error(e); } }

// ── Colour Engine ────────────────────────────────────────────────────────────
function hexToRgb(hex){ const h=hex.replace("#",""); const f=h.length===3?h.split("").map(c=>c+c).join(""):h; const n=parseInt(f,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join(""); }
function luminance({r,g,b}){ const s=[r,g,b].map(v=>{const c=v/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}); return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2]; }
function contrastRatio(a,b){ const la=luminance(a),lb=luminance(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
function isLight(hex){ return luminance(hexToRgb(hex))>0.25; }
function mixHex(hex,target,pct){ const a=hexToRgb(hex),b=hexToRgb(target); return rgbToHex(a.r+(b.r-a.r)*pct,a.g+(b.g-a.g)*pct,a.b+(b.b-a.b)*pct); }
function ensureContrast(accent,bg,minRatio=3.5){
  let hex=accent; let a=hexToRgb(hex); let itr=0;
  while(contrastRatio(a,hexToRgb(bg))<minRatio&&itr<24){ hex=isLight(bg)?mixHex(hex,"#000000",0.1):mixHex(hex,"#ffffff",0.1); a=hexToRgb(hex); itr++; }
  return {hex,adjusted:itr>2};
}
function buildTheme(accentRaw,bgRaw){
  const bg=bgRaw||"#0C0C12";
  const {hex:accent,adjusted}=ensureContrast(accentRaw||"#C8FF57",bg);
  const bgLight=isLight(bg);
  const surface=bgLight?mixHex(bg,"#000000",0.08):mixHex(bg,"#ffffff",0.06);
  const surface2=bgLight?mixHex(bg,"#000000",0.04):mixHex(bg,"#ffffff",0.03);
  const border=bgLight?mixHex(bg,"#000000",0.16):mixHex(bg,"#ffffff",0.09);
  const borderMid=bgLight?mixHex(bg,"#000000",0.24):mixHex(bg,"#ffffff",0.15);
  const textPrimary=bgLight?"#111118":"#EEEAE0";
  const textSecondary=bgLight?"#4A4A5A":"#888898";
  const textMuted=bgLight?"#8A8A9A":"#444454";
  const accentText=isLight(accent)?"#0C0C12":"#FFFFFF";
  const positive=bgLight?"#1A7A40":"#51CF66";
  const negative=bgLight?"#C0202A":"#FF6B6B";
  const warning=bgLight?"#A06800":"#FAB005";
  const info=bgLight?"#1060B0":"#60AAFF";
  const cardShadow=bgLight?"0 1px 4px rgba(0,0,0,0.09)":"none";
  return {bg,surface,surface2,border,borderMid,accent,accentText,accentMuted:accent+"20",accentBorder:accent+"40",positive,negative,warning,info,textPrimary,textSecondary,textMuted,bgLight,cardShadow,accentAdjusted:adjusted};
}

// ── Theme Context ────────────────────────────────────────────────────────────
const ThemeCtx = createContext(buildTheme("#C8FF57","#0C0C12"));
const useTheme = () => useContext(ThemeCtx);

// ── Income helpers ────────────────────────────────────────────────────────────
function getMonthStreams(streams, monthOverrides){
  // Returns [{stream, amount}] for a given month
  return (streams||[]).filter(s=>s.active).map(s=>{
    const override = (monthOverrides||{})[s.id];
    if(s.type==="fixed") return {stream:s, amount: override!==undefined ? override : s.defaultAmount};
    if(s.type==="variable") return {stream:s, amount: override!==undefined ? override : null};
    if(s.type==="oneoff") return {stream:s, amount: override!==undefined ? override : null};
    return {stream:s, amount:0};
  });
}
function totalIncome(streams, monthOverrides){
  return getMonthStreams(streams, monthOverrides).reduce((s,{amount})=>s+(amount||0),0);
}
function pendingVariableStreams(streams, monthOverrides){
  return getMonthStreams(streams, monthOverrides).filter(({stream,amount})=>(stream.type==="variable")&&amount===null);
}

// ── Habit helpers ─────────────────────────────────────────────────────────────
function habitFlags(eh,ch){ const mf={},cf={}; for(const [k,v] of Object.entries(eh||{})) if(v>=HABIT_THRESHOLD) mf[k]=v; for(const [k,v] of Object.entries(ch||{})) if(v>=HABIT_THRESHOLD) cf[k]=v; return {mf,cf}; }
function habitReason(tx,mf,cf){ const k=tx.description?.toLowerCase().trim(); if(mf[k]) return `excluded ${mf[k]}× before`; if(cf[tx.category]) return `category excluded ${cf[tx.category]}× before`; return null; }

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(monthlyData){
  const rows=[["Date","Description","Category","Amount","Month"]];
  Object.entries(monthlyData).sort().forEach(([month,md])=>{ (md.txs||[]).forEach(t=>{ rows.push([t.date,`"${(t.description||"").replace(/"/g,'""')}"`,t.category,t.amount.toFixed(2),month]); }); });
  const csv=rows.map(r=>r.join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`spending-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}
function countAllTx(monthlyData){ return Object.values(monthlyData).reduce((s,md)=>s+(md.txs||[]).length,0); }

// ── Shared UI Primitives ──────────────────────────────────────────────────────
function useInpStyle(){ const T=useTheme(); return {padding:"9px 12px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}; }
function Card({children,style}){ const T=useTheme(); return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",boxShadow:T.cardShadow,...style}}>{children}</div>; }
function SLabel({children,style}){ const T=useTheme(); return <p style={{margin:"0 0 8px",fontSize:10,letterSpacing:2,color:T.textMuted,textTransform:"uppercase",fontFamily:"'DM Mono'",...style}}>{children}</p>; }
function AccentBtn({children,onClick,disabled,style}){ const T=useTheme(); return <button onClick={onClick} disabled={disabled} style={{padding:"12px",background:disabled?T.border:T.accent,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:14,color:disabled?T.textMuted:T.accentText,cursor:disabled?"default":"pointer",width:"100%",...style}}>{children}</button>; }
function GhostBtn({children,onClick,style}){ const T=useTheme(); return <button onClick={onClick} style={{padding:"9px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer",...style}}>{children}</button>; }
function Checkbox({checked,onChange}){ const T=useTheme(); return <div onClick={onChange} style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${checked?T.accent:T.borderMid}`,background:checked?T.accentMuted:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>{checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>; }
function Toast({msg,onDone}){ const T=useTheme(); useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:T.accent,color:T.accentText,borderRadius:20,padding:"8px 20px",fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",pointerEvents:"none"}}>{msg}</div>; }
function Delta({current,previous,higherIsBetter=true,suffix="",fmtFn}){
  const T=useTheme(); if(!previous||previous===0) return null;
  const diff=current-previous; const good=higherIsBetter?diff>=0:diff<=0;
  const sign=diff>=0?"+":"";
  const display=fmtFn?(sign+(diff>=0?fmtFn(diff):"-"+fmtFn(Math.abs(diff)))):`${sign}${diff.toFixed(1)}${suffix}`;
  return <span style={{fontSize:11,color:good?T.positive:T.negative,fontFamily:"'DM Mono'",marginLeft:6}}>{display} vs last mo</span>;
}

// ── Month Picker ──────────────────────────────────────────────────────────────
function MonthPicker({value,onChange}){
  const T=useTheme(); const inp=useInpStyle();
  const [open,setOpen]=useState(false); const [typed,setTyped]=useState(value);
  useEffect(()=>setTyped(value),[value]);
  const months=[]; const now=new Date();
  for(let i=0;i<36;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);}
  return <div style={{position:"relative"}}>
    <button onClick={()=>setOpen(o=>!o)} style={{...inp,width:"auto",padding:"6px 12px",color:T.accent,background:T.surface,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono'"}}>{monthLabel(value)} ▾</button>
    {open&&<div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:T.surface,border:`1px solid ${T.borderMid}`,borderRadius:10,zIndex:200,maxHeight:220,overflowY:"auto",minWidth:190}}>
      <div style={{padding:"8px"}}><input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&/^\d{4}-\d{2}$/.test(typed)){onChange(typed);setOpen(false);}}} placeholder="YYYY-MM" style={{...inp,fontSize:12}}/></div>
      {months.map(m=><div key={m} onClick={()=>{onChange(m);setOpen(false);}} style={{padding:"8px 14px",fontSize:13,color:m===value?T.accent:T.textSecondary,cursor:"pointer",fontFamily:"'DM Mono'",background:m===value?T.accentMuted:"transparent"}}>{monthLabel(m)}</div>)}
    </div>}
  </div>;
}

// ── Colour Picker ─────────────────────────────────────────────────────────────
function ColourPicker({label,value,bg,onChange}){
  const T=useTheme(); const inp=useInpStyle();
  const [hex,setHex]=useState(value); const [showAdj,setShowAdj]=useState(false);
  useEffect(()=>setHex(value),[value]);
  const commit=v=>{ if(/^#[0-9A-Fa-f]{6}$/.test(v)){ const {adjusted}=ensureContrast(v,bg||"#0C0C12"); if(adjusted){setShowAdj(true);setTimeout(()=>setShowAdj(false),3000);} onChange(v); } };
  return <div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:"'DM Mono'"}}>{label}</div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <div style={{position:"relative",width:44,height:44,borderRadius:10,overflow:"hidden",border:`1px solid ${T.borderMid}`,flexShrink:0}}>
        <div style={{position:"absolute",inset:0,background:value,borderRadius:10,pointerEvents:"none"}}/>
        <input type="color" value={value} onChange={e=>{setHex(e.target.value);commit(e.target.value);}} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/>
      </div>
      <div style={{flex:1}}>
        <input value={hex} onChange={e=>{setHex(e.target.value);if(/^#[0-9A-Fa-f]{6}$/.test(e.target.value))commit(e.target.value);}} onBlur={e=>commit(e.target.value)} style={{...inp,fontFamily:"'DM Mono'",fontSize:13}} placeholder="#000000" maxLength={7}/>
        {showAdj&&<div style={{fontSize:10,color:T.warning,marginTop:3,fontFamily:"'DM Mono'"}}>↳ Adjusted slightly for readability</div>}
      </div>
    </div>
  </div>;
}

// ── Live Theme Preview ────────────────────────────────────────────────────────
function ThemePreview({accentColor,bgColor}){
  const T=useMemo(()=>buildTheme(accentColor,bgColor),[accentColor,bgColor]);
  const sym="S$";
  return <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,background:T.bg,fontFamily:"'DM Sans',sans-serif"}}>
    <div style={{background:T.bg,padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.accent,fontWeight:700}}>A</div>
        <span style={{fontSize:11,fontWeight:600,color:T.textPrimary}}>Alex</span>
      </div>
      <div style={{display:"flex",gap:0}}>{["Home","Add","Money"].map((l,i)=><span key={l} style={{fontSize:9,padding:"3px 7px",color:i===0?T.accent:T.textMuted,borderBottom:`1.5px solid ${i===0?T.accent:"transparent"}`}}>{l}</span>)}</div>
    </div>
    <div style={{padding:"10px 12px 10px"}}>
      <div style={{background:T.surface,borderRadius:10,padding:"10px 12px",boxShadow:T.cardShadow,marginBottom:8}}>
        <div style={{fontSize:9,color:T.textMuted,marginBottom:6}}>Good morning, Alex 👋</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          <div style={{background:T.bg,borderRadius:7,padding:"7px 9px"}}><div style={{fontSize:8,color:T.textMuted,marginBottom:2}}>Spent</div><div style={{fontSize:13,fontWeight:600,color:T.negative,fontFamily:"'DM Mono'"}}>{sym}1,240</div></div>
          <div style={{background:T.bg,borderRadius:7,padding:"7px 9px"}}><div style={{fontSize:8,color:T.textMuted,marginBottom:2}}>Saved</div><div style={{fontSize:13,fontWeight:600,color:T.positive,fontFamily:"'DM Mono'"}}>{sym}860</div></div>
        </div>
        <div style={{height:3,background:T.border,borderRadius:3,overflow:"hidden",marginBottom:3}}><div style={{height:"100%",width:"41%",background:T.positive,borderRadius:3}}/></div>
        <div style={{fontSize:8,color:T.textMuted}}>Savings rate 41%</div>
      </div>
      <div style={{background:T.accent+"12",border:`1px solid ${T.accent}30`,borderRadius:8,padding:"7px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:9,color:T.accent,fontWeight:500}}>Import April statement</span>
        <span style={{fontSize:11,color:T.accent,opacity:.7}}>→</span>
      </div>
      <div style={{background:T.surface,borderRadius:8,padding:"7px 10px",display:"flex",alignItems:"center",gap:7,boxShadow:T.cardShadow}}>
        <div style={{width:22,height:22,borderRadius:5,background:"#FF6B6B22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>🍔</div>
        <div style={{flex:1}}><div style={{fontSize:9,color:T.textPrimary,fontWeight:500}}>Starbucks</div><div style={{fontSize:8,color:T.textMuted}}>Food & Dining</div></div>
        <div style={{fontSize:10,fontFamily:"'DM Mono'",color:T.textPrimary}}>{sym}6.50</div>
        <div style={{border:`1px solid ${T.borderMid}`,borderRadius:4,padding:"1px 5px",fontSize:8,color:T.textSecondary}}>✎</div>
      </div>
    </div>
  </div>;
}

// ── Tx Row ────────────────────────────────────────────────────────────────────
function TxRow({tx,onToggle,onDelete,onEdit,fmt,showCheck,dimmed}){
  const T=useTheme(); const inp=useInpStyle();
  const [editing,setEditing]=useState(false); const [draft,setDraft]=useState(tx);
  useEffect(()=>setDraft(tx),[tx.id]);
  if(editing) return <div style={{background:T.surface,borderRadius:11,padding:"12px",border:`1px solid ${T.accent}60`}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
      <input value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} style={{...inp,gridColumn:"1/-1"}} placeholder="Description"/>
      <input type="number" value={draft.amount} onChange={e=>setDraft(d=>({...d,amount:parseFloat(e.target.value)||0}))} style={inp} placeholder="Amount"/>
      <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={inp}/>
      <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))} style={{...inp,gridColumn:"1/-1"}}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
    </div>
    <div style={{display:"flex",gap:7}}>
      <AccentBtn onClick={()=>{onEdit(draft);setEditing(false);}} style={{padding:"8px",fontSize:13}}>Save</AccentBtn>
      <GhostBtn onClick={()=>setEditing(false)} style={{padding:"8px",fontSize:13,flex:1}}>Cancel</GhostBtn>
    </div>
  </div>;
  return <div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,borderRadius:11,padding:"11px 13px",border:`1px solid ${dimmed&&!tx.checked?T.border:T.borderMid}`,opacity:dimmed&&!tx.checked?0.45:1,transition:"opacity .15s",boxShadow:T.cardShadow}}>
    {showCheck&&<Checkbox checked={tx.checked} onChange={()=>onToggle(tx.id)}/>}
    <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:(CAT_COLORS[tx.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{tx.category.split(" ")[0]}</div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:showCheck&&!tx.checked?T.textMuted:T.textPrimary}}>
        {tx.description}{tx.source==="imported"&&<span style={{marginLeft:6,fontSize:9,color:T.accent,opacity:.5,fontFamily:"'DM Mono'",letterSpacing:1}}>AI</span>}
      </div>
      <div style={{display:"flex",gap:6,marginTop:2,alignItems:"center"}}>
        <span style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{tx.date}</span>
        <span style={{fontSize:11,color:T.textMuted}}>{tx.category.split(" ").slice(1).join(" ")}</span>
        {tx.habitReason&&<span style={{fontSize:10,color:T.accent,opacity:.6,fontFamily:"'DM Mono'",border:`1px solid ${T.accentBorder}`,borderRadius:4,padding:"1px 5px"}}>{tx.habitReason}</span>}
      </div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:500,color:showCheck&&!tx.checked?T.textMuted:T.textPrimary,flexShrink:0}}>{fmt(tx.amount)}</div>
    {onEdit&&<button onClick={()=>setEditing(true)} title="Edit" style={{background:"none",border:`1px solid ${T.borderMid}`,borderRadius:6,color:T.textSecondary,cursor:"pointer",fontSize:12,padding:"3px 7px",flexShrink:0,marginLeft:2}}>✎</button>}
    {onDelete&&<button onClick={()=>onDelete(tx.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:17,padding:"0 2px",flexShrink:0}}>×</button>}
  </div>;
}

// ── Insight Cards ─────────────────────────────────────────────────────────────
function InsightCards({text}){ const T=useTheme(); if(!text) return null; const items=text.split(/\n+/).filter(l=>l.trim()).map(l=>l.replace(/^\d+[\.\)]\s*/,"").replace(/^[-•]\s*/,"").trim()).filter(Boolean); return <div style={{display:"flex",flexDirection:"column",gap:8}}>{items.map((item,i)=><div key={i} style={{background:T.surface2,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`,display:"flex",gap:10}}><span style={{fontSize:11,color:T.accent,fontFamily:"'DM Mono'",fontWeight:600,flexShrink:0,marginTop:1}}>{String(i+1).padStart(2,"0")}</span><span style={{fontSize:13,color:T.textSecondary,lineHeight:1.65}}>{item}</span></div>)}</div>; }

// ── Income Breakdown Card ─────────────────────────────────────────────────────
function IncomeBreakdown({streams,monthOverrides,prevMonthOverrides,prevStreams,fmt}){
  const T=useTheme();
  const rows=getMonthStreams(streams,monthOverrides);
  const prevRows=getMonthStreams(prevStreams||streams,prevMonthOverrides);
  const total=rows.reduce((s,{amount})=>s+(amount||0),0);
  const typeColor=t=>t==="fixed"?T.info:t==="variable"?T.warning:T.positive;
  const typeLabel=t=>t==="fixed"?"Fixed":t==="variable"?"Variable":"One-off";
  return <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {rows.map(({stream,amount})=>{
      const prev=prevRows.find(r=>r.stream.id===stream.id);
      const prevAmt=prev?.amount||0;
      return <div key={stream.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:typeColor(stream.type),flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,color:T.textPrimary,fontWeight:500}}>{stream.name}</div>
          <div style={{fontSize:10,color:typeColor(stream.type),fontFamily:"'DM Mono'"}}>{typeLabel(stream.type)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'DM Mono'",fontSize:13,color:amount===null?T.textMuted:T.textPrimary}}>{amount===null?"—":fmt(amount)}</div>
          {prevAmt>0&&amount!==null&&<div style={{fontSize:10,color:amount>=prevAmt?T.positive:T.negative,fontFamily:"'DM Mono'"}}>{amount>=prevAmt?"+":""}{fmt(amount-prevAmt)}</div>}
        </div>
      </div>;
    })}
    <div style={{display:"flex",justifyContent:"space-between",paddingTop:6}}>
      <span style={{fontSize:12,color:T.textMuted}}>Total income</span>
      <span style={{fontFamily:"'DM Mono'",fontSize:14,color:T.positive,fontWeight:600}}>{fmt(total)}</span>
    </div>
  </div>;
}

// ── Variable Income Entry ─────────────────────────────────────────────────────
function VariableIncomeEntry({streams,monthOverrides,onUpdate,fmt}){
  const T=useTheme(); const inp=useInpStyle();
  const pending=pendingVariableStreams(streams,monthOverrides);
  if(pending.length===0) return null;
  return <Card style={{border:`1px solid ${T.warning}40`,background:T.warning+"08"}}>
    <SLabel style={{color:T.warning}}>Variable Income — {pending.length} stream{pending.length>1?"s":""} need amounts</SLabel>
    {pending.map(({stream})=>(
      <div key={stream.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:T.textSecondary,marginBottom:3}}>{stream.name}</div>
          <input type="number" placeholder="Enter amount" style={inp}
            onBlur={e=>{ const v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0) onUpdate(stream.id,v); }}
            onKeyDown={e=>{ if(e.key==="Enter"){ const v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0){onUpdate(stream.id,v);e.target.value="";}}}}/>
        </div>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.warning,flexShrink:0,marginTop:16}}/>
      </div>
    ))}
  </Card>;
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const T=useTheme(); const inp=useInpStyle();
  const [step,setStep]=useState(0);
  const [p,setP]=useState({name:"",currency:"SGD",occupation:"",incomeStreams:[{id:"s1",name:"Salary",type:"fixed",defaultAmount:"",active:true}],fixedCommitments:[{id:"c1",name:"Insurance",amount:""},{id:"c2",name:"Investments",amount:""},{id:"c3",name:"Loan Repayment",amount:""}]});
  const avatarRef=useRef();
  const handleAvatar=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setP(v=>({...v,avatar:r.result})); r.readAsDataURL(f); };
  const finish=()=>onComplete({...DEFAULT_PROFILE,...p,incomeStreams:p.incomeStreams.map(s=>({...s,defaultAmount:parseFloat(s.defaultAmount)||0})),fixedCommitments:p.fixedCommitments.map(c=>({...c,amount:parseFloat(c.amount)||0})),onboarded:true});

  const steps=[
    <div key="s0">
      <p style={{margin:"0 0 4px",fontSize:22,fontWeight:600,color:T.textPrimary}}>Welcome 👋</p>
      <p style={{margin:"0 0 24px",fontSize:14,color:T.textSecondary,lineHeight:1.6}}>Show Me The Money — your personal finance tracker. Setup takes about a minute.</p>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div onClick={()=>avatarRef.current.click()} style={{width:72,height:72,borderRadius:"50%",background:T.accentMuted,border:`2px dashed ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
          {p.avatar?<img src={p.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28,color:T.accent,opacity:.7}}>+</span>}
        </div>
        <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <input placeholder="Your name *" value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))} style={inp}/>
        <input placeholder="Occupation (optional)" value={p.occupation||""} onChange={e=>setP(v=>({...v,occupation:e.target.value}))} style={inp}/>
        <select value={p.currency} onChange={e=>setP(v=>({...v,currency:e.target.value}))} style={inp}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      <AccentBtn onClick={()=>p.name.trim()&&setStep(1)} disabled={!p.name.trim()} style={{marginTop:20}}>Continue →</AccentBtn>
    </div>,

    <div key="s1">
      <p style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:T.textPrimary}}>Income streams</p>
      <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary,lineHeight:1.6}}>Add all your income sources. Fixed = same every month. Variable = you enter it each month.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {p.incomeStreams.map((s,i)=>(
          <div key={s.id} style={{background:T.surface2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
              <input placeholder="Stream name (e.g. Salary)" value={s.name} onChange={e=>setP(v=>({...v,incomeStreams:v.incomeStreams.map(x=>x.id===s.id?{...x,name:e.target.value}:x)}))} style={inp}/>
              {i>0&&<button onClick={()=>setP(v=>({...v,incomeStreams:v.incomeStreams.filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,flexShrink:0}}>
                {["fixed","variable","oneoff"].map(t=>(
                  <button key={t} onClick={()=>setP(v=>({...v,incomeStreams:v.incomeStreams.map(x=>x.id===s.id?{...x,type:t}:x)}))}
                    style={{padding:"5px 8px",background:s.type===t?T.accent:"transparent",border:"none",color:s.type===t?T.accentText:T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?600:400}}>
                    {t==="oneoff"?"One-off":t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
              {s.type==="fixed"&&<input type="number" placeholder="Monthly amount" value={s.defaultAmount} onChange={e=>setP(v=>({...v,incomeStreams:v.incomeStreams.map(x=>x.id===s.id?{...x,defaultAmount:e.target.value}:x)}))} style={{...inp,flex:1}}/>}
              {s.type!=="fixed"&&<div style={{flex:1,padding:"5px 12px",background:T.border,borderRadius:9,fontSize:12,color:T.textMuted,display:"flex",alignItems:"center"}}>Enter amount each month</div>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={()=>setP(v=>({...v,incomeStreams:[...v.incomeStreams,{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:"",active:true}]}))}
        style={{padding:"8px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:9,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%",marginBottom:16}}>+ Add income stream</button>
      <AccentBtn onClick={()=>setStep(2)}>Continue →</AccentBtn>
      <GhostBtn onClick={()=>setStep(2)} style={{marginTop:8,width:"100%",textAlign:"center"}}>Skip for now</GhostBtn>
    </div>,

    <div key="s2">
      <p style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:T.textPrimary}}>Fixed commitments</p>
      <p style={{margin:"0 0 20px",fontSize:13,color:T.textSecondary,lineHeight:1.6}}>Insurance, investments, loans — things that go out every month.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {p.fixedCommitments.map(c=>(
          <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
            <input placeholder={c.name} value={c.name} onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,name:e.target.value}:x)}))} style={inp}/>
            <input type="number" placeholder="0" value={c.amount} onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,amount:e.target.value}:x)}))} style={{...inp,width:100}}/>
          </div>
        ))}
      </div>
      <AccentBtn onClick={finish}>Let's go →</AccentBtn>
    </div>
  ];

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
    <div style={{width:"100%",maxWidth:420}}>
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:32}}>
        {[0,1,2].map(i=><div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i===step?T.accent:i<step?T.accentBorder:T.border,transition:"all .3s"}}/>)}
      </div>
      {steps[step]}
    </div>
  </div>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("home");
  const [selectedMonth,setSelectedMonth]=useState(currentMonth());
  const [profile,setProfile]=useState(null);
  const [monthlyData,setMonthlyData]=useState({});
  const [excludeHistory,setExcludeHistory]=useState({});
  const [catExcludeHistory,setCatExcludeHistory]=useState({});
  const [pendingTxs,setPendingTxs]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [uploadMsg,setUploadMsg]=useState("");
  const [form,setForm]=useState({date:todayStr(),description:"",category:CATEGORIES[0],amount:""});
  const [insights,setInsights]=useState({text:"",timestamp:null});
  const [loadingInsights,setLoadingInsights]=useState(false);
  const [toast,setToast]=useState("");
  const [quickAddOpen,setQuickAddOpen]=useState(false);
  const [editHintSeen,setEditHintSeen]=useState(false);
  const [catFilter,setCatFilter]=useState("All");
  const [liveAccent,setLiveAccent]=useState(null);
  const [liveBg,setLiveBg]=useState(null);
  const fileRef=useRef();

  // Load from localStorage
  useEffect(()=>{
    const p=lsLoad("profile"); setProfile(p||DEFAULT_PROFILE);
    const md=lsLoad("monthlyData"); if(md) setMonthlyData(md);
    const eh=lsLoad("excludeHistory"); if(eh) setExcludeHistory(eh);
    const ch=lsLoad("catExcludeHistory"); if(ch) setCatExcludeHistory(ch);
    const ins=lsLoad("insights"); if(ins) setInsights(ins);
    const ehs=lsLoad("editHintSeen"); if(ehs) setEditHintSeen(true);
  },[]);

  // Live theme — applies immediately as colour pickers move
  const theme=useMemo(()=>buildTheme(
    liveAccent||profile?.accentColor||"#C8FF57",
    liveBg||profile?.bgColor||"#0C0C12"
  ),[liveAccent,liveBg,profile?.accentColor,profile?.bgColor]);
  const T=theme;

  const dismissEditHint=useCallback(async()=>{ setEditHintSeen(true); lsSave("editHintSeen",true); },[]);
  const fmt=useCallback(n=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; return sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2}); },[profile?.currency]);

  const {mf,cf}=useMemo(()=>habitFlags(excludeHistory,catExcludeHistory),[excludeHistory,catExcludeHistory]);
  const getMD=useCallback(m=>monthlyData[m]||{txs:[],incomeOverrides:{},fixedOverrides:null},[monthlyData]);
  const md=useMemo(()=>getMD(selectedMonth),[getMD,selectedMonth]);
  const committedTxs=md.txs||[];
  const incomeStreams=profile?.incomeStreams||DEFAULT_STREAMS;
  const monthIncomeOverrides=md.incomeOverrides||{};
  const monthFixed=md.fixedOverrides||profile?.fixedCommitments||[];
  const monthIncomeTotal=useMemo(()=>totalIncome(incomeStreams,monthIncomeOverrides),[incomeStreams,monthIncomeOverrides]);
  const totalVariable=useMemo(()=>committedTxs.reduce((s,t)=>s+t.amount,0),[committedTxs]);
  const totalFixed=useMemo(()=>monthFixed.reduce((s,c)=>s+(+c.amount||0),0),[monthFixed]);
  const saved=monthIncomeTotal-totalVariable-totalFixed;
  const savingsRate=monthIncomeTotal>0?(saved/monthIncomeTotal*100):0;
  const byCategory=useMemo(()=>{ const m={}; committedTxs.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); },[committedTxs]);
  const topCat=byCategory[0];
  const monthsWithData=useMemo(()=>Object.keys(monthlyData).length,[monthlyData]);
  const hasImport=!!(monthlyData[selectedMonth]?.txs?.some(t=>t.source==="imported"));
  const pendingVars=useMemo(()=>pendingVariableStreams(incomeStreams,monthIncomeOverrides),[incomeStreams,monthIncomeOverrides]);

  const pm=useMemo(()=>prevMonth(selectedMonth),[selectedMonth]);
  const pmd=useMemo(()=>getMD(pm),[getMD,pm]);
  const prevIncomeOverrides=pmd.incomeOverrides||{};
  const prevTotalVariable=useMemo(()=>(pmd.txs||[]).reduce((s,t)=>s+t.amount,0),[pmd]);
  const prevFixed=(pmd.fixedOverrides||profile?.fixedCommitments||[]).reduce((s,c)=>s+(+c.amount||0),0);
  const prevIncomeTotal=useMemo(()=>totalIncome(incomeStreams,prevIncomeOverrides),[incomeStreams,prevIncomeOverrides]);
  const prevSaved=prevIncomeTotal-prevTotalVariable-prevFixed;
  const prevSavingsRate=prevIncomeTotal>0?(prevSaved/prevIncomeTotal*100):0;

  const {included,flagged}=useMemo(()=>{ const inc=[],fl=[]; pendingTxs.forEach(t=>{ const r=habitReason(t,mf,cf); if(r&&!t.checked) fl.push({...t,habitReason:r}); else inc.push({...t,habitReason:habitReason(t,mf,cf)}); }); return {included:inc,flagged:fl}; },[pendingTxs,mf,cf]);
  const checkedCount=pendingTxs.filter(t=>t.checked).length;

  // Priority nudge — one at a time
  const nudge=useMemo(()=>{
    if(pendingTxs.length>0) return {color:T.warning,title:`${pendingTxs.length} transactions waiting for review`,sub:"Tap to approve what to include this month",tab:"review"};
    if(pendingVars.length>0) return {color:T.warning,title:`${pendingVars.length} variable income stream${pendingVars.length>1?"s":""} need amounts`,sub:"Tap Add to enter this month's variable income",tab:"add"};
    if(!hasImport) return {color:T.accent,title:`Import ${monthLabel(selectedMonth)} statement`,sub:"Upload your bank statement — Claude does the heavy lifting",tab:"add"};
    if(monthIncomeTotal===0) return {color:T.info,title:"Set up your income streams",sub:"Needed to calculate savings rate and goals",tab:"profile"};
    return null;
  },[pendingTxs.length,pendingVars.length,hasImport,monthIncomeTotal,selectedMonth,T]);

  const saveMonthData=async(month,updates)=>{ const updated={...monthlyData,[month]:{...(monthlyData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),...updates}}; setMonthlyData(updated); lsSave("monthlyData",updated); return updated; };
  const saveProfile=p=>{ setProfile(p); lsSave("profile",p); };
  const showToast=msg=>setToast(msg);

  const updateIncomeOverride=async(streamId,amount)=>{ const updated={...monthIncomeOverrides,[streamId]:amount}; await saveMonthData(selectedMonth,{incomeOverrides:updated}); };

  const commitTransactions=async()=>{
    const checked=pendingTxs.filter(t=>t.checked),unchecked=pendingTxs.filter(t=>!t.checked);
    const newEH={...excludeHistory},newCH={...catExcludeHistory};
    unchecked.forEach(t=>{ const k=t.description?.toLowerCase().trim(); newEH[k]=(newEH[k]||0)+1; newCH[t.category]=(newCH[t.category]||0)+1; });
    checked.forEach(t=>{ const k=t.description?.toLowerCase().trim(); if(newEH[k]) newEH[k]=Math.max(0,newEH[k]-1); });
    const existing=md.txs||[]; const existKeys=new Set(existing.map(t=>`${t.date}|${t.description}|${t.amount}`));
    const fresh=checked.filter(t=>!existKeys.has(`${t.date}|${t.description}|${t.amount}`)).map(({habitReason:_,checked:__,...t})=>t);
    await saveMonthData(selectedMonth,{txs:[...fresh,...existing]});
    setExcludeHistory(newEH); setCatExcludeHistory(newCH); lsSave("excludeHistory",newEH); lsSave("catExcludeHistory",newCH);
    setPendingTxs([]); showToast(`✓ ${fresh.length} transactions added to ${monthLabel(selectedMonth)}`); setTab("home");
  };

  const deleteTx=async id=>{ await saveMonthData(selectedMonth,{txs:committedTxs.filter(t=>t.id!==id)}); showToast("Deleted"); };
  const editTx=async draft=>{ await saveMonthData(selectedMonth,{txs:committedTxs.map(t=>t.id===draft.id?draft:t)}); showToast("Updated"); };

  const addManual=async()=>{
    if(!form.description.trim()||!form.amount||isNaN(+form.amount)||+form.amount<=0) return;
    const tx={id:Date.now(),date:form.date,description:form.description.trim(),category:form.category,amount:parseFloat(form.amount),source:"manual"};
    const month=monthKey(form.date); const ex=(monthlyData[month]||{}).txs||[];
    await saveMonthData(month,{txs:[tx,...ex]});
    setForm(f=>({...f,description:"",amount:""})); showToast("Transaction added"); setQuickAddOpen(false);
    if(month!==selectedMonth) setSelectedMonth(month);
  };

  const handleFile=async e=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true); setUploadMsg("Reading statement…");
    try {
      const base64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      setUploadMsg("Claude is parsing transactions…");
      const prompt=`You are a bank statement parser. Extract ALL transactions without filtering. Return ONLY a valid JSON array, no markdown, no backticks. Each: { "date":"YYYY-MM-DD", "description":"cleaned name", "amount": positive number, "category": one of [${CATEGORIES.map(c=>JSON.stringify(c)).join(",")}] }. Output ONLY the JSON array.`;
      const content=file.name.toLowerCase().endsWith(".pdf")?[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},{type:"text",text:prompt}]:`${prompt}\n\nStatement:\n${atob(base64).slice(0,15000)}`;
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content}]})});
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("").trim().replace(/^```json|^```|```$/gm,"").trim();
      const parsed=JSON.parse(raw); if(!Array.isArray(parsed)||!parsed.length) throw new Error("empty");
      const imported=parsed.map((t,i)=>{ const cat=CATEGORIES.includes(t.category)?t.category:"📦 Other"; const reason=habitReason({description:(t.description||"").toLowerCase().trim(),category:cat},mf,cf); return {id:Date.now()+i,date:t.date||todayStr(),description:t.description||"Unknown",amount:Math.abs(parseFloat(t.amount))||0,category:cat,source:"imported",checked:!reason}; });
      setPendingTxs(imported); setUploadMsg(`✓ Found ${imported.length} transactions`); setTab("review");
    } catch(err){ console.error(err); setUploadMsg("⚠ Couldn't parse. Try a CSV export."); }
    finally{ setUploading(false); e.target.value=""; setTimeout(()=>setUploadMsg(""),6000); }
  };

  const generateInsights=async()=>{
    setLoadingInsights(true);
    try {
      const histText=Object.entries(monthlyData).sort().map(([month,md])=>{ const txs=md.txs||[],inc=totalIncome(incomeStreams,md.incomeOverrides||{}),total=txs.reduce((s,t)=>s+t.amount,0); const byCat={}; txs.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;}); return `${month} | Income: ${inc} | Spending: ${total.toFixed(2)} | Saved: ${(inc-total).toFixed(2)}\nIncome streams: ${getMonthStreams(incomeStreams,md.incomeOverrides||{}).map(({stream,amount})=>`${stream.name}: ${amount||0}`).join(", ")}\n${Object.entries(byCat).map(([c,a])=>`  ${c}: ${a.toFixed(2)}`).join("\n")}`; }).join("\n\n");
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:`You are a personal finance advisor. Analyse this spending and income history. Give 5-6 specific, actionable, plain-English insights. Include observations about income stream stability if variable. Use actual numbers. Be direct and friendly. Return each insight as a separate line.\n\n${histText}`}]})});
      const d=await res.json(); const text=d.content?.map(b=>b.text||"").join("").trim();
      const newIns={text,timestamp:new Date().toISOString()}; setInsights(newIns); lsSave("insights",newIns);
    } catch{ setInsights({text:"Couldn't generate insights. Try again.",timestamp:null}); }
    setLoadingInsights(false);
  };

  if(!profile) return <div style={{minHeight:"100vh",background:"#0C0C12",display:"flex",alignItems:"center",justifyContent:"center",color:"#444",fontFamily:"'DM Mono'",fontSize:13}}>Loading…</div>;
  if(!profile.onboarded) return <ThemeCtx.Provider value={buildTheme(profile.accentColor||"#C8FF57",profile.bgColor||"#0C0C12")}><Onboarding onComplete={saveProfile}/></ThemeCtx.Provider>;

  const inpStyle={padding:"9px 12px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"};
  const TABS=[["home","Home"],["add","Add"],["review","Review"],["money","Money"],["insights","Insights"],["profile","Profile"]];
  const filteredTxs=catFilter==="All"?committedTxs:committedTxs.filter(t=>t.category===catFilter);

  return <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",paddingBottom:80,transition:"background .3s"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}

      {/* Header */}
      <div style={{padding:"20px 20px 0",borderBottom:`1px solid ${T.border}`,background:T.bg,position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {profile.avatar?<img src={profile.avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>
                :<div style={{width:34,height:34,borderRadius:"50%",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.accent,fontWeight:600}}>{profile.name?profile.name[0].toUpperCase():"?"}</div>}
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{profile.name||"Show Me The Money"}</div>
                {profile.occupation&&<div style={{fontSize:11,color:T.textMuted}}>{profile.occupation}</div>}
              </div>
            </div>
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth}/>
          </div>
          <div style={{display:"flex",gap:0,overflowX:"auto"}}>
            {TABS.map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{padding:"9px 13px",background:"none",border:"none",borderBottom:`2px solid ${tab===id?T.accent:"transparent"}`,color:tab===id?T.accent:T.textMuted,fontFamily:"inherit",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",transition:"color .15s",position:"relative"}}>
              {label}{id==="review"&&pendingTxs.length>0&&<span style={{marginLeft:4,background:T.accent,color:T.accentText,borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{pendingTxs.length}</span>}
            </button>)}
          </div>
        </div>
      </div>

      <div style={{maxWidth:560,margin:"0 auto",padding:"0 20px"}}>

        {/* ══ HOME ══ */}
        {tab==="home"&&<div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <p style={{margin:"0 0 4px",fontSize:13,color:T.textSecondary}}>{greeting()}, {(profile.name||"there").split(" ")[0]} 👋</p>
            <p style={{margin:"0 0 16px",fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{monthLabel(selectedMonth)}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>Spent</div>
                <div style={{fontSize:18,fontWeight:600,fontFamily:"'DM Mono'",color:T.negative}}>{fmt(totalVariable)}</div>
                {prevTotalVariable>0&&<Delta current={totalVariable} previous={prevTotalVariable} higherIsBetter={false} fmtFn={fmt}/>}
              </div>
              <div style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>Saved</div>
                {monthIncomeTotal===0
                  ?<div style={{fontSize:11,color:T.textMuted,marginTop:4,lineHeight:1.4,cursor:"pointer"}} onClick={()=>setTab("profile")}>Set up income streams →</div>
                  :<><div style={{fontSize:18,fontWeight:600,fontFamily:"'DM Mono'",color:saved>=0?T.positive:T.negative}}>{fmt(saved)}</div>{prevSaved!==0&&<Delta current={saved} previous={prevSaved} higherIsBetter={true} fmtFn={fmt}/>}</>}
              </div>
            </div>
            {monthIncomeTotal>0&&<>
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:T.textMuted}}>Savings rate</span>
                  <span style={{fontSize:12,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:600}}>
                    {savingsRate.toFixed(1)}%{prevSavingsRate>0&&<Delta current={savingsRate} previous={prevSavingsRate} higherIsBetter={true} suffix="pp"/>}
                  </span>
                </div>
                <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:5,transition:"width .6s ease"}}/>
                </div>
              </div>
              {topCat&&<p style={{margin:0,fontSize:12,color:T.textMuted}}>Biggest: <span style={{color:T.textPrimary}}>{topCat[0]}</span> · <span style={{color:T.accent,fontFamily:"'DM Mono'"}}>{fmt(topCat[1])}</span></p>}
            </>}
          </Card>

          {nudge&&<div onClick={()=>setTab(nudge.tab)} style={{background:nudge.color+"12",border:`1px solid ${nudge.color}30`,borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontSize:13,fontWeight:500,color:nudge.color}}>{nudge.title}</div><div style={{fontSize:12,color:nudge.color,opacity:.7,marginTop:2}}>{nudge.sub}</div></div>
            <span style={{fontSize:18,color:nudge.color,opacity:.6}}>→</span>
          </div>}

          {quickAddOpen
            ?<Card>
              <SLabel>Quick Add</SLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <input type="text" placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addManual()} style={inpStyle}/>
                <input type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addManual()} style={inpStyle}/>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{...inpStyle,gridColumn:"1/-1"}}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inpStyle}/>
                <AccentBtn onClick={addManual} style={{padding:"9px",fontSize:13}}>+ Add</AccentBtn>
                <GhostBtn onClick={()=>setQuickAddOpen(false)} style={{padding:"9px",fontSize:13}}>Cancel</GhostBtn>
              </div>
            </Card>
            :<button onClick={()=>setQuickAddOpen(true)} style={{padding:"12px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:12,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%"}}>+ Quick add transaction</button>}

          {committedTxs.length>0&&<Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <SLabel>Recent</SLabel>
              <span style={{fontSize:12,color:T.accent,cursor:"pointer",opacity:.8}} onClick={()=>setTab("money")}>See all →</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {committedTxs.slice(0,4).map((t,i)=><TxRow key={t.id} tx={t} fmt={fmt} showCheck={false} onEdit={editTx} onDelete={deleteTx}/>)}
            </div>
            {!editHintSeen&&<div style={{marginTop:8,padding:"6px 10px",background:T.accentMuted,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:T.accent}}>Tap ✎ on any transaction to edit it</span>
              <button onClick={dismissEditHint} style={{background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:.7}}>Got it ×</button>
            </div>}
          </Card>}
        </div>}

        {/* ══ ADD ══ */}
        {tab==="add"&&<div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
          {/* Variable income entry */}
          <VariableIncomeEntry streams={incomeStreams} monthOverrides={monthIncomeOverrides} onUpdate={updateIncomeOverride} fmt={fmt}/>

          {/* Fixed income summary */}
          {incomeStreams.filter(s=>s.active&&s.type==="fixed").length>0&&(
            <Card>
              <SLabel>Fixed Income — Auto-populated</SLabel>
              {incomeStreams.filter(s=>s.active&&s.type==="fixed").map(s=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:T.info}}/>
                    <span style={{fontSize:13,color:T.textPrimary}}>{s.name}</span>
                  </div>
                  <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.info}}>{fmt(monthIncomeOverrides[s.id]!==undefined?monthIncomeOverrides[s.id]:s.defaultAmount)}</span>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <SLabel>Import Statement</SLabel>
            <div onClick={()=>!uploading&&fileRef.current.click()} onMouseEnter={e=>{if(!uploading)e.currentTarget.style.borderColor=T.accent+"60";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.borderMid;}}
              style={{border:`2px dashed ${T.borderMid}`,borderRadius:12,padding:"28px 16px",textAlign:"center",cursor:uploading?"default":"pointer",transition:"border-color .2s"}}>
              <div style={{fontSize:28,marginBottom:8}}>{uploading?"⏳":"📄"}</div>
              <p style={{margin:"0 0 4px",fontWeight:600,fontSize:14,color:T.textPrimary}}>{uploading?"Importing…":"Upload bank statement"}</p>
              <p style={{margin:"0 0 14px",color:T.textMuted,fontSize:12}}>PDF or CSV · Claude extracts everything · You approve in Review</p>
              <div style={{display:"inline-block",padding:"8px 20px",background:uploading?T.border:T.accent,color:uploading?T.textMuted:T.accentText,borderRadius:9,fontWeight:600,fontSize:13}}>{uploading?"Working…":"Choose File"}</div>
              {uploadMsg&&<p style={{marginTop:12,fontSize:12,color:uploadMsg.startsWith("✓")?T.positive:T.negative,margin:"12px 0 0"}}>{uploadMsg}</p>}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" style={{display:"none"}} onChange={handleFile}/>
          </Card>

          <Card>
            <SLabel>Add Manually</SLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
              <input type="text" placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addManual()} style={inpStyle}/>
              <input type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addManual()} style={inpStyle}/>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{...inpStyle,gridColumn:"1/-1"}}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inpStyle}/>
              <AccentBtn onClick={addManual} style={{padding:"9px",fontSize:13}}>+ Add</AccentBtn>
            </div>
          </Card>
        </div>}

        {/* ══ REVIEW ══ */}
        {tab==="review"&&<div style={{marginTop:20,paddingBottom:90}}>
          {pendingTxs.length===0
            ?<div style={{textAlign:"center",padding:"52px 0"}}><div style={{fontSize:32,marginBottom:12}}>📋</div><p style={{margin:0,fontSize:14,color:T.textSecondary}}>Nothing to review</p><p style={{margin:"8px 0 0",fontSize:12,color:T.textMuted}}><span style={{color:T.accent,cursor:"pointer"}} onClick={()=>setTab("add")}>Import a statement</span> to get started</p></div>
            :<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div><span style={{fontSize:13,color:T.textSecondary}}>{checkedCount}/{pendingTxs.length} selected</span><span style={{marginLeft:10,fontSize:14,color:T.accent,fontFamily:"'DM Mono'"}}>{fmt(pendingTxs.filter(t=>t.checked).reduce((s,t)=>s+t.amount,0))}</span></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:true})))} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>All</button>
                  <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:false})))} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>None</button>
                </div>
              </div>
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
                {CATEGORIES.filter(c=>pendingTxs.some(t=>t.category===c)).map(c=><button key={c} onClick={()=>{ const all=pendingTxs.filter(t=>t.category===c).every(t=>t.checked); setPendingTxs(p=>p.map(t=>t.category===c?{...t,checked:!all}:t)); }} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textMuted,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>{c.split(" ")[0]}</button>)}
              </div>
              {included.length>0&&<><SLabel>To include ({included.filter(t=>t.checked).length})</SLabel><div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>{included.map(t=><TxRow key={t.id} tx={t} onToggle={id=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,checked:!t.checked}:t))} fmt={fmt} showCheck={true}/>)}</div></>}
              {flagged.length>0&&<>
                <div style={{position:"sticky",top:120,zIndex:10,background:T.bg,paddingBottom:6,paddingTop:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <SLabel style={{margin:0}}>Likely exclude ({flagged.filter(t=>t.checked).length}/{flagged.length})</SLabel>
                    <div style={{flex:1,height:"1px",background:T.border}}/>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20,marginTop:6}}>{flagged.map(t=><TxRow key={t.id} tx={t} onToggle={id=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,checked:!t.checked}:t))} fmt={fmt} showCheck={true} dimmed/>)}</div>
              </>}
            </>}
        </div>}
        {tab==="review"&&pendingTxs.length>0&&<div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 20px 24px",background:`linear-gradient(transparent, ${T.bg} 40%)`,zIndex:100}}>
          <div style={{maxWidth:560,margin:"0 auto"}}><AccentBtn onClick={commitTransactions}>Add {checkedCount} transactions to {monthLabel(selectedMonth)} →</AccentBtn></div>
        </div>}

        {/* ══ MONEY ══ */}
        {tab==="money"&&<div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
          {monthIncomeTotal===0&&<div onClick={()=>setTab("profile")} style={{background:T.info+"12",border:`1px solid ${T.info}30`,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:T.info}}>Set up income streams to see full breakdown →</span></div>}

          {/* Summary */}
          <Card>
            <SLabel>{monthLabel(selectedMonth)}</SLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {[["Income",monthIncomeTotal,T.positive,prevIncomeTotal,true],["Fixed",totalFixed,T.info,prevFixed,false],["Variable",totalVariable,T.negative,prevTotalVariable,false],["Saved",saved,saved>=0?T.positive:T.negative,prevSaved,true]].map(([label,val,color,prev,hib])=>(
                <div key={label} style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>{label}</div>
                  <div style={{fontSize:15,fontWeight:600,fontFamily:"'DM Mono'",color}}>{monthIncomeTotal===0&&label==="Saved"?"—":fmt(val)}</div>
                  {prev!==0&&label!=="Income"&&<div style={{fontSize:11,fontFamily:"'DM Mono'",marginTop:2,color:(val>prev)===hib?T.positive:T.negative}}>{val>prev?"+":""}{fmt(val-prev)}</div>}
                </div>
              ))}
            </div>
            {monthIncomeTotal>0&&<>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:T.textMuted}}>Savings rate</span><span style={{fontSize:12,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:600}}>{savingsRate.toFixed(1)}%{prevSavingsRate>0&&<span style={{fontSize:11,color:savingsRate>=prevSavingsRate?T.positive:T.negative}}> ({savingsRate>=prevSavingsRate?"+":""}{(savingsRate-prevSavingsRate).toFixed(1)}pp)</span>}</span></div>
              <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:5}}/></div>
              <div style={{height:7,borderRadius:5,overflow:"hidden",display:"flex",gap:1,marginBottom:6}}>
                <div style={{width:`${Math.min(100,totalFixed/monthIncomeTotal*100)}%`,background:T.info,transition:"width .5s"}}/>
                <div style={{width:`${Math.min(100,totalVariable/monthIncomeTotal*100)}%`,background:T.negative,transition:"width .5s"}}/>
                <div style={{flex:1,background:T.accentMuted}}/>
              </div>
              <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted}}><span><span style={{color:T.info}}>■</span> Fixed</span><span><span style={{color:T.negative}}>■</span> Variable</span><span><span style={{color:T.accent}}>■</span> Saved</span></div>
            </>}
          </Card>

          {/* Income breakdown */}
          <Card>
            <SLabel>Income Streams</SLabel>
            <IncomeBreakdown streams={incomeStreams} monthOverrides={monthIncomeOverrides} prevMonthOverrides={prevIncomeOverrides} fmt={fmt}/>
          </Card>

          {/* Fixed commitments */}
          <Card>
            <SLabel>Fixed Commitments</SLabel>
            {monthFixed.length===0?<p style={{fontSize:13,color:T.textMuted,margin:0,cursor:"pointer"}} onClick={()=>setTab("profile")}>Add in Profile →</p>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {monthFixed.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.textSecondary}}>{c.name}</span><span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.info}}>{fmt(+c.amount||0)}</span></div>)}
                <div style={{display:"flex",justifyContent:"space-between",paddingTop:4}}><span style={{fontSize:12,color:T.textMuted}}>Total</span><span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.info,fontWeight:600}}>{fmt(totalFixed)}</span></div>
              </div>}
          </Card>

          {/* Variable spending with category filter */}
          <Card>
            <SLabel>Variable Spending</SLabel>
            {byCategory.length===0?<p style={{fontSize:13,color:T.textMuted,margin:0}}><span style={{color:T.accent,cursor:"pointer"}} onClick={()=>setTab("add")}>Import or add transactions</span> to see breakdown</p>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {byCategory.map(([cat,amt])=>{ const pct=totalVariable>0?(amt/totalVariable*100):0; return <div key={cat}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:T.textPrimary}}>{cat}</span><span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.accent}}>{fmt(amt)}</span></div><div style={{height:3,background:T.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:CAT_COLORS[cat]||T.accent,borderRadius:3}}/></div></div>; })}
                <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${T.border}`,marginTop:4}}><span style={{fontSize:12,color:T.textMuted}}>Total variable</span><span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.negative,fontWeight:600}}>{fmt(totalVariable)}</span></div>
              </div>}
          </Card>

          {/* Goals */}
          {profile.goals?.length>0&&<Card><SLabel>Goals</SLabel>{profile.goals.map(g=>{ const totalSaved=Object.values(monthlyData).reduce((s,md)=>{ const inc=totalIncome(incomeStreams,md.incomeOverrides||{}); const spent=(md.txs||[]).reduce((a,t)=>a+t.amount,0); const fix=(md.fixedOverrides||profile.fixedCommitments||[]).reduce((a,c)=>a+(+c.amount||0),0); return s+Math.max(0,inc-spent-fix); },0); const pct=g.target>0?Math.min(100,totalSaved/g.target*100):0; const daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/(1000*60*60*24)):null; return <div key={g.id} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,fontWeight:500,color:T.textPrimary}}>{g.name}</span><span style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{fmt(totalSaved)} / {fmt(g.target)}</span></div><div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden",marginBottom:4}}><div style={{height:"100%",width:`${pct}%`,background:T.accent,borderRadius:5}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted}}><span>{pct.toFixed(1)}% complete</span>{daysLeft!=null&&<span style={{color:daysLeft<30?T.warning:T.textMuted}}>{daysLeft>0?`${daysLeft} days left`:"Past due"}</span>}</div></div>; })}</Card>}

          {/* All transactions with category filter */}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <SLabel style={{margin:0}}>Transactions ({filteredTxs.length})</SLabel>
              {committedTxs.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto"}}>
                {["All",...Object.keys(Object.fromEntries(byCategory))].map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${catFilter===c?T.accent:T.borderMid}`,background:catFilter===c?T.accentMuted:"transparent",color:catFilter===c?T.accent:T.textMuted,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>{c==="All"?"All":c.split(" ")[0]}</button>)}
              </div>}
            </div>
            {filteredTxs.length===0?<p style={{fontSize:13,color:T.textMuted,margin:0}}>No transactions{catFilter!=="All"?` in ${catFilter}`:""} for {monthLabel(selectedMonth)}</p>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>{filteredTxs.map(t=><TxRow key={t.id} tx={t} onDelete={deleteTx} onEdit={editTx} fmt={fmt} showCheck={false}/>)}</div>}
          </Card>
        </div>}

        {/* ══ INSIGHTS ══ */}
        {tab==="insights"&&<div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <SLabel>Claude Insights</SLabel>
                {insights.timestamp&&<p style={{margin:0,fontSize:11,color:T.textMuted}}>Last run: {new Date(insights.timestamp).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>}
                {monthsWithData<3&&<p style={{margin:"4px 0 0",fontSize:11,color:T.textMuted}}>{monthsWithData}/3 months — gets smarter over time</p>}
              </div>
              <button onClick={generateInsights} disabled={loadingInsights||monthsWithData===0} style={{padding:"7px 14px",background:"transparent",border:`1px solid ${monthsWithData>0?T.accentBorder:T.border}`,borderRadius:9,color:monthsWithData>0?T.accent:T.textMuted,fontSize:12,fontFamily:"inherit",cursor:monthsWithData===0?"default":"pointer",flexShrink:0}}>
                {loadingInsights?"Analysing…":insights.text?"Regenerate":"Generate"}
              </button>
            </div>
            {insights.text?<InsightCards text={insights.text}/>:<p style={{fontSize:13,color:T.textMuted,margin:0}}>{monthsWithData===0?"Add some data first.":"Tap Generate to analyse your patterns."}</p>}
          </Card>
          <Card>
            <SLabel>Habit Memory</SLabel>
            {Object.keys(mf).length===0&&Object.keys(cf).length===0
              ?<p style={{fontSize:13,color:T.textMuted,margin:0}}>No patterns learned yet. Review a few imports and the app will start pre-flagging what you always exclude.</p>
              :<>{Object.entries(mf).slice(0,8).map(([m,c])=><div key={m} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textSecondary,marginBottom:6}}><span style={{textTransform:"capitalize"}}>{m}</span><span style={{fontFamily:"'DM Mono'",color:T.accent,opacity:.6}}>excluded {c}×</span></div>)}{Object.entries(cf).map(([c,count])=><div key={c} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textSecondary,marginBottom:6}}><span>{c}</span><span style={{fontFamily:"'DM Mono'",color:T.accent,opacity:.6}}>category {count}×</span></div>)}</>}
          </Card>
        </div>}

        {/* ══ PROFILE ══ */}
        {tab==="profile"&&<ProfileTab profile={profile} onSave={p=>{saveProfile(p);setLiveAccent(null);setLiveBg(null);showToast("Profile saved");}} monthlyData={monthlyData} T={T} inpStyle={inpStyle} onLiveAccent={setLiveAccent} onLiveBg={setLiveBg}/>}
      </div>
    </div>
  </ThemeCtx.Provider>;
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({profile,onSave,monthlyData,T,inpStyle,onLiveAccent,onLiveBg}){
  const [p,setP]=useState(profile);
  const [btnLabel,setBtnLabel]=useState("Save Profile");
  useEffect(()=>setP(profile),[profile.name]);
  const avatarRef=useRef();
  const handleAvatar=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setP(v=>({...v,avatar:r.result})); r.readAsDataURL(f); };

  // Income stream helpers
  const updateStream=(id,field,val)=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.map(s=>s.id===id?{...s,[field]:val}:s)}));
  const addStream=()=>setP(prev=>({...prev,incomeStreams:[...(prev.incomeStreams||[]),{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true}]}));
  const removeStream=id=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.filter(s=>s.id!==id)}));

  const updateFixed=(id,field,val)=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.map(c=>c.id===id?{...c,[field]:val}:c)}));
  const addFixed=()=>setP(prev=>({...prev,fixedCommitments:[...(prev.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:0}]}));
  const removeFixed=id=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.filter(c=>c.id!==id)}));
  const updateGoal=(id,field,val)=>setP(prev=>({...prev,goals:prev.goals.map(g=>g.id===id?{...g,[field]:val}:g)}));
  const addGoal=()=>setP(prev=>({...prev,goals:[...(prev.goals||[]),{id:`g${Date.now()}`,name:"",target:0,date:""}]}));
  const removeGoal=id=>setP(prev=>({...prev,goals:prev.goals.filter(g=>g.id!==id)}));
  const handleSave=()=>{ onSave({...p,onboarded:true}); setBtnLabel("Saved ✓"); setTimeout(()=>setBtnLabel("Save Profile"),2000); };
  const txCount=countAllTx(monthlyData); const moCount=Object.keys(monthlyData).length;
  const typeColor=t=>t==="fixed"?T.info:t==="variable"?T.warning:T.positive;

  return <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
    {/* Identity */}
    <Card>
      <SLabel>Identity</SLabel>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <div onClick={()=>avatarRef.current.click()} style={{width:60,height:60,borderRadius:"50%",background:T.accentMuted,border:`2px dashed ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0}}>
          {p.avatar?<img src={p.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:22,color:T.accent}}>{p.name?p.name[0].toUpperCase():"+"}</span>}
        </div>
        <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
          <input type="text" placeholder="Your name" value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))} style={inpStyle}/>
          <input type="text" placeholder="Occupation" value={p.occupation||""} onChange={e=>setP(v=>({...v,occupation:e.target.value}))} style={inpStyle}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Currency</div><select value={p.currency} onChange={e=>setP(v=>({...v,currency:e.target.value}))} style={inpStyle}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Default theme</div><div style={{fontSize:12,color:T.textSecondary,padding:"9px 0"}}>Set below →</div></div>
      </div>
    </Card>

    {/* Income streams */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Income Streams</SLabel>
        <button onClick={addStream} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      {(p.incomeStreams||[]).map(s=>(
        <div key={s.id} style={{background:T.surface2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`,marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
            <input type="text" placeholder="Stream name" value={s.name} onChange={e=>updateStream(s.id,"name",e.target.value)} style={inpStyle}/>
            <button onClick={()=>removeStream(s.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,flexShrink:0}}>
              {["fixed","variable","oneoff"].map(t=>(
                <button key={t} onClick={()=>updateStream(s.id,"type",t)}
                  style={{padding:"5px 8px",background:s.type===t?typeColor(t):"transparent",border:"none",color:s.type===t?"#fff":T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?600:400,transition:"all .15s"}}>
                  {t==="oneoff"?"One-off":t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            {s.type==="fixed"
              ?<input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>updateStream(s.id,"defaultAmount",parseFloat(e.target.value)||0)} style={{...inpStyle,flex:1}}/>
              :<div style={{flex:1,padding:"5px 12px",background:T.border,borderRadius:9,fontSize:11,color:T.textMuted,display:"flex",alignItems:"center"}}>Enter per month</div>}
          </div>
        </div>
      ))}
      {!(p.incomeStreams||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No income streams yet</p>}
    </Card>

    {/* App theme — live preview */}
    <Card>
      <SLabel>App Theme</SLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <ColourPicker label="Accent Colour" value={p.accentColor||"#C8FF57"} bg={p.bgColor||"#0C0C12"} onChange={v=>{setP(x=>({...x,accentColor:v}));onLiveAccent(v);}}/>
        <ColourPicker label="Background" value={p.bgColor||"#0C0C12"} bg={p.bgColor||"#0C0C12"} onChange={v=>{setP(x=>({...x,bgColor:v}));onLiveBg(v);}}/>
      </div>
      <ThemePreview accentColor={p.accentColor||"#C8FF57"} bgColor={p.bgColor||"#0C0C12"}/>
      <p style={{margin:"8px 0 0",fontSize:11,color:T.textMuted}}>Theme applies live as you pick. Saves when you tap Save Profile.</p>
    </Card>

    {/* Fixed commitments */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Fixed Commitments</SLabel>
        <button onClick={addFixed} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      {(p.fixedCommitments||[]).map(c=><div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:7,marginBottom:7,alignItems:"center"}}>
        <input type="text" placeholder="Name" value={c.name} onChange={e=>updateFixed(c.id,"name",e.target.value)} style={inpStyle}/>
        <input type="number" placeholder="0" value={c.amount||""} onChange={e=>updateFixed(c.id,"amount",parseFloat(e.target.value)||0)} style={{...inpStyle,width:90}}/>
        <button onClick={()=>removeFixed(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
      </div>)}
      {!(p.fixedCommitments||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No fixed commitments yet</p>}
    </Card>

    {/* Goals */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Financial Goals</SLabel>
        <button onClick={addGoal} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      {(p.goals||[]).map(g=><div key={g.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,marginBottom:7,alignItems:"center"}}>
          <input type="text" placeholder="Goal name" value={g.name} onChange={e=>updateGoal(g.id,"name",e.target.value)} style={inpStyle}/>
          <button onClick={()=>removeGoal(g.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          <input type="number" placeholder="Target amount" value={g.target||""} onChange={e=>updateGoal(g.id,"target",parseFloat(e.target.value)||0)} style={inpStyle}/>
          <input type="date" value={g.date||""} onChange={e=>updateGoal(g.id,"date",e.target.value)} style={inpStyle}/>
        </div>
      </div>)}
      {!(p.goals||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No goals set yet</p>}
    </Card>

    {/* Data export */}
    <Card>
      <SLabel>Data</SLabel>
      <p style={{margin:"0 0 10px",fontSize:13,color:T.textSecondary}}>
        {txCount>0?`${txCount} transactions across ${moCount} month${moCount!==1?"s":""} ready to export.`:"No data to export yet."}
      </p>
      <button onClick={()=>txCount>0&&exportCSV(monthlyData)} style={{padding:"10px 16px",background:"transparent",border:`1px solid ${txCount>0?T.border:T.borderMid}`,borderRadius:9,color:txCount>0?T.textSecondary:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:txCount>0?"pointer":"default",width:"100%",opacity:txCount>0?1:0.5}}>
        ⬇ Export all transactions as CSV
      </button>
    </Card>

    <button onClick={handleSave} style={{padding:"13px",background:btnLabel.includes("✓")?T.positive:T.accent,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:14,color:btnLabel.includes("✓")?"#fff":T.accentText,cursor:"pointer",width:"100%",transition:"background .3s",marginBottom:20}}>
      {btnLabel}
    </button>
  </div>;
}
