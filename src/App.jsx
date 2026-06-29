// ════════════════════════════════════════════════════════════════════════════
// $how Me The Money — Calm rebuild · Phase 1 (Home tab functional)
// 3-tab structure (Home · Money · You) with floating + button
// All existing logic preserved (parser, storage, PIN, backups, recurring, etc.)
// Money/You/Review/Upload screens are PLACEHOLDERS in this phase
// ════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { PrivacyModal } from "./Landing.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = ["🍔 Food & Dining","🛒 Groceries","🚗 Transport","🎬 Entertainment","🏥 Health","👕 Shopping","💡 Utilities","✈️ Travel","📦 Other"];
const FIXED_CATS = ["🏠 Rent/Mortgage","💳 Insurance","🏦 Loan Repayment","📱 Subscription","🔒 Investment","💰 Savings Transfer"];
const CAT_COLORS = {"🍔 Food & Dining":"#E8806B","🛒 Groceries":"#6BA368","🚗 Transport":"#5B8FCB","🎬 Entertainment":"#A87BC9","🏥 Health":"#E89656","👕 Shopping":"#D67BA0","💡 Utilities":"#D4A93C","✈️ Travel":"#5BB5A8","📦 Other":"#8B8B96","🏠 Rent/Mortgage":"#5B8FCB","💳 Insurance":"#E8806B","🏦 Loan Repayment":"#D4A93C","📱 Subscription":"#A87BC9","🔒 Investment":"#6BA368","💰 Savings Transfer":"#5BB5A8"};
const CURRENCIES = ["SGD","USD","MYR","AUD","GBP","EUR","JPY","HKD","THB","IDR"];
const CURRENCY_SYMBOLS = {"SGD":"S$","USD":"$","MYR":"RM","AUD":"A$","GBP":"£","EUR":"€","JPY":"¥","HKD":"HK$","THB":"฿","IDR":"Rp"};

const MAX_AUTO_BACKUPS = 7;
const APP_VERSION = "4.0";

const LIGHT_PRESETS = [
  {name:"Calm",   accent:"#1A7A40", bg:"#F6F3EC"},
  {name:"Indigo", accent:"#5C5FEF", bg:"#F7F4ED"},
  {name:"Mist",   accent:"#3D7B8C", bg:"#F2F4F5"},
  {name:"Linen",  accent:"#9C5A3C", bg:"#FAF5EE"},
];
const DARK_PRESETS = [
  {name:"Dusk",     accent:"#A8A6FF", bg:"#16161E"},
  {name:"Midnight", accent:"#C8FF57", bg:"#0C0C12"},
  {name:"Forest",   accent:"#8FD9A8", bg:"#0E1614"},
];
const CALM_DEFAULT_ACCENT = "#1A7A40";
const CALM_DEFAULT_BG     = "#F6F3EC";

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const monthKey = d => d.slice(0,7);
const currentMonth = () => monthKey(todayStr());
const monthLabel = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"long",year:"numeric"}); } catch { return m; }};
const monthLabelShort = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"short",year:"2-digit"}); } catch { return m; }};
const monthLabelUpper = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"long",year:"numeric"}).toUpperCase(); } catch { return m; }};
const prevMonth = m => { const [y,mo]=m.split("-"); const d=new Date(+y,+mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const monthsBetween = (a,b) => { const [ay,am]=a.split("-").map(Number); const [by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); };

const DEFAULT_PROFILE = {
  name:"",occupation:"",currency:"SGD",avatar:"",
  incomeStreams:[],fixedCommitments:[],subscriptions:[],goals:[],
  customCategories:[],budgets:{},
  onboarded:false,
  accentColor: CALM_DEFAULT_ACCENT,
  bgColor:     CALM_DEFAULT_BG,
  startMonth:currentMonth(),
  insightPrefs:["savings_vs_avg"],
  goal:null
};

// ── Storage ───────────────────────────────────────────────────────────────────
function lsLoad(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } }
function lsSave(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ console.error(e); } }
function lsClear(){ ["profile","monthlyData","excludeHistory","catExcludeHistory","insights","autoBackups","editHintSeen","archive","pinHash","tutorialDismissed"].forEach(k=>{ try{localStorage.removeItem(k);}catch(e){} }); }
function hashPin(pin){ let h=0; for(let i=0;i<pin.length;i++){h=((h<<5)-h)+pin.charCodeAt(i);h|=0;} return h.toString(36); }

// ── Colour engine ─────────────────────────────────────────────────────────────
function hexToRgb(hex){ const h=hex.replace("#",""); const f=h.length===3?h.split("").map(c=>c+c).join(""):h; const n=parseInt(f,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join(""); }
function luminance({r,g,b}){ const s=[r,g,b].map(v=>{const c=v/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}); return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2]; }
function contrastRatio(a,b){ const la=luminance(a),lb=luminance(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); }
function isLight(hex){ return luminance(hexToRgb(hex))>0.25; }
function mixHex(hex,target,pct){ const a=hexToRgb(hex),b=hexToRgb(target); return rgbToHex(a.r+(b.r-a.r)*pct,a.g+(b.g-a.g)*pct,a.b+(b.b-a.b)*pct); }
function ensureContrast(accent,bg,minRatio=3.5){ let hex=accent,a=hexToRgb(hex),itr=0; while(contrastRatio(a,hexToRgb(bg))<minRatio&&itr<24){hex=isLight(bg)?mixHex(hex,"#000000",0.1):mixHex(hex,"#ffffff",0.1);a=hexToRgb(hex);itr++;} return {hex}; }
function buildTheme(accentRaw,bgRaw){
  const bg=bgRaw||CALM_DEFAULT_BG; const {hex:accent}=ensureContrast(accentRaw||CALM_DEFAULT_ACCENT,bg); const light=isLight(bg);
  const surface=light?"#FFFFFF":mixHex(bg,"#ffffff",0.07);
  const surface2=light?mixHex(bg,"#000000",0.025):mixHex(bg,"#ffffff",0.04);
  const border=light?"#E8E3D7":mixHex(bg,"#ffffff",0.1);
  const borderSoft=light?mixHex(bg,"#000000",0.05):mixHex(bg,"#ffffff",0.06);
  const borderMid=light?mixHex(bg,"#000000",0.18):mixHex(bg,"#ffffff",0.16);
  const textPrimary=light?"#1A1714":"#EEEAE0"; const textSecondary=light?"#605B52":"#888898"; const textMuted=light?"#9A958A":"#555568";
  const accentText="#FFFFFF";
  const accentSoft=light?mixHex(accent,bg,0.85):accent+"22";
  const positive=light?"#1A7A40":"#51CF66"; const negative=light?"#C0202A":"#FF6B6B";
  const warning=light?"#B07000":"#FAB005"; const info=light?"#1060B0":"#60AAFF";
  const bills=light?"#7E6BC5":"#A87BC9";
  const spent=light?"#D67550":"#E8806B";
  const cardShadow=light?"0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)":"0 2px 10px rgba(0,0,0,0.3)";
  return {bg,surface,surface2,border,borderSoft,borderMid,accent,accentText,accentMuted:accent+"15",accentSoft,accentBorder:accent+"30",positive,negative,warning,info,bills,spent,textPrimary,textSecondary,textMuted,bgLight:light,cardShadow};
}
const ThemeCtx = createContext(buildTheme(CALM_DEFAULT_ACCENT, CALM_DEFAULT_BG));
const useTheme = () => useContext(ThemeCtx);

// ── Category & Income helpers ─────────────────────────────────────────────────
function getAllCats(cc=[]){ return [...BUILTIN_CATEGORIES,...(cc||[]).map(c=>`${c.emoji} ${c.name}`)]; }
// Split-aware amount: returns what counts toward THIS user's totals after splits
function effectiveAmount(t){
  if(!t?.split||!t.split.with||typeof t.split.share!=="number") return t.amount;
  const share=Math.max(0,Math.min(1,t.split.share));
  return t.amount*share;
}
// Convert a subscription's amount + frequency to a monthly-equivalent figure
function subscriptionMonthly(sub){
  const a=+sub?.amount||0;
  switch(sub?.frequency){
    case "weekly": return a*52/12;
    case "quarterly": return a/3;
    case "yearly": return a/12;
    case "monthly":
    default: return a;
  }
}
function getAllCatCols(cc=[]){ const x={}; (cc||[]).forEach(c=>{x[`${c.emoji} ${c.name}`]=c.color||"#868E96";}); return {...CAT_COLORS,...x}; }
function isFixedCat(cat){ return FIXED_CATS.includes(cat); }
function getMonthStreams(streams,ov,month){
  return (streams||[]).filter(s=>{
    if(!s.active) return false;
    if(s.type==="oneoff") return s.startFrom===month;
    if(s.startFrom&&month&&monthsBetween(s.startFrom,month)<0) return false;
    return true;
  }).map(s=>{
    const o=(ov||{})[s.id];
    if(s.type==="fixed") return {stream:s,amount:o!==undefined?o:s.defaultAmount};
    return {stream:s,amount:o!==undefined?o:null};
  });
}
function totalIncome(streams,ov,month){
  const baseTotal=getMonthStreams(streams,ov,month).reduce((s,{amount})=>s+(amount||0),0);
  const oneoffTotal=Object.entries(ov||{}).filter(([k])=>k.startsWith("__oneoff_")).reduce((s,[,v])=>s+(typeof v==="object"?(v.amount||0):(v||0)),0);
  return baseTotal+oneoffTotal+((ov||{}).__extra__||0);
}
function pendingVarStreams(streams,ov,month){
  return getMonthStreams(streams,ov,month).filter(({stream,amount})=>(stream.type==="variable"||stream.type==="oneoff")&&amount===null);
}

// ── CSV chunker, export, backup ───────────────────────────────────────────────
function splitCSV(text,size=15000){
  const lines=text.split("\n"); const hdr=lines[0]; const rows=lines.slice(1).filter(l=>l.trim());
  const chunks=[]; let cur=[hdr];
  for(const line of rows){ cur.push(line); if(cur.join("\n").length>size){chunks.push(cur.join("\n"));cur=[hdr];} }
  if(cur.length>1) chunks.push(cur.join("\n"));
  return chunks.length?chunks:[text];
}
function exportCSV(monthlyData){
  const rows=[["Date","Description","Category","Amount","Month"]];
  Object.entries(monthlyData).sort().forEach(([m,md])=>{(md.txs||[]).forEach(t=>{rows.push([t.date,`"${(t.description||"").replace(/"/g,'""')}"`,t.category,t.amount.toFixed(2),m]);});});
  const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`spending-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
}
function countAllTx(md){ return Object.values(md).reduce((s,m)=>s+(m.txs||[]).length,0); }
function mkSnap(profile,md,ins,arc){ return {version:APP_VERSION,createdAt:new Date().toISOString(),profile,monthlyData:md,insights:ins,archive:arc}; }
function autoBackup(profile,md,ins,arc){
  try{ const snap=mkSnap(profile,md,ins,arc); const ex=lsLoad("autoBackups")||[]; const today=todayStr(); lsSave("autoBackups",[snap,...ex.filter(b=>!b.createdAt?.startsWith(today))].slice(0,MAX_AUTO_BACKUPS)); }catch(e){ console.error(e); }
}
function dlBackup(profile,md,ins,arc){
  const blob=new Blob([JSON.stringify(mkSnap(profile,md,ins,arc),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`smtm-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function useInp(){ const T=useTheme(); return {padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}; }
function Card({children,style}){ const T=useTheme(); return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"18px",boxShadow:T.cardShadow,...style}}>{children}</div>; }
function MicroLabel({children,style}){ const T=useTheme(); return <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",...style}}>{children}</div>; }
function Btn({children,onClick,disabled,variant="accent",size="md",style}){
  const T=useTheme();
  const bg=variant==="accent"?(disabled?T.border:T.accent):variant==="ghost"?"transparent":variant==="soft"?T.accentSoft:variant==="danger"?T.negative:T.surface;
  const col=variant==="accent"?(disabled?T.textMuted:"#fff"):variant==="ghost"?T.textSecondary:variant==="soft"?T.accent:variant==="danger"?"#fff":T.textSecondary;
  const border=variant==="ghost"?`1px solid ${T.border}`:variant==="soft"?`1px solid ${T.accent}30`:"none";
  const pad=size==="sm"?"9px 16px":"13px 22px";
  return <button onClick={onClick} disabled={disabled} style={{padding:pad,background:bg,border,borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:size==="sm"?13:14,color:col,cursor:disabled?"default":"pointer",width:"100%",transition:"all .15s",...style}}>{children}</button>;
}
function Toast({msg,onDone}){ const T=useTheme(); useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:104,left:"50%",transform:"translateX(-50%)",background:T.textPrimary,color:T.surface,borderRadius:24,padding:"11px 26px",fontSize:13,fontWeight:600,zIndex:2999,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 8px 28px rgba(0,0,0,0.18)"}}>{msg}</div>; }
function CountUp({value,format,duration=900}){
  const [display,setDisplay]=useState(0);
  const prev=useRef(0); const raf=useRef(null);
  useEffect(()=>{
    const start=prev.current; const end=value; const startTime=performance.now();
    const tick=now=>{
      const elapsed=now-startTime; const progress=Math.min(elapsed/duration,1);
      const eased=1-Math.pow(1-progress,3);
      const current=start+(end-start)*eased;
      setDisplay(current);
      if(progress<1) raf.current=requestAnimationFrame(tick);
      else { setDisplay(end); prev.current=end; }
    };
    raf.current=requestAnimationFrame(tick);
    return()=>{ if(raf.current) cancelAnimationFrame(raf.current); };
  },[value,duration]);
  return <span>{format(display)}</span>;
}
function Overlay({children,onClose,zIndex=700}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:24,overflowY:"auto"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",display:"flex"}}>{children}</div>
  </div>;
}
function ModalCard({children,maxWidth=380}){ const T=useTheme(); return <div style={{background:T.surface,borderRadius:24,padding:24,width:"100%",maxWidth,maxHeight:"calc(100vh - 48px)",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.25)",WebkitOverflowScrolling:"touch"}}>{children}</div>; }

function MonthPicker({value,onChange,startMonth}){
  const T=useTheme(); const inp=useInp(); const [open,setOpen]=useState(false); const [typed,setTyped]=useState(value);
  const btnRef=useRef(); const [pos,setPos]=useState({top:0,left:0,right:"auto"});
  useEffect(()=>setTyped(value),[value]);
  useEffect(()=>{
    if(open&&btnRef.current){
      const r=btnRef.current.getBoundingClientRect();
      const dropW=240; const spaceRight=window.innerWidth-r.left;
      if(spaceRight<dropW) setPos({top:r.bottom+6,left:"auto",right:window.innerWidth-r.right});
      else setPos({top:r.bottom+6,left:r.left,right:"auto"});
    }
  },[open]);
  const months=[]; const now=new Date();
  for(let i=0;i<36;i++){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; if(startMonth&&m<startMonth) break; months.push(m); }
  return <div style={{position:"relative",display:"inline-block"}}>
    <button ref={btnRef} onClick={()=>setOpen(o=>!o)} style={{padding:"8px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,color:T.textSecondary,fontFamily:"'DM Mono'",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontWeight:600}}>{monthLabelShort(value)} ▾</button>
    {open&&<><div style={{position:"fixed",inset:0,zIndex:299}} onClick={()=>setOpen(false)}/>
      <div style={{position:"fixed",top:pos.top,left:pos.left,right:pos.right,background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,zIndex:300,maxHeight:300,overflowY:"auto",minWidth:240,boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"10px"}}><input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&/^\d{4}-\d{2}$/.test(typed)&&(!startMonth||typed>=startMonth)){onChange(typed);setOpen(false);}}} placeholder="YYYY-MM" style={{...inp,fontSize:13,padding:"9px 12px"}}/></div>
        {months.map(m=><div key={m} onClick={()=>{onChange(m);setOpen(false);}} style={{padding:"10px 18px",fontSize:13,color:m===value?T.accent:T.textSecondary,cursor:"pointer",fontFamily:"'DM Mono'",background:m===value?T.accentSoft:"transparent"}}>{monthLabel(m)}</div>)}
      </div></>}
  </div>;
}

// ── SVG icons ────────────────────────────────────────────────────────────────
const TabIconHome = ({active,col,muted})=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?col:muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12L12 4L21 12V20A2 2 0 0119 22H5A2 2 0 013 20V12Z"/></svg>;
const TabIconMoney = ({active,col,muted})=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?col:muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7V17M9 9.5C9 8.5 9.5 7.5 12 7.5C14.5 7.5 15 9 15 9.5C15 12 9 11 9 14C9 14.5 9.5 16.5 12 16.5C14.5 16.5 15 15.5 15 14.5"/></svg>;
const TabIconYou = ({active,col,muted})=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?col:muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21C4 17 7.5 14 12 14C16.5 14 20 17 20 21"/></svg>;
const PrivacyLock = ({col,size=11})=> <svg width={size} height={size*1.2} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;

// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({storedHash,onUnlock,onSetup,onSkip}){
  const T=useTheme();
  const [digits,setDigits]=useState([]); const [error,setError]=useState("");
  const [setting,setSetting]=useState(!storedHash); const [confirm,setConfirm]=useState(false); const [first,setFirst]=useState("");
  const PIN_LEN=6;
  const pad=d=>{
    const next=[...digits,d.toString()];
    if(next.length===PIN_LEN){
      if(setting){
        if(!confirm){setFirst(next.join(""));setConfirm(true);setDigits([]);}
        else{if(next.join("")===first){onSetup(next.join(""));}else{setError("PINs don't match");setDigits([]);setConfirm(false);setFirst("");}}
      } else {
        if(hashPin(next.join(""))===storedHash){onUnlock();}
        else{setError("Incorrect PIN");setDigits([]);}
      }
    } else setDigits(next);
  };
  const del=()=>{ setError(""); setDigits(d=>d.slice(0,-1)); };
  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:28,fontFamily:"'DM Sans',sans-serif"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:800,color:T.accent,marginBottom:6,letterSpacing:-.3}}>$how Me The Money</div>
      <div style={{fontSize:18,color:T.textPrimary,fontWeight:700}}>{setting?(confirm?"Confirm your PIN":"Set a PIN (6 digits)"):"Enter your PIN"}</div>
      {setting&&!confirm&&<div style={{fontSize:13,color:T.textMuted,marginTop:6}}>You'll need this every time you open the app</div>}
    </div>
    <div style={{display:"flex",gap:14}}>
      {Array.from({length:PIN_LEN}).map((_,i)=><div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<digits.length?T.accent:T.border,transition:"background .15s"}}/>)}
    </div>
    {error&&<div style={{fontSize:13,color:T.negative,fontWeight:500}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,76px)",gap:14}}>
      {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
        <button key={i} onClick={()=>{ if(d==="") return; if(d==="⌫") del(); else pad(d); }}
          style={{width:76,height:76,borderRadius:20,background:d===""?"transparent":T.surface,border:`1px solid ${d===""?"transparent":T.border}`,fontSize:d==="⌫"?22:24,fontWeight:600,color:d===""?"transparent":T.textPrimary,cursor:d===""?"default":"pointer",fontFamily:"inherit",boxShadow:d===""?"none":T.cardShadow,transition:"background .1s"}}>{d}</button>
      ))}
    </div>
    {setting&&<button onClick={onSkip} style={{background:"none",border:"none",color:T.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Skip for this session</button>}
  </div>;
}

// ── Modals (preserved from existing app) ──────────────────────────────────────
function RestoreModal({backup,onConfirm,onClose}){
  const T=useTheme(); const txCount=countAllTx(backup.monthlyData||{}); const moCount=Object.keys(backup.monthlyData||{}).length;
  return <Overlay onClose={onClose}><ModalCard><p style={{margin:"0 0 6px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Restore backup?</p>
    <p style={{margin:"0 0 14px",fontSize:13,color:T.textSecondary}}>{new Date(backup.createdAt).toLocaleString("en-SG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
    <div style={{background:T.surface2,borderRadius:12,padding:"12px 14px",marginBottom:12,fontSize:13,color:T.textSecondary}}>{txCount} transactions · {moCount} months · {backup.profile?.name||"Unknown"}</div>
    <div style={{padding:"12px 14px",background:T.negative+"10",borderRadius:12,fontSize:13,color:T.negative,marginBottom:20}}>⚠ This replaces ALL current data and cannot be undone.</div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onClose} size="sm">Cancel</Btn><Btn variant="danger" onClick={onConfirm} size="sm">Restore</Btn></div>
  </ModalCard></Overlay>;
}
function ResetModal({onConfirm,onClose,onDownloadFirst}){
  const T=useTheme();
  return <Overlay onClose={onClose} zIndex={800}><ModalCard>
    <p style={{margin:"0 0 6px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Reset everything?</p>
    <p style={{margin:"0 0 14px",fontSize:14,color:T.textSecondary}}>Deletes your profile, all transactions, and all history. You'll start fresh from onboarding.</p>
    <div style={{padding:"12px 14px",background:T.negative+"10",borderRadius:12,fontSize:13,color:T.negative,marginBottom:16}}>⚠ This cannot be undone.</div>
    <button onClick={onDownloadFirst} style={{width:"100%",padding:"12px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer",marginBottom:10,textAlign:"left"}}>⬇ Download backup first (recommended)</button>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onClose} size="sm">Cancel</Btn><Btn variant="danger" onClick={onConfirm} size="sm">Reset</Btn></div>
  </ModalCard></Overlay>;
}
function TxDetailModal({tx,month,monthLabel,allCats,fmt,onSave,onArchive,onClose,splitSuggestions=[]}){
  const T=useTheme();
  const [d,setD]=useState({
    description:tx.description||"",
    amount:String(tx.amount),
    category:tx.category||"📦 Other",
    date:tx.date||"",
    notes:tx.notes||"",
    split:tx.split?{with:tx.split.with||"",share:tx.split.share||0.5}:null,
  });
  const dirty=d.description!==(tx.description||"")||parseFloat(d.amount)!==tx.amount||d.category!==tx.category||d.date!==tx.date||(d.notes||"")!==(tx.notes||"")||JSON.stringify(d.split||null)!==JSON.stringify(tx.split||null);
  const save=()=>{
    const amtN=parseFloat(d.amount);
    if(!d.description.trim()||isNaN(amtN)) return;
    const out={...tx,description:d.description.trim(),amount:amtN,category:d.category,date:d.date,notes:d.notes.trim()||undefined};
    if(d.split&&d.split.with?.trim()){
      const share=Math.max(0,Math.min(1,+d.split.share||0.5));
      out.split={with:d.split.with.trim(),share};
    } else {
      delete out.split;
    }
    onSave(out); onClose();
  };
  const inpS={padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"};
  const isCredit=tx.amount<0;
  const sharePct=d.split?Math.round((d.split.share||0)*100):50;
  const yourShareAmt=d.split&&!isNaN(parseFloat(d.amount))?parseFloat(d.amount)*(d.split.share||0):null;
  return <Overlay onClose={onClose} zIndex={400}><ModalCard maxWidth={420}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <p style={{margin:0,fontSize:18,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Transaction</p>
      <span style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{monthLabel(month)}</span>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
      <div>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>DESCRIPTION</div>
        <input type="text" value={d.description} onChange={e=>setD({...d,description:e.target.value})} style={inpS}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:10,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>AMOUNT {isCredit&&<span style={{color:T.positive}}>(credit)</span>}</div>
          <input type="number" value={d.amount} onChange={e=>setD({...d,amount:e.target.value})} style={{...inpS,fontFamily:"'DM Mono'",fontWeight:600}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>DATE</div>
          <input type="date" value={d.date} onChange={e=>setD({...d,date:e.target.value})} style={inpS}/>
        </div>
      </div>
      <div>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>CATEGORY</div>
        <select value={d.category} onChange={e=>setD({...d,category:e.target.value})} style={inpS}>{allCats.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      <div>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>NOTE <span style={{color:T.textMuted,fontWeight:400,letterSpacing:0,textTransform:"none"}}>(optional)</span></div>
        <textarea value={d.notes} onChange={e=>setD({...d,notes:e.target.value})} placeholder="Add a note — what was this for, who you were with…" rows={3} style={{...inpS,resize:"vertical",minHeight:60,fontFamily:"inherit"}}/>
      </div>
      {/* Split with */}
      <div style={{padding:"12px 12px",background:d.split?T.accentSoft:T.surface2,border:`1px solid ${d.split?T.accentBorder:T.borderSoft}`,borderRadius:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:d.split?10:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>🤝</span>
            <span style={{fontSize:12,fontWeight:600,color:T.textPrimary}}>Split with someone</span>
          </div>
          <div onClick={()=>setD({...d,split:d.split?null:{with:"",share:0.5}})} style={{width:36,height:22,borderRadius:11,background:d.split?T.accent:T.borderMid,padding:2,boxSizing:"border-box",cursor:"pointer",transition:"background .15s",flexShrink:0,position:"relative"}}>
            <div style={{width:18,height:18,borderRadius:9,background:"#fff",transform:`translateX(${d.split?14:0}px)`,transition:"transform .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </div>
        {d.split&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <input type="text" placeholder="Who? (e.g. Mike)" list="split-suggestions" value={d.split.with} onChange={e=>setD({...d,split:{...d.split,with:e.target.value}})} style={inpS}/>
          <datalist id="split-suggestions">{splitSuggestions.map(s=><option key={s} value={s}/>)}</datalist>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginBottom:4,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>
              <span>YOUR SHARE</span>
              <span style={{color:T.accent}}>{sharePct}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={sharePct} onChange={e=>setD({...d,split:{...d.split,share:parseInt(e.target.value,10)/100}})} style={{width:"100%",accentColor:T.accent}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textMuted,marginTop:2}}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          {yourShareAmt!==null&&<div style={{fontSize:11,color:T.textSecondary,padding:"6px 10px",background:T.surface,borderRadius:8,textAlign:"center"}}>You pay <span style={{fontFamily:"'DM Mono'",fontWeight:700,color:T.accent}}>{fmt(Math.abs(yourShareAmt))}</span> of {fmt(Math.abs(parseFloat(d.amount)))}</div>}
        </div>}
      </div>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:8}}>
      <Btn variant="ghost" onClick={onClose} size="sm">Cancel</Btn>
      <Btn onClick={save} disabled={!dirty||!d.description.trim()} size="sm">Save changes</Btn>
    </div>
    <button onClick={()=>{if(confirm("Move this transaction to archive?")){onArchive(tx.id,month);onClose();}}} style={{width:"100%",padding:"10px",background:"transparent",border:"none",color:T.negative,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginTop:4}}>Move to archive</button>
  </ModalCard></Overlay>;
}
function Check({checked,onChange}){ const T=useTheme(); return <div onClick={onChange} style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${checked?T.accent:T.borderMid}`,background:checked?T.accentSoft:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>{checked&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>; }
function FixedCommitModal({detected,fmt,onConfirm,onSkip}){
  const T=useTheme(); const [sel,setSel]=useState(detected.map((_,i)=>i)); const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Overlay onClose={onSkip}><ModalCard maxWidth={420}>
    <p style={{margin:"0 0 4px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Bills detected</p>
    <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary}}>These look like recurring fixed payments. Add them to your Bills?</p>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      {detected.map((t,i)=><div key={i} onClick={()=>tog(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:sel.includes(i)?T.accentSoft:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:14,cursor:"pointer"}}>
        <Check checked={sel.includes(i)} onChange={()=>tog(i)}/>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.textPrimary}}>{t.description}</div><div style={{fontSize:12,color:T.textMuted}}>{t.category}</div></div>
        <div style={{fontFamily:"'DM Mono'",fontSize:14,color:T.accent,fontWeight:700}}>{fmt(t.rawAmount)}</div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onSkip} size="sm">Skip</Btn><Btn onClick={()=>onConfirm(sel.map(i=>detected[i]))} size="sm">Add Selected</Btn></div>
  </ModalCard></Overlay>;
}
function RecurringModal({suggestions,onConfirm,onDismiss}){
  const T=useTheme(); const [sel,setSel]=useState(suggestions.map((_,i)=>i)); const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Overlay onClose={onDismiss}><ModalCard maxWidth={420}>
    <p style={{margin:"0 0 4px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Recurring transactions detected</p>
    <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary}}>These appear every month at a similar amount. Add to Bills?</p>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      {suggestions.map((s,i)=><div key={i} onClick={()=>tog(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:sel.includes(i)?T.accentSoft:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:14,cursor:"pointer"}}>
        <Check checked={sel.includes(i)} onChange={()=>tog(i)}/>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:T.textPrimary}}>{s.description}</div><div style={{fontSize:12,color:T.textMuted}}>~{s.amount.toFixed(2)} · appears {s.count} months</div></div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onDismiss} size="sm">Not now</Btn><Btn onClick={()=>onConfirm(sel.map(i=>suggestions[i]))} size="sm">Add Selected</Btn></div>
  </ModalCard></Overlay>;
}

// ── Sample data generator (for "Skip with sample data" onboarding) ────────────
function generateSampleData(){
  const today=new Date();
  const months=[];
  for(let i=2;i>=0;i--){ const d=new Date(today.getFullYear(),today.getMonth()-i,1); months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }
  const merchants=[
    {desc:"Kopitiam",cat:"🍔 Food & Dining",base:7.20,vary:3},{desc:"FairPrice",cat:"🛒 Groceries",base:48,vary:25},{desc:"Grab",cat:"🚗 Transport",base:14,vary:8},
    {desc:"Starbucks",cat:"🍔 Food & Dining",base:8.50,vary:2},{desc:"Shopee",cat:"👕 Shopping",base:32,vary:40},{desc:"Singtel",cat:"💡 Utilities",base:38,vary:0,recurring:true},
    {desc:"Netflix",cat:"📱 Subscription",base:18,vary:0,recurring:true},{desc:"Spotify",cat:"📱 Subscription",base:11.98,vary:0,recurring:true},
    {desc:"Cathay Cinema",cat:"🎬 Entertainment",base:14,vary:4},{desc:"Watsons",cat:"🏥 Health",base:22,vary:12},
    {desc:"MRT/Bus",cat:"🚗 Transport",base:2.40,vary:1.5},{desc:"Hawker Centre",cat:"🍔 Food & Dining",base:5.50,vary:2},
  ];
  const monthlyData={};
  months.forEach((m,monthIdx)=>{
    const txs=[];
    const daysInM=new Date(parseInt(m.split("-")[0]),parseInt(m.split("-")[1]),0).getDate();
    const lastDay=monthIdx===2?Math.min(daysInM,today.getDate()):daysInM;
    merchants.forEach((mer,i)=>{
      if(mer.recurring){
        txs.push({id:`s${m}${i}`,date:`${m}-${String(Math.min(5,lastDay)).padStart(2,"0")}`,description:mer.desc,category:mer.cat,amount:mer.base,source:"sample"});
      } else {
        const occurrences=mer.cat==="🍔 Food & Dining"||mer.cat==="🚗 Transport"?Math.floor(lastDay*0.6):Math.floor(lastDay*0.15);
        for(let j=0;j<occurrences;j++){
          const day=Math.floor(Math.random()*lastDay)+1;
          const amt=mer.base+(Math.random()-0.5)*mer.vary*2;
          txs.push({id:`s${m}${i}d${j}${Math.random()}`,date:`${m}-${String(day).padStart(2,"0")}`,description:mer.desc,category:mer.cat,amount:Math.max(1,amt),source:"sample"});
        }
      }
    });
    monthlyData[m]={txs:txs.sort((a,b)=>a.date.localeCompare(b.date)),incomeOverrides:{salary_sample:5400+(Math.random()-0.5)*300},fixedOverrides:null};
  });
  return monthlyData;
}

// ── Onboarding (privacy-led, multi-step) ────────────────────────────────────
function Onboarding({onComplete}){
  const T=useTheme();
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [currency,setCurrency]=useState("SGD");
  const [streams,setStreams]=useState([{id:`s${Date.now()}`,name:"Salary",type:"fixed",defaultAmount:0,active:true,startFrom:""}]);
  const [bills,setBills]=useState([]);
  // Goal selection
  const [goalType,setGoalType]=useState(null); // "save_more" | "get_out_of_debt" | "understand_spending" | "spend_less_on"
  const [goalParams,setGoalParams]=useState({});

  const buildGoal=()=>{ if(!goalType) return null; return {type:goalType,params:goalParams||{}}; };

  const finishWithProfile=(opts={})=>{
    const profile={...DEFAULT_PROFILE,name:name.trim()||"You",currency,onboarded:true,incomeStreams:streams.filter(s=>s.name?.trim()),fixedCommitments:bills.filter(b=>b.name?.trim()&&+b.amount>0),startMonth:currentMonth(),goal:buildGoal()};
    if(opts.preview){
      const sample=generateSampleData();
      lsSave("monthlyData",sample);
      onComplete(profile,{preview:true});
    } else {
      onComplete(profile);
    }
  };
  const skipWithSample=()=>{
    const sample=generateSampleData();
    const profile={...DEFAULT_PROFILE,name:name.trim()||"You",currency,onboarded:true,incomeStreams:[{id:"salary_sample",name:"Salary",type:"fixed",defaultAmount:5400,active:true,startFrom:""}],fixedCommitments:[{id:`c${Date.now()}1`,name:"Rent",amount:1800,startFrom:""},{id:`c${Date.now()}2`,name:"Insurance",amount:185,startFrom:""}],startMonth:Object.keys(sample)[0],goal:buildGoal()};
    lsSave("monthlyData",sample);
    onComplete(profile);
  };

  const banks=["DBS","OCBC","UOB","Citi","HSBC","Standard Chartered","CIMB","Maybank","Trust Bank","GXS","Wise","Revolut"];
  const inp={padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"};
  const inpS={...inp,padding:"10px 12px",fontSize:13,background:T.surface2};

  const StepDots=()=><div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24}}>
    {[0,1,2,3,4,5].map(i=><div key={i} style={{width:i===step?22:6,height:6,borderRadius:3,background:i===step?T.accent:i<step?T.accent:T.border,transition:"width .2s"}}/>)}
  </div>;

  const Wrap=({children})=><div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"32px 24px 24px",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
    <div style={{flex:1,maxWidth:380,width:"100%",margin:"0 auto",display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&family=Bricolage+Grotesque:wght@600;700;800&display=swap" rel="stylesheet"/>
      <StepDots/>{children}
    </div>
    <div style={{maxWidth:380,width:"100%",margin:"0 auto",fontSize:11,color:T.textMuted,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:6,paddingTop:14}}>
      <PrivacyLock col={T.textMuted}/>100% on-device · nothing leaves your phone
    </div>
  </div>;

  // Step 0 — Welcome / privacy lead
  if(step===0) return <Wrap>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:18,display:"inline-flex",width:72,height:72,borderRadius:36,background:T.accentSoft,color:T.accent,alignItems:"center",justifyContent:"center"}}><PrivacyLock col={T.accent} size={28}/></div>
      <div style={{fontSize:32,fontWeight:800,color:T.textPrimary,letterSpacing:-1.2,lineHeight:1.05,marginBottom:14,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Your money,<br/><span style={{color:T.accent}}>your phone only</span></div>
      <div style={{fontSize:14,color:T.textSecondary,lineHeight:1.6,marginBottom:24}}>No accounts. No cloud. No tracking.<br/>Your statements never leave your device.</div>
      <Btn onClick={()=>setStep(1)}>Get started →</Btn>
      <button onClick={skipWithSample} style={{marginTop:14,background:"none",border:"none",color:T.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Skip — try with sample data</button>
    </div>
  </Wrap>;

  // Step 1 — Name + currency
  if(step===1) return <Wrap>
    <div>
      <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,letterSpacing:-0.6,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>What should we call you?</div>
      <div style={{fontSize:13,color:T.textSecondary,marginBottom:22}}>Just your first name is fine.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:24}}>
        <input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={inp} autoFocus/>
        <select value={currency} onChange={e=>setCurrency(e.target.value)} style={inp}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      <Btn onClick={()=>setStep(2)} disabled={!name.trim()}>Continue</Btn>
      <button onClick={()=>setStep(0)} style={{marginTop:10,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
    </div>
  </Wrap>;

  // Step 2 — Goal (NEW)
  if(step===2){
    const GOALS=[
      {id:"save_more",emoji:"💰",label:"Save more",desc:"Build a savings habit, hit a target"},
      {id:"get_out_of_debt",emoji:"🪙",label:"Get out of debt",desc:"Pay off what you owe, faster"},
      {id:"understand_spending",emoji:"🧐",label:"Understand spending",desc:"See where your money actually goes"},
      {id:"spend_less_on",emoji:"🎯",label:"Spend less on something",desc:"Cap a category you'd rather control"},
    ];
    return <Wrap>
      <div>
        <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,letterSpacing:-0.6,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>What's your main objective?</div>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:18}}>We'll tune your dashboard to show what matters most. You can change this later.</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
          {GOALS.map(g=>{
            const sel=goalType===g.id;
            return <div key={g.id} onClick={()=>{setGoalType(g.id);setGoalParams({});}} style={{padding:"14px 14px",background:sel?T.accentSoft:T.surface,border:`2px solid ${sel?T.accent:T.border}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .12s"}}>
              <div style={{width:40,height:40,borderRadius:14,background:sel?T.accent+"20":T.surface2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{g.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:T.textPrimary}}>{g.label}</div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:2,lineHeight:1.4}}>{g.desc}</div>
              </div>
              {sel&&<span style={{fontSize:18,color:T.accent,flexShrink:0}}>✓</span>}
            </div>;
          })}
        </div>
        {/* Inline params for goals that need one */}
        {goalType==="get_out_of_debt"&&<div style={{padding:"12px 14px",background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,marginBottom:18}}>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>HOW MUCH DEBT TOTAL?</div>
          <input type="number" inputMode="decimal" placeholder="e.g. 12000" value={goalParams.totalDebt||""} onChange={e=>setGoalParams({...goalParams,totalDebt:parseFloat(e.target.value)||0})} style={inpS}/>
        </div>}
        {goalType==="spend_less_on"&&<div style={{padding:"12px 14px",background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,marginBottom:18}}>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>WHICH CATEGORY?</div>
          <select value={goalParams.category||""} onChange={e=>setGoalParams({...goalParams,category:e.target.value})} style={{...inpS,marginBottom:10}}>
            <option value="">Pick one</option>
            {BUILTIN_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>MONTHLY CAP (optional)</div>
          <input type="number" inputMode="decimal" placeholder="e.g. 300" value={goalParams.cap||""} onChange={e=>setGoalParams({...goalParams,cap:parseFloat(e.target.value)||0})} style={inpS}/>
        </div>}
        <Btn onClick={()=>setStep(3)} disabled={!goalType}>Continue</Btn>
        <button onClick={()=>{setGoalType(null);setStep(3);}} style={{marginTop:8,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip — I'm just exploring</button>
        <button onClick={()=>setStep(1)} style={{marginTop:4,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
      </div>
    </Wrap>;
  }

  // Step 3 — Income (was step 2)
  if(step===3) return <Wrap>
    <div>
      <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,letterSpacing:-0.6,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Where does money come in?</div>
      <div style={{fontSize:13,color:T.textSecondary,marginBottom:18}}>Salary, freelance, side hustles. Add as many as you have.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
        {streams.map((s,i)=><div key={s.id} style={{padding:"12px",background:T.surface,borderRadius:14,border:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
            <input placeholder="Source name (e.g. Salary)" value={s.name} onChange={e=>setStreams(p=>p.map(x=>x.id===s.id?{...x,name:e.target.value}:x))} style={inpS}/>
            {streams.length>1&&<button onClick={()=>setStreams(p=>p.filter(x=>x.id!==s.id))} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"4px 8px",lineHeight:1}}>×</button>}
          </div>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:8}}>
            {[["fixed","Fixed",T.info],["variable","Variable",T.warning]].map(([t,lbl,col])=><button key={t} onClick={()=>setStreams(p=>p.map(x=>x.id===s.id?{...x,type:t}:x))} style={{flex:1,padding:"7px 4px",background:s.type===t?col:"transparent",border:"none",color:s.type===t?"#fff":T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?700:500}}>{lbl}</button>)}
          </div>
          {s.type==="fixed"?<input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>setStreams(p=>p.map(x=>x.id===s.id?{...x,defaultAmount:parseFloat(e.target.value)||0}:x))} style={inpS}/>:<div style={{fontSize:10,color:T.textMuted,fontStyle:"italic",padding:"4px 0"}}>You'll enter the amount each month in Money.</div>}
        </div>)}
      </div>
      <button onClick={()=>setStreams(p=>[...p,{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true,startFrom:""}])} style={{width:"100%",padding:"10px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:18}}>+ Add another source</button>
      <Btn onClick={()=>setStep(4)}>Continue</Btn>
      <button onClick={()=>setStep(4)} style={{marginTop:8,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip for now</button>
      <button onClick={()=>setStep(2)} style={{marginTop:4,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
    </div>
  </Wrap>;

  // Step 4 — Bills (was step 3)
  if(step===4) return <Wrap>
    <div>
      <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,letterSpacing:-0.6,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Any recurring bills?</div>
      <div style={{fontSize:13,color:T.textSecondary,marginBottom:18}}>Rent, insurance, loan repayments. We'll separate these from spending.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
        {bills.map((b,i)=><div key={b.id} style={{padding:"12px",background:T.surface,borderRadius:14,border:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 100px auto",gap:8,alignItems:"center"}}>
            <input placeholder="Name (e.g. Rent)" value={b.name} onChange={e=>setBills(p=>p.map(x=>x.id===b.id?{...x,name:e.target.value}:x))} style={inpS}/>
            <input type="number" placeholder="0" value={b.amount||""} onChange={e=>setBills(p=>p.map(x=>x.id===b.id?{...x,amount:parseFloat(e.target.value)||0}:x))} style={{...inpS,textAlign:"right"}}/>
            <button onClick={()=>setBills(p=>p.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"4px 8px",lineHeight:1}}>×</button>
          </div>
        </div>)}
      </div>
      <button onClick={()=>setBills(p=>[...p,{id:`c${Date.now()}`,name:"",amount:0,startFrom:"",endMonth:""}])} style={{width:"100%",padding:"10px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:18}}>+ Add a bill</button>
      <Btn onClick={()=>setStep(5)}>Continue</Btn>
      <button onClick={()=>setStep(5)} style={{marginTop:8,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip for now</button>
      <button onClick={()=>setStep(3)} style={{marginTop:4,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
    </div>
  </Wrap>;

  // Step 5 — Privacy / supported banks reassurance + finish (was step 4)
  return <Wrap>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:18,display:"inline-flex",width:72,height:72,borderRadius:36,background:T.accentSoft,color:T.accent,alignItems:"center",justifyContent:"center",fontSize:36}}>🎉</div>
      <div style={{fontSize:26,fontWeight:800,color:T.textPrimary,letterSpacing:-0.8,lineHeight:1.1,marginBottom:14,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>You're all set, {name.split(" ")[0]}</div>
      <div style={{fontSize:14,color:T.textSecondary,lineHeight:1.6,marginBottom:18}}>Tap the green + button to upload your first bank statement. We support PDFs and CSVs from:</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:24}}>
        {banks.map(b=><div key={b} style={{padding:"5px 11px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,fontSize:11,color:T.textSecondary,fontWeight:500}}>{b}</div>)}
        <div style={{padding:"5px 11px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:14,fontSize:11,color:T.accent,fontWeight:600}}>+ any other</div>
      </div>
      <Btn onClick={()=>finishWithProfile({preview:true})}>See what it'll look like →</Btn>
      <button onClick={()=>finishWithProfile()} style={{marginTop:10,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip preview, take me to my dashboard</button>
      <button onClick={()=>setStep(4)} style={{marginTop:4,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
    </div>
  </Wrap>;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [pinUnlocked,setPinUnlocked]=useState(false);
  const [pinSkipped,setPinSkipped]=useState(false);
  const [pinHash,setPinHash]=useState(()=>lsLoad("pinHash"));
  const [tab,setTab]=useState("home");
  const [subScreen,setSubScreen]=useState(null); // null | "upload" | "review" | "forecast" | "subscriptions"
  const [selectedMonth,setSelectedMonth]=useState(currentMonth());
  const [profile,setProfile]=useState(null);
  const [monthlyData,setMonthlyData]=useState({});
  const [archive,setArchive]=useState([]);
  const [pendingTxs,setPendingTxs]=useState([]);
  const [insights,setInsights]=useState({text:"",timestamp:null});
  const [toast,setToast]=useState("");
  const [showPrivacy,setShowPrivacy]=useState(false);
  const [restoreCandidate,setRestoreCandidate]=useState(null);
  const [showReset,setShowReset]=useState(false);
  const [fixedCommitDetected,setFixedCommitDetected]=useState(null);
  const [recurringDetected,setRecurringDetected]=useState(null);
  // Upload state
  const [uploading,setUploading]=useState(false);
  const [uploadMsg,setUploadMsg]=useState("");
  const [uploadErrDetail,setUploadErrDetail]=useState(null);
  const [uploadErrExpanded,setUploadErrExpanded]=useState(false);
  const [uploadStep,setUploadStep]=useState(0); // 0=idle, 1=read, 2=claude, 3=categorise, 4=ready
  const [uploadFile,setUploadFile]=useState(null);
  const [uploadTxCount,setUploadTxCount]=useState(0);
  const [uploadInsight,setUploadInsight]=useState({topCat:null,totalSpent:0,monthsCovered:0});
  // Money tab state
  const [moneyShowSubs,setMoneyShowSubs]=useState(true);
  const [catFilter,setCatFilter]=useState("All");
  // Lifted state for inner components (prevents loss on App re-render)
  const [addOneoffOpen,setAddOneoffOpen]=useState(false);
  const [oneoffName,setOneoffName]=useState("");
  const [oneoffAmt,setOneoffAmt]=useState("");
  const [manualOpen,setManualOpen]=useState(false);
  const [manualDesc,setManualDesc]=useState("");
  const [manualAmt,setManualAmt]=useState("");
  const [manualCat,setManualCat]=useState("");
  const [manualDate,setManualDate]=useState(todayStr());
  // ReviewScreen lifted state
  const [reviewDecisions,setReviewDecisions]=useState([]);
  const [reviewDrag,setReviewDrag]=useState({x:0,active:false});
  const [reviewExiting,setReviewExiting]=useState(null);
  const [reviewUndoToast,setReviewUndoToast]=useState(null);
  const [reviewKeepAllConfirm,setReviewKeepAllConfirm]=useState(false);
  // IncomeBills/Goals lifted drafts
  const [ibDraft,setIbDraft]=useState(null);
  const [goalsDraft,setGoalsDraft]=useState(null);
  // Goal editor (You-tab) draft state
  const [goalTypeDraft,setGoalTypeDraft]=useState(null);
  const [goalParamsDraft,setGoalParamsDraft]=useState(null);
  // Spending trend chart — selected categories overlay
  const [trendCats,setTrendCats]=useState([]);
  // Money tab transactions pagination
  const [txPage,setTxPage]=useState(1);
  // Money tab — collapsible sections (default all open)
  const [moneyCollapsed,setMoneyCollapsed]=useState({income:false,bills:false,recent:false});
  // Subscriptions editor — null = list view, "new" = adding, or {id} = editing existing
  const [subEditor,setSubEditor]=useState(null);
  const [subDraft,setSubDraft]=useState(null);
  // Category-budgets draft (keyed by category name)
  const [budgetsDraft,setBudgetsDraft]=useState(null);
  const toggleMoneySection=key=>setMoneyCollapsed(c=>({...c,[key]:!c[key]}));
  // First-time + button coachmark — shown once per device
  const [showAddCoachmark,setShowAddCoachmark]=useState(false);
  useEffect(()=>{
    if(!profile?.onboarded) return;
    try{ if(!localStorage.getItem("seenAddCoachmark")) setShowAddCoachmark(true); }catch(e){}
  },[profile?.onboarded]);
  const dismissAddCoachmark=()=>{
    setShowAddCoachmark(false);
    try{ localStorage.setItem("seenAddCoachmark","1"); }catch(e){}
  };
  // VarIncomeRow drafts and flash state — keyed by stream id
  const [varDrafts,setVarDrafts]=useState({});
  const [varFlash,setVarFlash]=useState({});
  // Home "Things to do" expand
  const [todosExpanded,setTodosExpanded]=useState(false);
  const [previewMode,setPreviewMode]=useState(false);
  // Transaction detail / edit modal
  const [txDetailId,setTxDetailId]=useState(null);
  const [txDetailMonth,setTxDetailMonth]=useState(null);
  // Search state
  const [searchQ,setSearchQ]=useState("");
  // Quick Add sheet (from + button)
  const [addMode,setAddMode]=useState("choose"); // "choose" | "quick"
  const [qaDesc,setQaDesc]=useState("");
  const [qaAmt,setQaAmt]=useState("");
  const [qaCat,setQaCat]=useState("");
  const [qaDate,setQaDate]=useState(todayStr());
  // ReviewScreen refs
  const reviewCardRef=useRef();
  const reviewStartX=useRef(0);
  const reviewUndoTimer=useRef(null);
  const fileRef=useRef(); const photoRef=useRef();
  const backupTimer=useRef(null);

  useEffect(()=>{
    const p=lsLoad("profile"); setProfile(p||DEFAULT_PROFILE);
    const md=lsLoad("monthlyData"); if(md) setMonthlyData(md);
    const ins=lsLoad("insights"); if(ins) setInsights(ins);
    const arc=lsLoad("archive"); if(arc) setArchive(arc);
    // Silent migration: remove deprecated habit-system keys from previous versions
    try{ localStorage.removeItem("excludeHistory"); localStorage.removeItem("catExcludeHistory"); }catch(e){}
  },[]);
  useEffect(()=>{ if(profile?.startMonth&&selectedMonth<profile.startMonth) setSelectedMonth(profile.startMonth); },[profile?.startMonth]);
  useEffect(()=>{ setTxPage(1); },[selectedMonth,catFilter]);
  useEffect(()=>{
    if(!profile?.onboarded) return;
    clearTimeout(backupTimer.current);
    backupTimer.current=setTimeout(()=>autoBackup(profile,monthlyData,insights,archive),3000);
    return()=>clearTimeout(backupTimer.current);
  },[profile,monthlyData,archive]);

  const theme=useMemo(()=>buildTheme(profile?.accentColor||CALM_DEFAULT_ACCENT, profile?.bgColor||CALM_DEFAULT_BG),[profile?.accentColor,profile?.bgColor]);
  const T=theme;
  const fmt=useCallback(n=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; return sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2}); },[profile?.currency]);
  const streams=profile?.incomeStreams||[];
  const saveProfile=p=>{ setProfile(p); lsSave("profile",p); };
  const saveArchive=arr=>{ setArchive(arr); lsSave("archive",arr); };
  const showToast=msg=>setToast(msg);
  const doReset=()=>{ lsClear(); window.location.reload(); };
  const doRestore=snap=>{ saveProfile(snap.profile||DEFAULT_PROFILE); lsSave("monthlyData",snap.monthlyData||{}); setMonthlyData(snap.monthlyData||{}); if(snap.insights){setInsights(snap.insights);lsSave("insights",snap.insights);} if(snap.archive){saveArchive(snap.archive);} setRestoreCandidate(null); showToast("✓ Backup restored"); window.location.reload(); };

  // Lifetime saved (across all months)
  const allTimeSaved=useMemo(()=>Object.entries(monthlyData).filter(([m])=>!profile?.startMonth||m>=profile.startMonth).reduce((total,[m,md])=>{
    const inc=totalIncome(streams,md.incomeOverrides||{},m);
    const spent=(md.txs||[]).reduce((s,t)=>s+effectiveAmount(t),0);
    const fix=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
    return total+(inc-spent-fix);
  },0),[monthlyData,streams,profile]);

  // Last 6 months of savings (oldest → newest, ending at selectedMonth)
  const monthlySavings=useMemo(()=>{
    const out=[];
    const [y,mo]=selectedMonth.split("-").map(Number);
    for(let i=5;i>=0;i--){
      const d=new Date(y,mo-1-i,1);
      const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if(profile?.startMonth&&m<profile.startMonth) continue;
      const md=monthlyData[m]||{txs:[],incomeOverrides:{}};
      const inc=totalIncome(streams,md.incomeOverrides||{},m);
      const spent=(md.txs||[]).reduce((s,t)=>s+effectiveAmount(t),0);
      const fix=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
      const isCurrent=m===currentMonth();
      // For current month, also compute projected
      let projected=null;
      if(isCurrent){
        const today=new Date(); const dom=today.getDate(); const dim=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
        if(dom>5&&inc>0){ const projSpent=spent*(dim/dom); projected=inc-fix-projSpent; }
      }
      out.push({month:m,saved:inc-spent-fix,earned:inc,bills:fix,spent,projected,isCurrent,hasData:(md.txs||[]).length>0||Object.keys(md.incomeOverrides||{}).length>0});
    }
    return out;
  },[monthlyData,streams,profile,selectedMonth]);

  // ── Spending trend (cross-month, always ends at CURRENT month, not selectedMonth) ─
  const spendingTrend=useMemo(()=>{
    const out=[];
    const today=new Date();
    const curYear=today.getFullYear(), curMo=today.getMonth();
    // Last 6 months ending at the current month
    for(let i=5;i>=0;i--){
      const d=new Date(curYear,curMo-i,1);
      const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if(profile?.startMonth&&m<profile.startMonth) continue;
      const md=monthlyData[m]||{txs:[],incomeOverrides:{}};
      const txs=(md.txs||[]);
      // Only count debits (amount > 0 = spending in our convention)
      const total=txs.filter(t=>t.amount>0).reduce((s,t)=>s+effectiveAmount(t),0);
      const byCat={};
      txs.filter(t=>t.amount>0).forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+effectiveAmount(t);});
      out.push({month:m,total,byCat,hasData:txs.length>0});
    }
    return out;
  },[monthlyData,profile?.startMonth]);

  // All categories that have ever had spending in the trend window, sorted by total desc
  const trendAllCategories=useMemo(()=>{
    const agg={};
    spendingTrend.forEach(p=>{ Object.entries(p.byCat).forEach(([cat,amt])=>{ agg[cat]=(agg[cat]||0)+amt; }); });
    return Object.entries(agg).sort((a,b)=>b[1]-a[1]).map(([cat])=>cat);
  },[spendingTrend]);

  // Declared subscriptions — the source of truth (user-managed)
  const declaredSubscriptions=useMemo(()=>{
    const localCols=getAllCatCols(profile?.customCategories);
    return (profile?.subscriptions||[]).map(s=>({
      ...s,
      monthlyEquiv:subscriptionMonthly(s),
      color:localCols[s.category]||"#868E96",
      declared:true
    }));
  },[profile?.subscriptions,profile?.customCategories]);

  // Suggested subscriptions — auto-detected from statements; filtered to exclude already-declared
  const suggestedSubscriptions=useMemo(()=>{
    const months=Object.keys(monthlyData).filter(m=>!profile?.startMonth||m>=profile.startMonth).sort();
    if(months.length<1) return [];
    const SUB_MERCHANT_REGEX=/netflix|spotify|prime video|youtube premium|youtube music|apple|disney\+?|disney plus|hbo|hulu|paramount|adobe|notion|figma|canva|github|chatgpt|claude|openai|anthropic|dropbox|microsoft 365|office 365|google one|icloud|expressvpn|nordvpn|surfshark|setapp|1password|grammarly|duolingo|audible|tidal|deezer|patreon|substack|medium|coursera|udemy|linkedin premium|zoom|slack|gusto|xero|quickbooks|asana|trello|miro|loom|hubspot|mailchimp|squarespace|wordpress|cloudflare/i;
    const desc={};
    months.forEach(m=>{(monthlyData[m]?.txs||[]).forEach(t=>{
      const k=t.description?.toLowerCase().trim(); if(!k) return;
      if(!desc[k]) desc[k]={count:0,amounts:[],description:t.description,category:t.category,monthsSeen:new Set(),lastDate:""};
      desc[k].count++; desc[k].amounts.push(Math.abs(t.amount)); desc[k].monthsSeen.add(m);
      if(t.date>desc[k].lastDate) desc[k].lastDate=t.date;
    });});
    const COLS2=getAllCatCols(profile?.customCategories);
    // Build a fast lookup of declared subscription names (lowercased) so we skip what user already has
    const declaredNames=new Set((profile?.subscriptions||[]).map(s=>(s.name||"").toLowerCase().trim()));
    return Object.values(desc)
      .filter(({monthsSeen,category,description})=>{
        // Skip if user already declared this
        if(declaredNames.has((description||"").toLowerCase().trim())) return false;
        // Two routes to suggestion:
        // 1) Same merchant in 2+ months — strong recurring signal
        if(monthsSeen.size>=2) return true;
        // 2) Merchant name matches a well-known service (likely subscription even at 1 occurrence — but only as SUGGESTION, not a "subscription" itself)
        if(SUB_MERCHANT_REGEX.test(description||"")) return true;
        return false;
      })
      .map(({description,count,amounts,category,monthsSeen,lastDate})=>{
        const avg=amounts.reduce((a,b)=>a+b,0)/amounts.length;
        const priceChange=amounts[amounts.length-1]>amounts[0]?amounts[amounts.length-1]-amounts[0]:0;
        const confidence=monthsSeen.size>=2?"recurring":"likely"; // visible signal of how sure we are
        return {description,count,amount:avg,category,monthsSeen:monthsSeen.size,lastDate,priceChange,color:COLS2[category]||"#868E96",confidence};
      })
      .sort((a,b)=>{ if(a.confidence!==b.confidence) return a.confidence==="recurring"?-1:1; return b.amount-a.amount; });
  },[monthlyData,profile?.startMonth,profile?.customCategories,profile?.subscriptions]);

  // Convenience alias for existing UI that referenced "detectedSubscriptions" — now means the declared ones
  const detectedSubscriptions=declaredSubscriptions.map(s=>({
    description:s.name,
    amount:s.monthlyEquiv,
    category:s.category||"📱 Subscription",
    monthsSeen:0,
    lastDate:"",
    priceChange:0,
    color:s.color,
    declared:true,
    id:s.id,
    frequency:s.frequency||"monthly"
  }));

  // ── INSIGHTS catalog ───────────────────────────────────────────────────────
  // Each insight: {id, label, description, value, ready} — `ready` means it has enough data to show meaningfully
  const insightCatalog=useMemo(()=>{
    const out=[];
    const allMonths=Object.entries(monthlyData).filter(([m,md])=>(md.txs||[]).length>0||Object.keys(md.incomeOverrides||{}).length>0).sort(([a],[b])=>a.localeCompare(b));
    const curM=monthlyData[selectedMonth]||{txs:[],incomeOverrides:{}};
    const curInc=totalIncome(streams,curM.incomeOverrides||{},selectedMonth);
    const curSpent=(curM.txs||[]).reduce((s,t)=>s+effectiveAmount(t),0);
    const curFix=(curM.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||selectedMonth>=c.startFrom)&&(!c.endMonth||selectedMonth<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
    const curSaved=curInc-curSpent-curFix;
    const curRate=curInc>0?(curSaved/curInc*100):null;
    // Past months (excluding current)
    const past=allMonths.filter(([m])=>m!==selectedMonth);

    // 1) Savings rate vs average
    {
      const rates=past.map(([m,md])=>{
        const inc=totalIncome(streams,md.incomeOverrides||{},m);
        const sp=(md.txs||[]).reduce((s,t)=>s+effectiveAmount(t),0);
        const fx=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
        return inc>0?((inc-sp-fx)/inc*100):null;
      }).filter(r=>r!==null);
      const avg=rates.length>0?rates.reduce((s,r)=>s+r,0)/rates.length:null;
      const ready=curRate!==null&&avg!==null&&rates.length>=2;
      out.push({
        id:"savings_vs_avg", icon:"📊", label:"Savings rate vs your average",
        description:"How your savings rate this month compares to your historical average",
        ready,
        value:ready?{rate:curRate,avg,delta:curRate-avg}:null,
        renderHome:ready?(ctx)=>{
          const better=curRate>=avg;
          return <div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:18}}>📊</span>
              <span style={{fontSize:11,color:ctx.T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>SAVINGS RATE</span>
            </div>
            <div style={{fontSize:13,color:ctx.T.textPrimary,lineHeight:1.5}}>You're saving <span style={{fontWeight:700,color:better?ctx.T.accent:ctx.T.warning}}>{curRate.toFixed(0)}%</span> this month, vs your <span style={{fontWeight:700}}>{avg.toFixed(0)}%</span> average. {better?"Nice — you're ahead of your usual.":`Down ${Math.abs(curRate-avg).toFixed(0)} points.`}</div>
          </div>;
        }:null
      });
    }

    // 2) Highest-ever per category
    {
      const curByCat={}; (curM.txs||[]).forEach(t=>{ if(t.amount>0){ curByCat[t.category]=(curByCat[t.category]||0)+effectiveAmount(t); } });
      let bestCat=null, bestAmt=0, bestRecord=0;
      Object.entries(curByCat).forEach(([cat,amt])=>{
        // Find max for this category in past months
        let record=0;
        past.forEach(([m,md])=>{ const sum=(md.txs||[]).filter(t=>t.category===cat&&t.amount>0).reduce((s,t)=>s+effectiveAmount(t),0); if(sum>record) record=sum; });
        if(amt>record&&amt>bestAmt&&record>0){ bestCat=cat; bestAmt=amt; bestRecord=record; }
      });
      const ready=!!bestCat;
      out.push({
        id:"highest_category", icon:"⚠", label:"Highest-ever in a category",
        description:"When this month tops every previous month for a category",
        ready,
        value:ready?{cat:bestCat,amt:bestAmt,prevMax:bestRecord}:null,
        renderHome:ready?(ctx)=>{
          return <div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:18}}>⚠</span>
              <span style={{fontSize:11,color:ctx.T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>NEW HIGH</span>
            </div>
            <div style={{fontSize:13,color:ctx.T.textPrimary,lineHeight:1.5}}>Your <span style={{fontWeight:700}}>{bestCat.split(" ").slice(1).join(" ")||bestCat}</span> this month is <span style={{fontWeight:700,color:ctx.T.warning}}>{ctx.fmt(bestAmt)}</span>, more than your previous high of <span style={{fontFamily:"'DM Mono'"}}>{ctx.fmt(bestRecord)}</span>.</div>
          </div>;
        }:null
      });
    }

    // 3) Subscription drift
    {
      const detected=detectedSubscriptions||[];
      const curSubTotal=detected.reduce((s,x)=>s+x.amount,0);
      // Compare with subscription total ~6 months ago
      const sixMonthsAgo=allMonths.length>=6?allMonths[allMonths.length-6]:allMonths[0];
      let oldSubTotal=0;
      if(sixMonthsAgo){
        const [m,md]=sixMonthsAgo;
        // Heuristic: a subscription is a transaction whose description appears in 2+ months around then
        const txsAround=(md.txs||[]).filter(t=>t.amount>0);
        const grouped={};
        txsAround.forEach(t=>{ const k=(t.description||"").toLowerCase(); if(!grouped[k]) grouped[k]={count:0,amt:0,n:0}; grouped[k].amt+=t.amount; grouped[k].n+=1; });
        // For each distinct merchant, just sum once (use latest)
        Object.values(grouped).forEach(g=>{ if(g.n>=1) oldSubTotal+=g.amt/g.n; });
        // Take a slimmer approximation: sum of categorically-recurring items
        oldSubTotal=(md.txs||[]).filter(t=>(t.category||"").toLowerCase().includes("subscription")||(t.description||"").toLowerCase().match(/netflix|spotify|prime|youtube|apple|hbo|disney/i)).reduce((s,t)=>s+effectiveAmount(t),0);
      }
      const diff=curSubTotal-oldSubTotal;
      const ready=curSubTotal>0&&allMonths.length>=4&&Math.abs(diff)>5;
      out.push({
        id:"sub_drift", icon:"📱", label:"Subscription drift",
        description:"Total monthly subscription cost vs months ago",
        ready,
        value:ready?{now:curSubTotal,then:oldSubTotal,diff}:null,
        renderHome:ready?(ctx)=>{
          const up=diff>0;
          return <div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:18}}>📱</span>
              <span style={{fontSize:11,color:ctx.T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>SUBSCRIPTIONS</span>
            </div>
            <div style={{fontSize:13,color:ctx.T.textPrimary,lineHeight:1.5}}>Your monthly subscriptions <span style={{fontWeight:700,color:up?ctx.T.warning:ctx.T.accent}}>{up?"grew":"shrank"} {ctx.fmt(Math.abs(diff))}</span> since you started tracking. Now <span style={{fontFamily:"'DM Mono'",fontWeight:700}}>{ctx.fmt(curSubTotal)}/mo</span>.</div>
          </div>;
        }:null
      });
    }

    // 4) Bill changes
    {
      // Look at user-defined fixedCommitments — has any amount changed in the past 3 months?
      const bills=profile?.fixedCommitments||[];
      let biggestBillChange=null;
      bills.forEach(b=>{
        // Bills have a single amount field — no history. Skip for now, leave hook for future.
      });
      const ready=false; // Bills tracking history not yet implemented; this insight is a placeholder
      out.push({
        id:"bill_changes", icon:"📄", label:"Bill changes",
        description:"Heads-up when a bill's amount changes (coming soon)",
        ready, value:null, renderHome:null, comingSoon:true
      });
    }

    // 5) Income trend
    {
      const incomes=allMonths.map(([m,md])=>totalIncome(streams,md.incomeOverrides||{},m));
      const ready=incomes.length>=4;
      if(ready){
        const recent3=incomes.slice(-4,-1); // last 3 before current
        const avgRecent=recent3.reduce((s,v)=>s+v,0)/recent3.length;
        const cur=incomes[incomes.length-1];
        const diff=cur-avgRecent;
        const pct=avgRecent>0?(diff/avgRecent*100):0;
        const ready2=Math.abs(pct)>=5; // only show if meaningfully different
        out.push({
          id:"income_trend", icon:"💰", label:"Income trend",
          description:"How this month's income compares to your recent average",
          ready:ready2,
          value:ready2?{cur,avgRecent,pct}:null,
          renderHome:ready2?(ctx)=>{
            const up=diff>0;
            return <div style={{padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:18}}>💰</span>
                <span style={{fontSize:11,color:ctx.T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>INCOME TREND</span>
              </div>
              <div style={{fontSize:13,color:ctx.T.textPrimary,lineHeight:1.5}}>Income is <span style={{fontWeight:700,color:up?ctx.T.accent:ctx.T.warning}}>{up?"up":"down"} {Math.abs(pct).toFixed(0)}%</span> vs your last 3 months. {up?"Nice month.":"Worth a look."}</div>
            </div>;
          }:null
        });
      } else {
        out.push({id:"income_trend",icon:"💰",label:"Income trend",description:"How this month's income compares to your recent average",ready:false,value:null,renderHome:null});
      }
    }

    // 6) Category vs usual
    {
      const curByCat={}; (curM.txs||[]).forEach(t=>{ if(t.amount>0){ curByCat[t.category]=(curByCat[t.category]||0)+effectiveAmount(t); } });
      let topCat=null, topAmt=0, topAvg=0, topPct=0;
      Object.entries(curByCat).forEach(([cat,amt])=>{
        const pastAmts=past.map(([m,md])=>(md.txs||[]).filter(t=>t.category===cat&&t.amount>0).reduce((s,t)=>s+effectiveAmount(t),0));
        if(pastAmts.length<2) return;
        const avg=pastAmts.reduce((s,v)=>s+v,0)/pastAmts.length;
        if(avg<10) return;
        const pct=(amt-avg)/avg*100;
        if(Math.abs(pct)>=25&&Math.abs(pct)>Math.abs(topPct)){ topCat=cat; topAmt=amt; topAvg=avg; topPct=pct; }
      });
      const ready=!!topCat&&past.length>=2;
      out.push({
        id:"category_vs_usual", icon:"📈", label:"Category vs your usual",
        description:"When a category is significantly higher or lower than your norm",
        ready,
        value:ready?{cat:topCat,amt:topAmt,avg:topAvg,pct:topPct}:null,
        renderHome:ready?(ctx)=>{
          const up=topPct>0;
          return <div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:18}}>📈</span>
              <span style={{fontSize:11,color:ctx.T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>UNUSUAL</span>
            </div>
            <div style={{fontSize:13,color:ctx.T.textPrimary,lineHeight:1.5}}><span style={{fontWeight:700}}>{topCat.split(" ").slice(1).join(" ")||topCat}</span> is <span style={{fontWeight:700,color:up?ctx.T.warning:ctx.T.accent}}>{up?"up":"down"} {Math.abs(topPct).toFixed(0)}%</span> ({ctx.fmt(topAmt)}) vs your usual {ctx.fmt(topAvg)}.</div>
          </div>;
        }:null
      });
    }

    return out;
  },[monthlyData,streams,profile,selectedMonth,detectedSubscriptions]);

  // Active insights — only enabled ones with data
  const activeInsights=insightCatalog.filter(i=>(profile?.insightPrefs||[]).includes(i.id)&&i.ready);
  // Day-rotation when more than 2 enabled — keeps it fresh
  const visibleInsights=(()=>{
    if(activeInsights.length<=2) return activeInsights;
    const day=Math.floor(Date.now()/86400000);
    const start=day%activeInsights.length;
    return [activeInsights[start],activeInsights[(start+1)%activeInsights.length]];
  })();

  // ── Handlers (upload, transactions, income) ────────────────────────────────
  const saveMD=async(month,updates)=>{
    const updated={...monthlyData,[month]:{...(monthlyData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),...updates}};
    setMonthlyData(updated); lsSave("monthlyData",updated); return updated;
  };
  const updateOv=async(streamId,amount)=>{
    const cur=(monthlyData[selectedMonth]||{}).incomeOverrides||{};
    await saveMD(selectedMonth,{incomeOverrides:{...cur,[streamId]:amount}});
  };
  const clearOv=async(streamId)=>{
    const cur={...((monthlyData[selectedMonth]||{}).incomeOverrides||{})};
    delete cur[streamId];
    await saveMD(selectedMonth,{incomeOverrides:cur});
  };
  const addOneoff=async(name,amount)=>{
    const cur=(monthlyData[selectedMonth]||{}).incomeOverrides||{};
    const id=`__oneoff_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await saveMD(selectedMonth,{incomeOverrides:{...cur,[id]:{name,amount}}});
    showToast(`✓ Added ${name}`);
  };
  const removeOneoff=async(id)=>{
    const cur={...((monthlyData[selectedMonth]||{}).incomeOverrides||{})};
    delete cur[id];
    await saveMD(selectedMonth,{incomeOverrides:cur});
    showToast("Removed");
  };
  const archiveTx=async(id,monthHint)=>{
    const m=monthHint||selectedMonth;
    const md0=monthlyData[m]||{}; const tx=(md0.txs||[]).find(t=>t.id===id); if(!tx) return;
    saveArchive([{...tx,archivedAt:new Date().toISOString()},...archive].slice(0,500));
    await saveMD(m,{txs:(md0.txs||[]).filter(t=>t.id!==id)});
    showToast("Moved to archive");
  };
  const editTx=async(draft,monthHint)=>{
    const m=monthHint||selectedMonth;
    const md0=monthlyData[m]||{};
    await saveMD(m,{txs:(md0.txs||[]).map(t=>t.id===draft.id?draft:t)});
    showToast("Updated");
  };
  // Find a transaction by ID across all months (used for search-result clicks)
  const findTx=id=>{
    for(const [m,md] of Object.entries(monthlyData)){
      const t=(md.txs||[]).find(t=>t.id===id);
      if(t) return {tx:t,month:m};
    }
    return null;
  };
  const addManual=async({description,amount,category,date})=>{
    if(!description?.trim()||!amount||isNaN(+amount)||+amount<=0) return;
    const tx={id:Date.now()+Math.random(),date:date||todayStr(),description:description.trim(),category,amount:parseFloat(amount),source:"manual"};
    const month=monthKey(tx.date);
    if(profile?.startMonth&&month<profile.startMonth){ showToast("⚠ Before your start month"); return; }
    const ex=(monthlyData[month]||{}).txs||[];
    await saveMD(month,{txs:[tx,...ex]});
    showToast(`✓ Added ${tx.description}`);
    if(month!==selectedMonth) setSelectedMonth(month);
  };

  const CATS=getAllCats(profile?.customCategories);
  const parseChunk=async(content)=>{
    const prompt=`You are a bank statement parser. Extract ALL transactions without exception — every single line item. Rules:
1. If amount has "CR" after it set "isCredit":true, otherwise false.
2. For recurring fixed payments (insurance, loan, rent, subscription) use one of: ${FIXED_CATS.map(c=>JSON.stringify(c)).join(",")}.
3. Otherwise use one of: ${CATS.map(c=>JSON.stringify(c)).join(",")}.
4. Do NOT skip, group, or summarise. Extract every row.
Return ONLY a valid JSON array. Each object: {"date":"YYYY-MM-DD","description":"cleaned merchant name","amount":positive_number,"isCredit":boolean,"category":string}. Output ONLY the JSON array.`;
    const body=typeof content==="string"?`${prompt}\n\nStatement:\n${content}`:[...content,{type:"text",text:prompt}];
    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),290000);
    let res;
    try{ res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:16000,messages:[{role:"user",content:body}]}),signal:controller.signal}); }
    finally{ clearTimeout(timeoutId); }
    if(!res.ok){
      let msg=`Server error ${res.status}`;
      let detail=null;
      try{
        const errBody=await res.text();
        try{
          const errJSON=JSON.parse(errBody);
          msg=errJSON.error?.message||errJSON.error||errJSON.detail||errJSON.message||msg;
          detail=JSON.stringify(errJSON,null,2);
        }catch(e){
          // Not JSON — keep raw text as detail
          detail=errBody.slice(0,800);
          if(errBody.trim()) msg=`${msg}: ${errBody.slice(0,200)}`;
        }
      }catch(e){}
      const err=new Error(msg);
      err.detail=detail;
      err.status=res.status;
      throw err;
    }
    const reader=res.body.getReader(); const dec=new TextDecoder();
    let finalData=null;
    while(true){
      const {done,value}=await reader.read(); if(done) break;
      const text=dec.decode(value,{stream:true});
      for(const line of text.split("\n")){
        if(!line.startsWith("data: ")) continue;
        const d=line.slice(6).trim(); if(!d) continue;
        try{ const p=JSON.parse(d); if(p.done&&p.content) finalData=p; if(p.error) throw new Error(p.error); }
        catch(e){ if(e.message&&!e.message.startsWith("Unexpected")) throw e; }
      }
    }
    if(!finalData) throw new Error("No response received from API");
    let raw=finalData.content?.map(b=>b.text||"").join("").trim().replace(/^```json|^```|```$/gm,"").trim();
    if(!raw||!raw.startsWith("[")) throw new Error("No valid JSON returned from API");
    if(!raw.endsWith("]")){ const lb=raw.lastIndexOf("}"); if(lb!==-1) raw=raw.slice(0,lb+1)+"]"; else throw new Error("Incomplete response — try a smaller file"); }
    return JSON.parse(raw);
  };

  const handleFile=async e=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true); setUploadMsg("");
    setUploadFile({name:file.name,size:file.size}); setUploadStep(1); setUploadTxCount(0);
    try{
      let parsed=[];
      const isImage=/^image\//i.test(file.type); const isPDF=file.name.toLowerCase().endsWith(".pdf");
      if(isImage||isPDF){
        const base64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
        setUploadStep(2);
        parsed=await parseChunk([{type:"document",source:{type:"base64",media_type:isImage?file.type:"application/pdf",data:base64}}]);
      } else {
        const text=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); });
        setUploadStep(2);
        const chunks=splitCSV(text,15000);
        for(let i=0;i<chunks.length;i++){ parsed=[...parsed,...await parseChunk(chunks[i])]; }
      }
      if(!Array.isArray(parsed)||!parsed.length) throw new Error("No transactions found in statement");
      setUploadStep(3); setUploadTxCount(parsed.length);
      const seen=new Set(); parsed=parsed.filter(t=>{ const k=`${t.date}|${(t.description||"").toLowerCase()}|${Math.abs(parseFloat(t.amount)||0)}`; if(seen.has(k)) return false; seen.add(k); return true; });
      const fixedDetected=[]; const nonce=Date.now()+Math.random();
      const imported=parsed.map((t,i)=>{
        const isCredit=!!t.isCredit;
        const amount=isCredit?-(Math.abs(parseFloat(t.amount)||0)):Math.abs(parseFloat(t.amount)||0);
        const validCats=[...CATS,...FIXED_CATS];
        const cat=validCats.includes(t.category)?t.category:"📦 Other";
        if(isFixedCat(cat)&&!isCredit){
          fixedDetected.push({id:`fd${nonce}${i}`,description:t.description||"Unknown",category:cat,rawAmount:Math.abs(amount),date:t.date||todayStr(),fullTx:{id:`${nonce}${i}f`,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:true}});
          return null;
        }
        return {id:`${nonce}${i}`,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:true};
      }).filter(Boolean);
      setPendingTxs(p=>[...p,...imported]);
      if(fixedDetected.length>0) setFixedCommitDetected(fixedDetected);
      // Compute progressive reveal insight
      const debits=imported.filter(t=>t.amount>0);
      const totalSpent=debits.reduce((s,t)=>s+effectiveAmount(t),0);
      const catTotals={}; debits.forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.amount;});
      const sortedCats=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
      const topCat=sortedCats[0]?sortedCats[0][0]:null;
      const months=[...new Set(imported.map(t=>monthKey(t.date)))].sort();
      setUploadInsight({topCat,totalSpent,monthsCovered:months.length});
      setUploadStep(4); setUploadTxCount(imported.length);
      setUploadMsg(`✓ Found ${imported.length} transactions across ${months.length} month${months.length>1?"s":""}`);
      // Allow more time on step 4 for the user to see the reveal before opening review
      setTimeout(()=>{setSubScreen("review");},1800);
    }catch(err){
      console.error("Upload error:",err); if(err.detail) console.error("Error detail:",err.detail);
      const msg=err.message||"Unknown error"; setUploadStep(0);
      // Capture detail for diagnostic toggle
      setUploadErrDetail(err.detail||`${err.name||"Error"}: ${msg}${err.status?` (HTTP ${err.status})`:""}`);
      setUploadErrExpanded(false);
      // Friendly message with the ACTUAL error text included
      if(msg.includes("504")||msg.includes("timeout")||msg.toLowerCase().includes("aborted")) setUploadMsg(`⚠ Timed out — ${msg}`);
      else if(msg.toLowerCase().includes("api key")||msg.includes("401")) setUploadMsg(`⚠ API key issue — ${msg}`);
      else if(msg.includes("429")||msg.toLowerCase().includes("rate")) setUploadMsg(`⚠ Rate limited — ${msg}`);
      else if(msg.toLowerCase().includes("model")) setUploadMsg(`⚠ Model error — ${msg}`);
      else if(msg.toLowerCase().includes("credit")||msg.toLowerCase().includes("billing")) setUploadMsg(`⚠ Billing issue — ${msg}`);
      else if(msg.includes("No transactions")) setUploadMsg("⚠ No transactions found. Check the file.");
      else setUploadMsg(`⚠ ${msg}`);
    }
    finally{
      setUploading(false); e.target.value="";
      // Auto-clear only success messages (✓), keep errors visible until user dismisses
      setTimeout(()=>{
        setUploadMsg(prev=>prev.startsWith("✓")?"":prev);
        if(!uploadErrDetail) setUploadStep(0);
        setUploadFile(null);
      },8000);
    }
  };

  const handleFixedCommitConfirm=confirmed=>{
    const existing=profile?.fixedCommitments||[];
    const existNames=new Set(existing.map(c=>c.name?.toLowerCase()));
    const toAdd=confirmed.filter(c=>!existNames.has(c.description?.toLowerCase())).map(c=>({id:`c${Date.now()}${Math.random()}`,name:c.description,amount:c.rawAmount,startFrom:"",endMonth:""}));
    if(toAdd.length>0){saveProfile({...profile,fixedCommitments:[...existing,...toAdd]});showToast(`✓ Added ${toAdd.length} fixed commitment${toAdd.length>1?"s":""}`);}
    const allDetected=fixedCommitDetected||[];
    const confirmedDescs=new Set(confirmed.map(c=>c.description));
    const toReview=allDetected.filter(c=>!confirmedDescs.has(c.description)&&c.fullTx).map(c=>c.fullTx);
    if(toReview.length>0) setPendingTxs(p=>[...p,...toReview]);
    setFixedCommitDetected(null);
  };
  const handleRecurringConfirm=confirmed=>{
    const existing=profile?.fixedCommitments||[];
    const existNames=new Set(existing.map(c=>c.name?.toLowerCase()));
    const toAdd=confirmed.filter(s=>!existNames.has(s.description?.toLowerCase())).map(s=>({id:`c${Date.now()}${Math.random()}`,name:s.description,amount:Math.round(s.amount*100)/100,startFrom:"",endMonth:""}));
    if(toAdd.length>0){saveProfile({...profile,fixedCommitments:[...existing,...toAdd]});showToast(`✓ Added ${toAdd.length} recurring commitment${toAdd.length>1?"s":""}`);}
    setRecurringDetected(null);
  };

  // Detect subscriptions (recurring across 2+ months) for the Subscriptions section
  // ── You-tab hooks (must be at top level, BEFORE early returns) ─────────────
  const [youSection,setYouSection]=useState(null);
  const [pName,setPName]=useState((profile?.name)||"");
  const [pOcc,setPOcc]=useState((profile?.occupation)||"");
  const [pCurrency,setPCurrency]=useState((profile?.currency)||"SGD");
  const [pStartMonth,setPStartMonth]=useState((profile?.startMonth)||currentMonth());
  useEffect(()=>{
    if(!profile) return;
    setPName(profile.name||"");
    setPOcc(profile.occupation||"");
    setPCurrency(profile.currency||"SGD");
    setPStartMonth(profile.startMonth||currentMonth());
  },[profile]);
  const avatarRef=useRef();
  const restoreFileRef=useRef();

  // ── Loading / PIN gate ──────────────────────────────────────────────────────
  const savedAccent = lsLoad("profile")?.accentColor || CALM_DEFAULT_ACCENT;
  const savedBg     = lsLoad("profile")?.bgColor     || CALM_DEFAULT_BG;
  if(!pinUnlocked&&!pinSkipped){
    return <ThemeCtx.Provider value={buildTheme(savedAccent,savedBg)}>
      <PinScreen storedHash={pinHash||null} onUnlock={()=>setPinUnlocked(true)}
        onSetup={pin=>{ if(pin){ const h=hashPin(pin); lsSave("pinHash",h); setPinHash(h); } setPinUnlocked(true); }}
        onSkip={()=>setPinSkipped(true)}/>
    </ThemeCtx.Provider>;
  }
  if(!profile){
    return <div style={{minHeight:"100vh",background:savedBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:savedAccent,fontFamily:"'DM Mono'",marginBottom:8,opacity:.8}}>Welcome back</div>
        <div style={{fontSize:24,fontWeight:700,color:isLight(savedBg)?"#1A1714":"#EEEAE0"}}>$how Me The Money</div>
      </div>
      <div style={{display:"flex",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:savedAccent,opacity:.3,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>;
  }
  if(!profile.onboarded) return <ThemeCtx.Provider value={theme}><Onboarding onComplete={(p,opts)=>{
    saveProfile(p);
    if(opts?.preview){
      // Load the sample data that Onboarding wrote to localStorage into state
      const sample=lsLoad("monthlyData")||{};
      setMonthlyData(sample);
      setPreviewMode(true);
    }
  }}/></ThemeCtx.Provider>;

  // ── Compute current-month derived values for Home ──────────────────────────
  const md=monthlyData[selectedMonth]||{txs:[],incomeOverrides:{}};
  const ov=md.incomeOverrides||{};
  const incTotal=totalIncome(streams,ov,selectedMonth);
  const txs=md.txs||[];
  const varTotal=txs.reduce((s,t)=>s+effectiveAmount(t),0);
  const monthFixed=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||selectedMonth>=c.startFrom)&&(!c.endMonth||selectedMonth<=c.endMonth));
  const fixedTotal=monthFixed.reduce((s,c)=>s+(+c.amount||0),0);
  const saved=incTotal-varTotal-fixedTotal;
  const savingsRate=incTotal>0?(saved/incTotal*100):0;
  const pm=prevMonth(selectedMonth);
  const pmd=monthlyData[pm]||{txs:[],incomeOverrides:{}};
  const prevOv=pmd.incomeOverrides||{};
  const prevVarTotal=(pmd.txs||[]).reduce((s,t)=>s+effectiveAmount(t),0);
  const prevIncTotal=totalIncome(streams,prevOv,pm);
  const prevFixed=(pmd.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||pm>=c.startFrom)&&(!c.endMonth||pm<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const prevSaved=prevIncTotal-prevVarTotal-prevFixed;
  const savedDelta=saved-prevSaved;
  const byCat=(()=>{ const m={}; txs.forEach(t=>{m[t.category]=(m[t.category]||0)+effectiveAmount(t);}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); })();
  const COLS=getAllCatCols(profile.customCategories);
  const today=new Date();
  const isCurMonth=monthKey(today.toISOString())===selectedMonth;
  const dayOfMonth=isCurMonth?today.getDate():30;
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const projected=isCurMonth&&dayOfMonth>5?Math.round(varTotal*(daysInMonth/dayOfMonth)):varTotal;
  const projectedSaved=incTotal-fixedTotal-projected;
  const totalBar=Math.max(1,fixedTotal+varTotal+Math.max(0,saved));
  const billsFlex=fixedTotal/totalBar;
  const spentFlex=varTotal/totalBar;
  const savedFlex=Math.max(0,saved)/totalBar;
  const firstName=(profile.name||"there").split(" ")[0];

  const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];

  // ── MONEY tab content ──────────────────────────────────────────────────────
  const allCats=[...CATS,...FIXED_CATS];
  const oneoffEntries=Object.entries(ov).filter(([k])=>k.startsWith("__oneoff_")).map(([k,v])=>({id:k,...(typeof v==="object"?v:{name:"One-off",amount:v})}));
  const totalSpentForDonut=byCat.reduce((s,[,a])=>s+Math.abs(a),0);
  const filteredTxs=catFilter==="All"?txs:txs.filter(t=>t.category===catFilter);

  // Donut SVG calculation
  const DonutChart=()=>{
    if(byCat.length===0||totalSpentForDonut===0) return null;
    const r=38; const c=2*Math.PI*r;
    let acc=0;
    return <svg width="110" height="110" viewBox="0 0 100 100" style={{flexShrink:0}}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={T.surface2} strokeWidth="14"/>
      {byCat.map(([cat,amt],i)=>{
        const len=(Math.abs(amt)/totalSpentForDonut)*c;
        const off=-acc; acc+=len;
        return <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={COLS[cat]||T.accent} strokeWidth="14" strokeDasharray={`${len} ${c}`} strokeDashoffset={off} transform="rotate(-90 50 50)"/>;
      })}
      <text x="50" y="46" textAnchor="middle" fontSize="9" fill={T.textMuted} fontFamily="DM Mono" letterSpacing="1">SPENT</text>
      <text x="50" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill={T.textPrimary} fontFamily="Bricolage Grotesque">{fmt(varTotal).replace(/[.]00$/,"")}</text>
    </svg>;
  };

  // Inline editable amount for variable income rows
  const VarIncomeRow=({stream,amount})=>{
    const draftKey=`${stream.id}__${selectedMonth}`;
    const draft=varDrafts[draftKey]!==undefined?varDrafts[draftKey]:(amount===null||amount===undefined?"":String(amount));
    const flash=!!varFlash[draftKey];
    const isSaved=amount!==null&&amount!==undefined;
    const setDraft=v=>setVarDrafts(d=>({...d,[draftKey]:v}));
    const dirty=isSaved?String(amount)!==String(parseFloat(draft)):draft.trim()!=="";
    const save=()=>{ if(!dirty) return; const v=parseFloat(draft); if(draft===""||isNaN(v)||v<0) return; updateOv(stream.id,v); setVarFlash(f=>({...f,[draftKey]:true})); setTimeout(()=>setVarFlash(f=>{const n={...f};delete n[draftKey];return n;}),1600); };
    const clear=()=>{ setDraft(""); clearOv(stream.id); };
    return <div style={{padding:"12px 0",borderBottom:`1px solid ${T.borderSoft}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:T.warning,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{stream.name}</div>
          <div style={{fontSize:10,color:flash?T.positive:T.warning,fontFamily:"'DM Mono'",fontWeight:600,transition:"color .2s"}}>{flash?"✓ SAVED":`VARIABLE${!isSaved?" · needs amount":""}`}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input type="number" inputMode="decimal" placeholder="Enter amount" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==="Enter"){save();e.target.blur();}}} style={{flex:1,padding:"10px 12px",background:flash?T.accentSoft:T.surface2,border:`1px solid ${flash?T.accent:T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:14,fontWeight:600,outline:"none",transition:"all .2s"}}/>
        {isSaved&&<button onClick={clear} title="Clear" style={{padding:"10px 12px",background:"transparent",border:`1px solid ${T.borderMid}`,borderRadius:10,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer"}}>×</button>}
      </div>
    </div>;
  };

  const FixedIncomeRow=({stream,amount})=><div style={{padding:"12px 0",borderBottom:`1px solid ${T.borderSoft}`,display:"flex",alignItems:"center",gap:10}}>
    <div style={{width:8,height:8,borderRadius:"50%",background:T.info,flexShrink:0}}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{stream.name}</div>
      <div style={{fontSize:10,color:T.info,fontFamily:"'DM Mono'",fontWeight:600}}>FIXED</div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:T.textPrimary,cursor:"pointer"}} onClick={()=>{const v=prompt(`Update ${stream.name} for ${monthLabel(selectedMonth)}:`,String(amount||0));if(v!==null){const n=parseFloat(v);if(!isNaN(n)&&n>=0) updateOv(stream.id,n);}}}>{fmt(amount||0)}</div>
  </div>;

  const OneoffRow=({entry})=><div style={{padding:"12px 0",borderBottom:`1px solid ${T.borderSoft}`,display:"flex",alignItems:"center",gap:10}}>
    <div style={{width:8,height:8,borderRadius:"50%",background:T.positive,flexShrink:0}}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{entry.name}</div>
      <div style={{fontSize:10,color:T.positive,fontFamily:"'DM Mono'",fontWeight:600}}>ONE-OFF</div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:T.textPrimary,marginRight:6}}>{fmt(entry.amount||0)}</div>
    <button onClick={()=>removeOneoff(entry.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1}}>×</button>
  </div>;

  const AddOneoffForm=()=>{
    const submit=()=>{ const v=parseFloat(oneoffAmt); if(!oneoffName.trim()||isNaN(v)||v<=0) return; addOneoff(oneoffName.trim(),v); setOneoffName("");setOneoffAmt("");setAddOneoffOpen(false); };
    if(!addOneoffOpen) return <button onClick={()=>setAddOneoffOpen(true)} style={{width:"100%",padding:"12px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:12,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",marginTop:10}}>+ Add one-off income (bonus, refund, gift…)</button>;
    return <div style={{padding:"12px 0",borderTop:`1px solid ${T.borderSoft}`,display:"flex",flexDirection:"column",gap:8}}>
      <MicroLabel>Add one-off income</MicroLabel>
      <input placeholder="Name (e.g. Tax refund, Bonus)" value={oneoffName} onChange={e=>setOneoffName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}} autoFocus/>
      <input type="number" inputMode="decimal" placeholder="Amount" value={oneoffAmt} onChange={e=>setOneoffAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{padding:"10px 12px",background:T.surface2
