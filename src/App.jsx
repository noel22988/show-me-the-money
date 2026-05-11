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
  incomeStreams:[],fixedCommitments:[],goals:[],
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
        <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,letterSpacing:-0.6,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>What's your main goal?</div>
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
      out.push({month:m,saved:inc-spent-fix,projected,isCurrent,hasData:(md.txs||[]).length>0||Object.keys(md.incomeOverrides||{}).length>0});
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

  const detectedSubscriptions=useMemo(()=>{
    const months=Object.keys(monthlyData).filter(m=>!profile?.startMonth||m>=profile.startMonth).sort();
    if(months.length<1) return [];
    const desc={};
    months.forEach(m=>{(monthlyData[m]?.txs||[]).forEach(t=>{
      const k=t.description?.toLowerCase().trim(); if(!k) return;
      if(!desc[k]) desc[k]={count:0,amounts:[],description:t.description,category:t.category,monthsSeen:new Set(),lastDate:""};
      desc[k].count++; desc[k].amounts.push(Math.abs(t.amount)); desc[k].monthsSeen.add(m);
      if(t.date>desc[k].lastDate) desc[k].lastDate=t.date;
    });});
    const COLS=getAllCatCols(profile?.customCategories);
    return Object.values(desc)
      .filter(({monthsSeen,category})=>monthsSeen.size>=2&&(category==="📱 Subscription"||category==="🎬 Entertainment"))
      .map(({description,count,amounts,category,monthsSeen,lastDate})=>{
        const avg=amounts.reduce((a,b)=>a+b,0)/amounts.length;
        const stdDev=Math.sqrt(amounts.reduce((s,a)=>s+(a-avg)**2,0)/amounts.length);
        const priceChange=amounts[amounts.length-1]>amounts[0]?amounts[amounts.length-1]-amounts[0]:0;
        return {description,count,amount:avg,category,monthsSeen:monthsSeen.size,lastDate,priceChange,color:COLS[category]||"#868E96"};
      })
      .sort((a,b)=>b.amount-a.amount);
  },[monthlyData,profile?.startMonth,profile?.customCategories]);

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
    if(!res.ok){ let msg=`Server error ${res.status}`; try{const e=await res.json();msg=e.error||e.detail||msg;}catch(e){} throw new Error(msg); }
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
      console.error(err); const msg=err.message||"Unknown error"; setUploadStep(0);
      if(msg.includes("504")||msg.includes("timeout")||msg.includes("aborted")) setUploadMsg("⚠ Timed out. Try a smaller file or better connection.");
      else if(msg.includes("API key")) setUploadMsg("⚠ API key not configured.");
      else if(msg.includes("No transactions")) setUploadMsg("⚠ No transactions found. Check the file.");
      else setUploadMsg(`⚠ ${msg}`);
    }
    finally{ setUploading(false); e.target.value=""; setTimeout(()=>{setUploadMsg("");setUploadStep(0);setUploadFile(null);},8000); }
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
      <input type="number" inputMode="decimal" placeholder="Amount" value={oneoffAmt} onChange={e=>setOneoffAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:13,outline:"none"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={submit} disabled={!oneoffName.trim()||!oneoffAmt||parseFloat(oneoffAmt)<=0} style={{flex:1,padding:"10px",background:oneoffName.trim()&&parseFloat(oneoffAmt)>0?T.accent:T.border,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:13,color:oneoffName.trim()&&parseFloat(oneoffAmt)>0?"#fff":T.textMuted,cursor:"pointer"}}>Add</button>
        <button onClick={()=>{setAddOneoffOpen(false);setOneoffName("");setOneoffAmt("");}} style={{padding:"10px 18px",background:"transparent",border:`1px solid ${T.borderMid}`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer"}}>Cancel</button>
      </div>
    </div>;
  };

  const incomeRows=getMonthStreams(streams,ov,selectedMonth);

  // ── Commit reviewed transactions ────────────────────────────────────────────
  const commitTransactions=async()=>{
    const checked=pendingTxs.filter(t=>t.checked);
    const skipped=pendingTxs.filter(t=>!t.checked);
    // Save checked as new transactions to their respective months
    const byMonth={};
    checked.forEach(t=>{ const m=monthKey(t.date); if(!byMonth[m]) byMonth[m]=[]; byMonth[m].push({id:t.id,date:t.date,description:t.description,category:t.category,amount:t.amount,source:t.source||"imported"}); });
    let updated={...monthlyData};
    for(const [m,txs] of Object.entries(byMonth)){
      const cur=(updated[m]||{}).txs||[];
      updated={...updated,[m]:{...(updated[m]||{txs:[],incomeOverrides:{}}),txs:[...txs,...cur]}};
    }
    setMonthlyData(updated); lsSave("monthlyData",updated);
    // Archive skipped transactions (recoverable later)
    if(skipped.length>0){
      saveArchive([...skipped.map(t=>({...t,archivedAt:new Date().toISOString()})),...archive].slice(0,500));
    }
    setPendingTxs([]); setSubScreen(null);
    showToast(`✓ Saved ${checked.length} transaction${checked.length!==1?"s":""}${skipped.length>0?` · ${skipped.length} skipped`:""}`);
  };

  // ── REVIEW screen — Tinder-style swipe with undo ─────────────────────────
  const ReviewScreen=()=>{
    const cardRef=reviewCardRef;
    const startX=reviewStartX;
    const undoTimer=reviewUndoTimer;
    const COLS=getAllCatCols(profile.customCategories);

    const remaining=pendingTxs.filter(t=>!reviewDecisions.find(d=>d.id===t.id));
    const current=remaining[0];
    const next=remaining[1];
    const total=pendingTxs.length;
    const done=reviewDecisions.length;
    const allDone=done>=total;

    const decide=(kept)=>{
      if(!current||reviewExiting) return;
      setReviewExiting({id:current.id,direction:kept?"right":"left"});
      setTimeout(()=>{
        setReviewDecisions(d=>[...d,{id:current.id,kept}]);
        setReviewExiting(null); setReviewDrag({x:0,active:false});
        clearTimeout(undoTimer.current);
        setReviewUndoToast({tx:current,kept});
        undoTimer.current=setTimeout(()=>setReviewUndoToast(null),8000);
      },220);
    };
    const undo=()=>{
      if(!reviewUndoToast) return;
      setReviewDecisions(d=>d.filter(x=>x.id!==reviewUndoToast.tx.id));
      clearTimeout(undoTimer.current);
      setReviewUndoToast(null);
    };
    const onTouchStart=e=>{ if(reviewExiting) return; startX.current=e.touches?e.touches[0].clientX:e.clientX; setReviewDrag({x:0,active:true}); };
    const onTouchMove=e=>{ if(!reviewDrag.active||reviewExiting) return; const x=(e.touches?e.touches[0].clientX:e.clientX)-startX.current; setReviewDrag({x,active:true}); };
    const onTouchEnd=()=>{
      if(!reviewDrag.active||reviewExiting) return;
      const TH=80;
      if(reviewDrag.x>TH) decide(true);
      else if(reviewDrag.x<-TH) decide(false);
      else setReviewDrag({x:0,active:false});
    };

    const finish=async()=>{
      const updated=pendingTxs.map(t=>{ const d=reviewDecisions.find(x=>x.id===t.id); return {...t,checked:d?d.kept:true}; });
      setPendingTxs(updated);
      setReviewDecisions([]); setReviewKeepAllConfirm(false); setReviewUndoToast(null);
      setTimeout(()=>commitTransactions(),50);
    };
    const keepAll=()=>{
      const updated=pendingTxs.map(t=>({...t,checked:true}));
      setPendingTxs(updated);
      setReviewDecisions([]); setReviewKeepAllConfirm(false); setReviewUndoToast(null);
      setTimeout(()=>commitTransactions(),50);
    };

    if(pendingTxs.length===0){
      return <div style={{padding:"40px 18px",textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:14}}>✨</div>
        <div style={{fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Nothing to review</div>
        <div style={{fontSize:13,color:T.textSecondary,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>Upload a bank statement using the green + button and your transactions will appear here.</div>
      </div>;
    }

    if(allDone){
      const kept=reviewDecisions.filter(d=>d.kept).length;
      const skipped=reviewDecisions.length-kept;
      return <div style={{padding:"40px 18px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:14}}>🎉</div>
        <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.5}}>All done!</div>
        <div style={{fontSize:14,color:T.textSecondary,marginBottom:24,lineHeight:1.6}}>You kept <span style={{fontWeight:700,color:T.accent}}>{kept}</span> and skipped <span style={{fontWeight:700,color:T.negative}}>{skipped}</span>.</div>
        <Btn onClick={finish} style={{maxWidth:280,margin:"0 auto"}}>Save these transactions</Btn>
        <button onClick={()=>{setReviewDecisions([]);}} style={{marginTop:14,background:"none",border:"none",color:T.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Start over</button>
      </div>;
    }

    if(reviewKeepAllConfirm){
      return <div style={{padding:"40px 18px",textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:14}}>📋</div>
        <div style={{fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Keep all {total - done}?</div>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:24,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>This skips review and saves everything. You can still edit or delete later.</div>
        <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
          <Btn variant="ghost" onClick={()=>setReviewKeepAllConfirm(false)} size="sm">Cancel</Btn>
          <Btn onClick={keepAll} size="sm">Keep all</Btn>
        </div>
      </div>;
    }

    if(!current) return null;

    const rotation=reviewDrag.x*0.06;
    const tint=reviewDrag.x>0?T.accent:reviewDrag.x<0?T.negative:null;
    const tintOpacity=Math.min(0.18,Math.abs(reviewDrag.x)/250);
    const isCredit=current.amount<0;

    return <div style={{padding:"0 18px"}}>
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'",fontWeight:600}}>
          <span>{done} OF {total}</span>
          <button onClick={()=>setReviewKeepAllConfirm(true)} style={{background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono'",fontWeight:600,padding:0}}>SKIP REVIEW →</button>
        </div>
        <div style={{height:4,background:T.borderSoft,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(done/total)*100}%`,background:T.accent,borderRadius:4,transition:"width .25s"}}/>
        </div>
      </div>

      <div style={{position:"relative",height:380,marginBottom:24}}>
        {next&&<div style={{position:"absolute",top:8,left:6,right:6,bottom:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:22,boxShadow:T.cardShadow,opacity:0.5,transform:"scale(0.96)"}}/>}
        <div ref={cardRef}
             onMouseDown={onTouchStart} onMouseMove={reviewDrag.active?onTouchMove:undefined} onMouseUp={onTouchEnd} onMouseLeave={reviewDrag.active?onTouchEnd:undefined}
             onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
             style={{position:"absolute",inset:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:22,padding:22,boxShadow:T.cardShadow,cursor:reviewExiting?"default":"grab",transform:reviewExiting?`translateX(${reviewExiting.direction==="right"?500:-500}px) rotate(${reviewExiting.direction==="right"?20:-20}deg)`:`translateX(${reviewDrag.x}px) rotate(${rotation}deg)`,transition:reviewExiting?"transform .22s ease-out":reviewDrag.active?"none":"transform .2s",userSelect:"none",touchAction:"pan-y"}}>
          {tint&&<div style={{position:"absolute",inset:0,background:tint,opacity:tintOpacity,borderRadius:22,pointerEvents:"none"}}/>}
          {reviewDrag.x>30&&<div style={{position:"absolute",top:24,left:24,padding:"6px 14px",border:`3px solid ${T.accent}`,borderRadius:8,color:T.accent,fontSize:18,fontWeight:800,transform:"rotate(-10deg)",letterSpacing:1}}>KEEP</div>}
          {reviewDrag.x<-30&&<div style={{position:"absolute",top:24,right:24,padding:"6px 14px",border:`3px solid ${T.negative}`,borderRadius:8,color:T.negative,fontSize:18,fontWeight:800,transform:"rotate(10deg)",letterSpacing:1}}>SKIP</div>}

          <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.5}}>{current.date}</div>
              {isCredit&&<div style={{fontSize:10,fontWeight:700,color:T.positive,padding:"2px 8px",border:`1px solid ${T.positive}40`,borderRadius:6,fontFamily:"'DM Mono'"}}>CREDIT</div>}
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
              <div style={{width:64,height:64,borderRadius:18,background:(COLS[current.category]||T.accent)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:14}}>{current.category?.split(" ")[0]||"📦"}</div>
              <div style={{fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.4,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{current.description}</div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:16}}>{current.category}</div>
              <div style={{fontSize:42,fontWeight:700,color:isCredit?T.positive:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-1.5,lineHeight:1}}>{isCredit?"+":""}{fmt(Math.abs(current.amount))}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:14}}>
        <button onClick={()=>decide(false)} style={{width:64,height:64,borderRadius:32,background:T.surface,border:`2px solid ${T.negative}40`,color:T.negative,fontSize:28,cursor:"pointer",fontFamily:"inherit",boxShadow:T.cardShadow,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <select value={current.category} onChange={e=>{ setPendingTxs(p=>p.map(t=>t.id===current.id?{...t,category:e.target.value}:t)); }} style={{padding:"0 18px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:32,color:T.textSecondary,fontFamily:"inherit",fontSize:12,cursor:"pointer",outline:"none"}}>{[...CATS,...FIXED_CATS].map(c=><option key={c}>{c}</option>)}</select>
        <button onClick={()=>decide(true)} style={{width:64,height:64,borderRadius:32,background:T.accent,border:"none",color:"#fff",fontSize:30,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 18px ${T.accent}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>♥</button>
      </div>
      <div style={{textAlign:"center",fontSize:11,color:T.textMuted}}>Swipe right to keep · left to skip</div>

      {reviewUndoToast&&<div style={{position:"fixed",bottom:108,left:"50%",transform:"translateX(-50%)",background:T.textPrimary,color:T.surface,borderRadius:24,padding:"10px 14px 10px 22px",fontSize:13,zIndex:3000,display:"flex",alignItems:"center",gap:14,boxShadow:"0 12px 32px rgba(0,0,0,0.3)"}}>
        <span>{reviewUndoToast.kept?"✓ Kept":"✕ Skipped"} {reviewUndoToast.tx.description.slice(0,18)}{reviewUndoToast.tx.description.length>18?"…":""}</span>
        <button onClick={undo} style={{background:"none",border:"none",color:T.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",padding:"4px 8px"}}>UNDO</button>
      </div>}
    </div>;
  };
  const handleAvatarUpload=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{ saveProfile({...profile,avatar:ev.target.result}); showToast("Avatar updated"); };
    r.readAsDataURL(f);
    e.target.value="";
  };
  const handleRestoreFile=e=>{
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=()=>{ try{ const snap=JSON.parse(r.result); if(!snap.version||!snap.profile) throw new Error("Invalid"); setRestoreCandidate(snap); }catch{ showToast("⚠ Invalid backup file"); } };
    r.readAsText(file); e.target.value="";
  };

  const youAccent=profile.accentColor||CALM_DEFAULT_ACCENT;
  const youBg=profile.bgColor||CALM_DEFAULT_BG;
  const txCount=countAllTx(monthlyData);
  const moCount=Object.keys(monthlyData).length;

  const SettingsRow=({icon,label,desc,onClick,danger})=><button onClick={onClick} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"transparent",border:"none",borderTop:`1px solid ${T.borderSoft}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left",color:danger?T.negative:T.textPrimary}}>
    <span style={{fontSize:18,width:24,flexShrink:0,textAlign:"center"}}>{icon}</span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:600}}>{label}</div>
      {desc&&<div style={{fontSize:11,color:T.textMuted,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</div>}
    </div>
    <span style={{fontSize:14,color:T.textMuted,flexShrink:0}}>›</span>
  </button>;

  const SettingsGroup=({title,children})=><div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,marginBottom:14,overflow:"hidden",boxShadow:T.cardShadow}}>
    <div style={{padding:"14px 16px 6px",fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase"}}>{title}</div>
    {children}
  </div>;

  const IdentitySection=()=>{
    const saveIdentity=()=>{ saveProfile({...profile,name:pName.trim(),occupation:pOcc.trim(),currency:pCurrency,startMonth:pStartMonth}); showToast("✓ Profile updated"); setYouSection(null); };    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <div onClick={()=>avatarRef.current.click()} style={{position:"relative",width:64,height:64,flexShrink:0,cursor:"pointer"}}>
          {profile.avatar?<img src={profile.avatar} alt="" style={{width:64,height:64,borderRadius:32,objectFit:"cover"}}/>:<div style={{width:64,height:64,borderRadius:32,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:T.accent}}>{(profile.name||"?")[0].toUpperCase()}</div>}
          <div style={{position:"absolute",bottom:-2,right:-2,width:22,height:22,borderRadius:11,background:T.accent,border:`2px solid ${T.surface}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>✎</div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
          <input value={pName} onChange={e=>setPName(e.target.value)} placeholder="Your name" style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
          <input value={pOcc} onChange={e=>setPOcc(e.target.value)} placeholder="Occupation (optional)" style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:5,fontWeight:500}}>Currency</div>
          <select value={pCurrency} onChange={e=>setPCurrency(e.target.value)} style={{width:"100%",padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:5,fontWeight:500}}>Tracking from</div>
          <input type="month" value={pStartMonth} onChange={e=>setPStartMonth(e.target.value)} style={{width:"100%",padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
        </div>
      </div>
      <Btn onClick={saveIdentity} size="sm">Save changes</Btn>
    </div>;
  };

  const GoalSection=()=>{
    const cur=profile.goal||{type:null,params:{}};
    const type=goalTypeDraft!==null?goalTypeDraft:cur.type;
    const params=goalParamsDraft!==null?goalParamsDraft:(cur.params||{});
    const setType=v=>{setGoalTypeDraft(v);setGoalParamsDraft({});};
    const setParams=v=>setGoalParamsDraft(v);
    const GOALS=[
      {id:"save_more",emoji:"💰",label:"Save more",desc:"Build a savings habit, hit a target"},
      {id:"get_out_of_debt",emoji:"🪙",label:"Get out of debt",desc:"Pay off what you owe, faster"},
      {id:"understand_spending",emoji:"🧐",label:"Understand spending",desc:"See where your money actually goes"},
      {id:"spend_less_on",emoji:"🎯",label:"Spend less on something",desc:"Cap a category you'd rather control"},
    ];
    const inpS={padding:"9px 11px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"};
    const save=()=>{ saveProfile({...profile,goal:type?{type,params}:null}); setGoalTypeDraft(null); setGoalParamsDraft(null); showToast("✓ Goal updated"); setYouSection(null); };
    const clear=()=>{ saveProfile({...profile,goal:null}); setGoalTypeDraft(null); setGoalParamsDraft(null); showToast("Goal cleared"); setYouSection(null); };
    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {GOALS.map(g=>{
          const sel=type===g.id;
          return <div key={g.id} onClick={()=>{setType(g.id);setParams({});}} style={{padding:"10px 12px",background:sel?T.accentSoft:T.surface2,border:`1.5px solid ${sel?T.accent:T.borderSoft}`,borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:10,background:sel?T.accent+"20":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{g.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{g.label}</div>
              <div style={{fontSize:10,color:T.textMuted,marginTop:1,lineHeight:1.4}}>{g.desc}</div>
            </div>
            {sel&&<span style={{fontSize:14,color:T.accent,flexShrink:0}}>✓</span>}
          </div>;
        })}
      </div>
      {type==="get_out_of_debt"&&<div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:5,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>TOTAL DEBT</div>
        <input type="number" inputMode="decimal" placeholder="e.g. 12000" value={params.totalDebt||""} onChange={e=>setParams({...params,totalDebt:parseFloat(e.target.value)||0})} style={inpS}/>
      </div>}
      {type==="spend_less_on"&&<div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:5,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>CATEGORY</div>
        <select value={params.category||""} onChange={e=>setParams({...params,category:e.target.value})} style={{...inpS,marginBottom:8}}>
          <option value="">Pick one</option>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{fontSize:10,color:T.textMuted,marginBottom:5,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>MONTHLY CAP</div>
        <input type="number" inputMode="decimal" placeholder="e.g. 300" value={params.cap||""} onChange={e=>setParams({...params,cap:parseFloat(e.target.value)||0})} style={inpS}/>
      </div>}
      <div style={{display:"flex",gap:8}}>
        <Btn onClick={save} size="sm" disabled={!type}>Save</Btn>
        {cur.type&&<Btn onClick={clear} size="sm" variant="ghost">Clear goal</Btn>}
      </div>
    </div>;
  };

  const IncomeBillsSection=()=>{
    const draft=ibDraft||profile;
    const setDraft=updater=>{ const nv=typeof updater==="function"?updater(draft):updater; setIbDraft(nv); };
    const updS=(id,field,val)=>setDraft(p=>({...p,incomeStreams:(p.incomeStreams||[]).map(s=>s.id===id?{...s,[field]:val}:s)}));
    const addS=()=>setDraft(p=>({...p,incomeStreams:[...(p.incomeStreams||[]),{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true,startFrom:""}]}));
    const rmS=id=>setDraft(p=>({...p,incomeStreams:(p.incomeStreams||[]).filter(s=>s.id!==id)}));
    const updF=(id,field,val)=>setDraft(p=>({...p,fixedCommitments:(p.fixedCommitments||[]).map(c=>c.id===id?{...c,[field]:val}:c)}));
    const addF=()=>setDraft(p=>({...p,fixedCommitments:[...(p.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:0,startFrom:"",endMonth:""}]}));
    const rmF=id=>setDraft(p=>({...p,fixedCommitments:(p.fixedCommitments||[]).filter(c=>c.id!==id)}));
    const save=()=>{ saveProfile({...draft,onboarded:true}); setIbDraft(null); showToast("✓ Saved"); setSubScreen(null); };
    const inpS={padding:"9px 11px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"};
    return <div style={{padding:"4px 0"}}>
      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Income sources</div>
      {(draft.incomeStreams||[]).map(s=><div key={s.id} style={{padding:"10px",background:T.surface2,borderRadius:12,marginBottom:8,border:`1px solid ${T.borderSoft}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
          <input placeholder="Name (e.g. Salary)" value={s.name||""} onChange={e=>updS(s.id,"name",e.target.value)} style={inpS}/>
          <button onClick={()=>rmS(s.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"4px 6px",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:8}}>
          {[["fixed","Fixed",T.info],["variable","Variable",T.warning]].map(([t,lbl,col])=><button key={t} onClick={()=>updS(s.id,"type",t)} style={{flex:1,padding:"7px 4px",background:s.type===t?col:"transparent",border:"none",color:s.type===t?"#fff":T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?700:500}}>{lbl}</button>)}
        </div>
        {s.type==="fixed"&&<input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>updS(s.id,"defaultAmount",parseFloat(e.target.value)||0)} style={inpS}/>}
        {s.type==="variable"&&<div style={{fontSize:10,color:T.textMuted,fontStyle:"italic"}}>You'll enter the amount each month in Money.</div>}
      </div>)}
      <button onClick={addS} style={{width:"100%",padding:"10px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:14}}>+ Add income source</button>

      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Bills (recurring fixed)</div>
      {(draft.fixedCommitments||[]).map(c=><div key={c.id} style={{padding:"10px",background:T.surface2,borderRadius:12,marginBottom:8,border:`1px solid ${T.borderSoft}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 90px auto",gap:8,marginBottom:8,alignItems:"center"}}>
          <input placeholder="Name (e.g. Rent)" value={c.name||""} onChange={e=>updF(c.id,"name",e.target.value)} style={inpS}/>
          <input type="number" placeholder="0" value={c.amount||""} onChange={e=>updF(c.id,"amount",parseFloat(e.target.value)||0)} style={{...inpS,textAlign:"right"}}/>
          <button onClick={()=>rmF(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"4px 6px",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>Start (blank = always)</div><input type="month" value={c.startFrom||""} onChange={e=>updF(c.id,"startFrom",e.target.value)} style={inpS}/></div>
          <div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>End (blank = ongoing)</div><input type="month" value={c.endMonth||""} onChange={e=>updF(c.id,"endMonth",e.target.value)} style={inpS}/></div>
        </div>
      </div>)}
      <button onClick={addF} style={{width:"100%",padding:"10px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:14}}>+ Add bill</button>

      <Btn onClick={save}>Save changes</Btn>
    </div>;
  };

  const GoalsSection=()=>{
    const draft=goalsDraft||profile;
    const setDraft=updater=>{ const nv=typeof updater==="function"?updater(draft):updater; setGoalsDraft(nv); };
    const upd=(id,f,v)=>setDraft(p=>({...p,goals:(p.goals||[]).map(g=>g.id===id?{...g,[f]:v}:g)}));
    const add=()=>setDraft(p=>({...p,goals:[...(p.goals||[]),{id:`g${Date.now()}`,name:"",target:0,date:"",startingBalance:0}]}));
    const rm=id=>setDraft(p=>({...p,goals:(p.goals||[]).filter(g=>g.id!==id)}));
    const save=()=>{ saveProfile({...draft}); setGoalsDraft(null); showToast("✓ Goals saved"); setSubScreen(null); };
    const inpS={padding:"9px 11px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"};
    return <div style={{padding:"4px 0"}}>
      {(draft.goals||[]).length===0&&<div style={{fontSize:12,color:T.textMuted,marginBottom:12,padding:"10px 12px",background:T.surface2,borderRadius:10}}>Set savings targets like "Emergency fund" or "Trip to Japan". Track progress as you save.</div>}
      {(draft.goals||[]).map(g=><div key={g.id} style={{padding:"10px",background:T.surface2,borderRadius:12,marginBottom:8,border:`1px solid ${T.borderSoft}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
          <input placeholder="Goal name" value={g.name||""} onChange={e=>upd(g.id,"name",e.target.value)} style={inpS}/>
          <button onClick={()=>rm(g.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"4px 6px",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>Target amount</div><input type="number" placeholder="0" value={g.target||""} onChange={e=>upd(g.id,"target",parseFloat(e.target.value)||0)} style={inpS}/></div>
          <div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>Target date</div><input type="date" value={g.date||""} onChange={e=>upd(g.id,"date",e.target.value)} style={inpS}/></div>
        </div>
        <div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>Already saved (head-start)</div><input type="number" placeholder="0" value={g.startingBalance||""} onChange={e=>upd(g.id,"startingBalance",parseFloat(e.target.value)||0)} style={inpS}/></div>
      </div>)}
      <button onClick={add} style={{width:"100%",padding:"10px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:12}}>+ Add goal</button>
      <Btn onClick={save}>Save changes</Btn>
    </div>;
  };

  const ThemeSection=()=>{
    const change=(ac,bg)=>{ saveProfile({...profile,accentColor:ac,bgColor:bg}); showToast("Theme updated"); };
    const rp=p=>{ const active=p.accent===youAccent&&p.bg===youBg; return <div key={p.name} onClick={()=>change(p.accent,p.bg)} style={{borderRadius:14,overflow:"hidden",border:`2px solid ${active?T.accent:T.border}`,cursor:"pointer",transition:"border-color .15s"}}>
      <div style={{background:p.bg,padding:"14px"}}><div style={{width:18,height:18,borderRadius:"50%",background:p.accent,marginBottom:7}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.5,marginBottom:3}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.2,width:"55%"}}/></div>
      <div style={{background:isLight(p.bg)?mixHex(p.bg,"#000000",0.05):mixHex(p.bg,"#ffffff",0.05),padding:"6px 10px",fontSize:11,color:isLight(p.bg)?"#555":"#aaa",fontFamily:"'DM Mono'"}}>{p.name}</div>
    </div>; };
    return <div style={{padding:"4px 0"}}>
      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Light</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{LIGHT_PRESETS.map(rp)}</div>
      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Dark</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{DARK_PRESETS.map(rp)}</div>
    </div>;
  };

  const AdvancedSection=()=>{
    const ab=lsLoad("autoBackups")||[];
    return <div style={{padding:"4px 0"}}>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,overflow:"hidden",marginBottom:14,boxShadow:T.cardShadow}}>
        <SettingsRow icon="⬇" label="Export transactions as CSV" desc={`${txCount} transactions, ${moCount} months`} onClick={()=>txCount>0?exportCSV(monthlyData):showToast("No data to export")}/>
        <SettingsRow icon="💾" label="Download full backup (JSON)" desc="All data, settings, history" onClick={()=>{dlBackup(profile,monthlyData,insights,archive);showToast("Backup downloaded");}}/>
        <SettingsRow icon="↑" label="Restore from backup" desc="Load a previous JSON backup" onClick={()=>restoreFileRef.current.click()}/>
        <SettingsRow icon="🔐" label="Change / Remove PIN" desc="Reset PIN on next open" onClick={()=>{ lsSave("pinHash",null); setPinHash(null); setPinUnlocked(false); setPinSkipped(false); }}/>
      </div>
      {ab.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,overflow:"hidden",marginBottom:14,boxShadow:T.cardShadow}}>
        <div style={{padding:"14px 16px 6px",fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase"}}>{ab.length} auto-backup{ab.length!==1?"s":""} available</div>
        {ab.slice(0,3).map((snap,i)=>{
          const date=new Date(snap.createdAt);
          return <div key={i} style={{padding:"12px 16px",borderTop:`1px solid ${T.borderSoft}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:13,color:T.textPrimary,fontWeight:500}}>{date.toLocaleDateString("en-SG",{day:"numeric",month:"short"})} · {date.toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{countAllTx(snap.monthlyData||{})} transactions</div>
            </div>
            <button onClick={()=>setRestoreCandidate(snap)} style={{padding:"6px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Restore</button>
          </div>;
        })}
      </div>}
      <button onClick={()=>setShowReset(true)} style={{width:"100%",padding:"14px",background:"transparent",border:`1px solid ${T.negative}40`,borderRadius:14,color:T.negative,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>Reset everything & start again</button>
    </div>;
  };

  const YouContent=()=>{
    const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
    const since=profile.startMonth?monthLabel(profile.startMonth):"recently";
    return <div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
      <div style={{padding:"12px 0 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:24,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>You</div>
      </div>

      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 18px",textAlign:"center",marginBottom:12,boxShadow:T.cardShadow}}>
        <div onClick={()=>avatarRef.current.click()} style={{position:"relative",width:80,height:80,margin:"0 auto 14px",cursor:"pointer"}}>
          {profile.avatar?<img src={profile.avatar} alt="" style={{width:80,height:80,borderRadius:40,objectFit:"cover"}}/>:<div style={{width:80,height:80,borderRadius:40,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:700,color:T.accent}}>{(profile.name||"?")[0].toUpperCase()}</div>}
          <div style={{position:"absolute",bottom:-2,right:-2,width:26,height:26,borderRadius:13,background:T.accent,border:`3px solid ${T.surface}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>✎</div>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,marginBottom:2,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{profile.name||"Anonymous"}</div>
        {profile.occupation&&<div style={{fontSize:12,color:T.textSecondary,marginBottom:6}}>{profile.occupation}</div>}
        <div style={{fontSize:11,color:T.textMuted}}>Tracking since {since}</div>
      </div>

      {allTimeSaved!==0&&<div style={{background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:20,padding:"22px 18px",textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:11,color:T.accent,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",marginBottom:8}}>You've kept</div>
        <div style={{fontSize:42,fontWeight:700,color:T.accent,letterSpacing:-1.5,lineHeight:1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
          {(()=>{ const abs=Math.abs(allTimeSaved); const cents=(abs-Math.floor(abs)).toFixed(2).slice(1); return <><CountUp value={Math.floor(abs)} duration={1100} format={n=>sym+Math.floor(n).toLocaleString("en-SG")}/><span style={{fontSize:22,opacity:.6,fontWeight:500}}>{cents}</span></>; })()}
        </div>
        <div style={{fontSize:12,color:T.accent,opacity:0.7,marginTop:6}}>since you started · across {moCount} month{moCount!==1?"s":""}</div>
      </div>}

      <input ref={restoreFileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestoreFile}/>
      <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>

      <SettingsGroup title="Profile">
        <SettingsRow icon="👤" label="Identity" desc={`${profile.name||"Anonymous"}${profile.occupation?` · ${profile.occupation}`:""} · ${profile.currency}`} onClick={()=>setYouSection(youSection==="identity"?null:"identity")}/>
        {youSection==="identity"&&IdentitySection()}
        <SettingsRow icon="🎯" label="Goal" desc={profile.goal?(()=>{const t=profile.goal.type;if(t==="save_more") return "Save more";if(t==="get_out_of_debt") return `Get out of debt${profile.goal.params?.totalDebt?` · ${fmt(profile.goal.params.totalDebt)}`:""}`;if(t==="understand_spending") return "Understand spending";if(t==="spend_less_on") return `Spend less on ${profile.goal.params?.category||"a category"}`;return "Custom";})():"Not set yet"} onClick={()=>setYouSection(youSection==="goal"?null:"goal")}/>
        {youSection==="goal"&&GoalSection()}
        <SettingsRow icon="💰" label="Income & Bills" desc={`${(profile.incomeStreams||[]).length} sources · ${(profile.fixedCommitments||[]).length} bills`} onClick={()=>setSubScreen("income-bills")}/>
        <SettingsRow icon="🪙" label="Saving goals" desc={(profile.goals||[]).length>0?`${(profile.goals||[]).length} active`:"No goals set yet"} onClick={()=>setSubScreen("goals")}/>
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <SettingsRow icon="🎨" label="Theme" desc={`${LIGHT_PRESETS.concat(DARK_PRESETS).find(p=>p.accent===youAccent&&p.bg===youBg)?.name||"Custom"}`} onClick={()=>setSubScreen("theme")}/>
      </SettingsGroup>

      <SettingsGroup title="Personalisation">
        <SettingsRow icon="✨" label="Insights" desc={(()=>{const n=(profile.insightPrefs||[]).length;return n===0?"None enabled":n===1?"1 enabled":`${n} enabled`;})()} onClick={()=>setSubScreen("insights")}/>
      </SettingsGroup>

      <SettingsGroup title="Privacy & Data">
        <SettingsRow icon="🔒" label="Privacy policy" desc="What we do (and don't) with your data" onClick={()=>setShowPrivacy(true)}/>
        <SettingsRow icon="ℹ" label="About this app" desc="Version & landing page" onClick={()=>{window.location.href="/landing";}}/>
        <SettingsRow icon="⚙" label="Advanced — backup, restore, reset" desc={`${txCount} transactions stored locally`} onClick={()=>setSubScreen("advanced")}/>
      </SettingsGroup>

      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:18,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
        <PrivacyLock col={T.textMuted}/>v{APP_VERSION} · all data on this device
      </div>
    </div>;
  };

  // ── Reusable spending trend chart (cross-month, all categories togglable) ───
  const renderSpendingTrendChart=()=>{
    const data=spendingTrend;
    const points=data.filter(p=>p.hasData);
    if(points.length<2) return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"22px 18px",textAlign:"center",boxShadow:T.cardShadow}}>
      <div style={{fontSize:28,marginBottom:8}}>📊</div>
      <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:4,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Spending trend</div>
      <div style={{fontSize:11,color:T.textMuted,lineHeight:1.5}}>Need at least 2 months with transactions to chart your trend.</div>
    </div>;
    const W=320, H=130, padX=14, padY=18, padBottom=22;
    const innerW=W-padX*2, innerH=H-padY-padBottom;
    const allVals=[...data.map(p=>p.total),...trendCats.flatMap(c=>data.map(p=>p.byCat[c]||0))];
    const maxV=Math.max(...allVals,1);
    const xFor=i=>padX+(data.length<=1?innerW/2:(i/(data.length-1))*innerW);
    const yFor=v=>padY+innerH-(v/maxV)*innerH;
    const buildPath=(arr,key)=>arr.map((p,i)=>{ const v=key==="total"?p.total:(p.byCat[key]||0); return `${i===0?"M":"L"}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`; }).join(" ");
    const totalPath=buildPath(data,"total");
    const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
    const fmtCompact=v=>{ const a=Math.abs(v); if(a>=1000) return `${sym}${(a/1000).toFixed(a>=10000?0:1)}k`; return `${sym}${a.toFixed(0)}`; };
    const monthsWithData=points.length;
    const avgTotal=points.reduce((s,p)=>s+p.total,0)/Math.max(1,monthsWithData);
    // Adaptive stroke: thinner when many categories active
    const catStroke=trendCats.length<=3?1.6:trendCats.length<=6?1.2:1;

    const toggleCat=cat=>{
      setTrendCats(c=>c.includes(cat)?c.filter(x=>x!==cat):[...c,cat]);
    };
    const selectAll=()=>setTrendCats([...trendAllCategories]);
    const clearAll=()=>setTrendCats([]);
    const allOn=trendCats.length===trendAllCategories.length&&trendAllCategories.length>0;

    return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"16px 18px 12px",boxShadow:T.cardShadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <div>
          <MicroLabel style={{marginBottom:2}}>SPENDING TREND</MicroLabel>
          <div style={{fontSize:11,color:T.textMuted}}>Last {monthsWithData} months</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11,color:T.textMuted}}>Avg / month</div>
          <div style={{fontSize:13,fontFamily:"'DM Mono'",fontWeight:700,color:T.textPrimary}}>{fmtCompact(avgTotal)}</div>
        </div>
      </div>
      {/* Category chips — all categories, with Select all / Clear helpers */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${T.accent}`,background:T.accentSoft,color:T.accent,fontSize:11,fontWeight:700,fontFamily:"'DM Mono'",letterSpacing:0.3}}>Total</div>
        {trendAllCategories.map(cat=>{
          const on=trendCats.includes(cat);
          const col=COLS[cat]||T.accent;
          return <button key={cat} onClick={()=>toggleCat(cat)} style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${on?col:T.border}`,background:on?col+"22":"transparent",color:on?col:T.textMuted,fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:4}}>
            <span style={{width:6,height:6,borderRadius:3,background:col,opacity:on?1:0.4}}/>
            {cat.split(" ").slice(1).join(" ")||cat}
          </button>;
        })}
        {trendAllCategories.length>1&&<>
          <button onClick={allOn?clearAll:selectAll} style={{padding:"4px 10px",borderRadius:14,border:`1px dashed ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>{allOn?"Clear all":"Select all"}</button>
        </>}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:"block",overflow:"visible"}}>
        <path d={totalPath} fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {trendCats.map(cat=>{
          const col=COLS[cat]||T.accent;
          return <path key={cat} d={buildPath(data,cat)} fill="none" stroke={col} strokeWidth={catStroke} strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>;
        })}
        {data.map((p,i)=>p.hasData?<circle key={i} cx={xFor(i)} cy={yFor(p.total)} r="3" fill={T.surface} stroke={T.accent} strokeWidth="2"/>:null)}
        {data.map((p,i)=>{
          const lbl=monthLabelShort(p.month).split(" ")[0];
          return <text key={`l${i}`} x={xFor(i)} y={H-4} textAnchor="middle" fontSize="9" fill={T.textMuted} fontFamily="DM Mono" fontWeight="500">{lbl}</text>;
        })}
      </svg>
      {trendCats.length>0&&trendCats.length<=6&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.borderSoft}`,display:"flex",flexDirection:"column",gap:4}}>
        {trendCats.map(cat=>{
          const col=COLS[cat]||T.accent;
          const total=data.reduce((s,p)=>s+(p.byCat[cat]||0),0);
          const avg=total/Math.max(1,monthsWithData);
          return <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6,color:T.textSecondary}}>
              <span style={{width:10,height:2,background:col,display:"inline-block",borderRadius:1}}/>
              {cat}
            </span>
            <span style={{fontFamily:"'DM Mono'",color:T.textMuted,fontWeight:600}}>{fmtCompact(avg)}/mo</span>
          </div>;
        })}
      </div>}
      {trendCats.length>6&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.borderSoft}`,fontSize:11,color:T.textMuted,textAlign:"center"}}>{trendCats.length} categories shown — clear some for per-line averages</div>}
    </div>;
  };

  // ── FORECAST detail screen ───────────────────────────────────────────────
  const ForecastScreen=()=>{
    const isFutureMonth=selectedMonth>currentMonth();
    const isPastMonth=selectedMonth<currentMonth();
    // Future-month early exit (nothing useful to show)
    if(isFutureMonth){
      return <div style={{padding:"24px 18px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:14}}>📅</div>
        <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Hasn't happened yet</div>
        <div style={{fontSize:13,color:T.textSecondary,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>This is a future month. Switch to <span onClick={()=>setSelectedMonth(currentMonth())} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>this month</span> or a past one to see daily activity.</div>
      </div>;
    }
    // No income setup at all
    if(incTotal===0&&txs.length===0){
      return <div style={{padding:"24px 18px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:14}}>📈</div>
        <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Nothing to show yet</div>
        <div style={{fontSize:13,color:T.textSecondary,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>Add transactions or set up income in <span onClick={()=>{setTab("you");setSubScreen(null);}} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>You</span> to see daily activity.</div>
      </div>;
    }

    // Build per-day series for the selected month
    // For past months: every day of the month (data complete)
    // For current month: days 1..today have actuals; future days are null (skipped)
    const [yr,mo]=selectedMonth.split("-").map(Number);
    const monthDIM=new Date(yr,mo,0).getDate(); // days in selectedMonth
    const today=new Date();
    const isCurMonthLocal=currentMonth()===selectedMonth;
    const lastDataDay=isCurMonthLocal?Math.min(monthDIM,today.getDate()):monthDIM;
    // Bucket transactions by day
    const byDayTotal=new Array(monthDIM+1).fill(0); // 1..monthDIM
    const byDayCat={}; // {cat: [0, day1, day2, ...]}
    txs.forEach(t=>{
      if(t.amount<=0) return; // debits only (credits are income-like)
      const d=new Date(t.date);
      const day=d.getDate();
      if(day<1||day>monthDIM) return;
      const ea=effectiveAmount(t);
      byDayTotal[day]+=ea;
      if(!byDayCat[t.category]) byDayCat[t.category]=new Array(monthDIM+1).fill(0);
      byDayCat[t.category][day]+=ea;
    });

    // Chart geometry
    const chartW=320, chartH=130, padX=14, padY=14, padBottom=22;
    const innerW=chartW-padX*2, innerH=chartH-padY-padBottom;
    const allDailyVals=[];
    for(let d=1;d<=lastDataDay;d++){ allDailyVals.push(byDayTotal[d]); }
    trendCats.forEach(c=>{ if(byDayCat[c]){ for(let d=1;d<=lastDataDay;d++) allDailyVals.push(byDayCat[c][d]); } });
    const maxV=Math.max(...allDailyVals,1);
    const xFor=d=>padX+((d-1)/(monthDIM-1))*innerW;
    const yFor=v=>padY+innerH-(v/maxV)*innerH;
    const buildDailyPath=(arr,limit)=>{
      const pts=[];
      for(let d=1;d<=limit;d++) pts.push(`${d===1?"M":"L"}${xFor(d).toFixed(1)} ${yFor(arr[d]||0).toFixed(1)}`);
      return pts.join(" ");
    };
    const totalPath=buildDailyPath(byDayTotal,lastDataDay);
    const sym2=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
    const fmtCompact2=v=>{ const a=Math.abs(v); if(a>=1000) return `${sym2}${(a/1000).toFixed(a>=10000?0:1)}k`; return `${sym2}${a.toFixed(0)}`; };

    const dailyCatsAvail=Object.keys(byDayCat).sort((a,b)=>{
      const sa=byDayCat[a].reduce((s,v)=>s+v,0), sb=byDayCat[b].reduce((s,v)=>s+v,0);
      return sb-sa;
    });

    const toggleCat=cat=>setTrendCats(c=>c.includes(cat)?c.filter(x=>x!==cat):[...c,cat]);
    const allOn=trendCats.length===dailyCatsAvail.length&&dailyCatsAvail.length>0;
    const catStroke=trendCats.length<=3?1.6:trendCats.length<=6?1.2:1;

    // Daily average for context
    const dailyAvg=lastDataDay>0?varTotal/lastDataDay:0;
    const peakDay=(()=>{let best=0,bestD=0;for(let d=1;d<=lastDataDay;d++) if(byDayTotal[d]>best){best=byDayTotal[d];bestD=d;}return {amt:best,day:bestD};})();
    const zeroDays=(()=>{let n=0;for(let d=1;d<=lastDataDay;d++) if(byDayTotal[d]===0) n++; return n;})();

    return <div>
      {/* Hero — past = actual, current = projection */}
      <div style={{textAlign:"center",marginBottom:22}}>
        {isPastMonth
          ?<>
            <MicroLabel style={{marginBottom:8}}>YOU SAVED</MicroLabel>
            <div style={{fontSize:48,fontWeight:700,color:saved>=0?T.accent:T.negative,letterSpacing:-1.5,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(saved)}</div>
            <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>in {monthLabel(selectedMonth)}{prevSaved!==0&&prevSaved!==saved?` — ${saved>=prevSaved?"better":"less"} than the month before`:""}</div>
          </>
          :dayOfMonth>5&&incTotal>0?<>
            <MicroLabel style={{marginBottom:8}}>YOU'LL LIKELY SAVE</MicroLabel>
            <div style={{fontSize:48,fontWeight:700,color:projectedSaved>=0?T.accent:T.negative,letterSpacing:-1.5,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(projectedSaved)}</div>
            <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>by end of {monthLabel(selectedMonth)}{prevSaved!==0?` — ${projectedSaved>=prevSaved?"better":"less"} than last month`:""}</div>
          </>:<>
            <MicroLabel style={{marginBottom:8}}>SO FAR THIS MONTH</MicroLabel>
            <div style={{fontSize:48,fontWeight:700,color:saved>=0?T.accent:T.negative,letterSpacing:-1.5,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(saved)}</div>
            <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>day {dayOfMonth} of {daysInMonth}{incTotal===0?" · add income to see projection":" · projection ready from day 6"}</div>
          </>}
      </div>

      {/* 6-month spending trend (cross-month) */}
      <div style={{marginBottom:14}}>{renderSpendingTrendChart()}</div>

      {/* Daily spending chart for selected month */}
      {txs.filter(t=>t.amount>0).length>=1?<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:T.cardShadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
          <div>
            <MicroLabel style={{marginBottom:2}}>DAILY SPENDING</MicroLabel>
            <div style={{fontSize:11,color:T.textMuted}}>{monthLabel(selectedMonth)}{isCurMonthLocal?` · day ${dayOfMonth} of ${daysInMonth}`:""}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:T.textMuted}}>Avg / day</div>
            <div style={{fontSize:13,fontFamily:"'DM Mono'",fontWeight:700,color:T.textPrimary}}>{fmtCompact2(dailyAvg)}</div>
          </div>
        </div>
        {/* Category chips */}
        {dailyCatsAvail.length>0&&<div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${T.accent}`,background:T.accentSoft,color:T.accent,fontSize:11,fontWeight:700,fontFamily:"'DM Mono'",letterSpacing:0.3}}>Total</div>
          {dailyCatsAvail.map(cat=>{
            const on=trendCats.includes(cat);
            const col=COLS[cat]||T.accent;
            return <button key={cat} onClick={()=>toggleCat(cat)} style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${on?col:T.border}`,background:on?col+"22":"transparent",color:on?col:T.textMuted,fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:3,background:col,opacity:on?1:0.4}}/>
              {cat.split(" ").slice(1).join(" ")||cat}
            </button>;
          })}
          {dailyCatsAvail.length>1&&<button onClick={()=>setTrendCats(allOn?[]:[...dailyCatsAvail])} style={{padding:"4px 10px",borderRadius:14,border:`1px dashed ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>{allOn?"Clear all":"Select all"}</button>}
        </div>}
        {/* Chart */}
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{display:"block",overflow:"visible"}}>
          {/* Baseline */}
          <line x1={padX} y1={padY+innerH} x2={chartW-padX} y2={padY+innerH} stroke={T.borderSoft} strokeWidth="1"/>
          {/* Total path (spiky daily) */}
          <path d={totalPath} fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Category overlays */}
          {trendCats.filter(c=>byDayCat[c]).map(cat=>{
            const col=COLS[cat]||T.accent;
            return <path key={cat} d={buildDailyPath(byDayCat[cat],lastDataDay)} fill="none" stroke={col} strokeWidth={catStroke} strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>;
          })}
          {/* Today marker for current month */}
          {isCurMonthLocal&&<line x1={xFor(lastDataDay)} y1={padY} x2={xFor(lastDataDay)} y2={padY+innerH} stroke={T.textMuted} strokeWidth="1" strokeDasharray="2,3" opacity="0.5"/>}
          {/* X-axis labels — every ~5 days */}
          {[1,Math.ceil(monthDIM/4),Math.ceil(monthDIM/2),Math.ceil(monthDIM*3/4),monthDIM].filter((v,i,a)=>a.indexOf(v)===i).map(d=><text key={d} x={xFor(d)} y={chartH-4} textAnchor="middle" fontSize="9" fill={T.textMuted} fontFamily="DM Mono" fontWeight="500">{d}</text>)}
        </svg>
        {/* Per-category averages legend (only when <=6) */}
        {trendCats.length>0&&trendCats.length<=6&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.borderSoft}`,display:"flex",flexDirection:"column",gap:4}}>
          {trendCats.filter(c=>byDayCat[c]).map(cat=>{
            const col=COLS[cat]||T.accent;
            const tot=byDayCat[cat].reduce((s,v)=>s+v,0);
            return <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6,color:T.textSecondary}}>
                <span style={{width:10,height:2,background:col,display:"inline-block",borderRadius:1}}/>
                {cat}
              </span>
              <span style={{fontFamily:"'DM Mono'",color:T.textMuted,fontWeight:600}}>{fmtCompact2(tot)}</span>
            </div>;
          })}
        </div>}
        {trendCats.length>6&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.borderSoft}`,fontSize:11,color:T.textMuted,textAlign:"center"}}>{trendCats.length} categories shown — clear some for per-line totals</div>}
        {/* Context summary */}
        <div style={{marginTop:12,padding:"10px 12px",background:T.surface2,borderRadius:10,fontSize:11,color:T.textSecondary,lineHeight:1.5}}>
          {peakDay.amt>0&&<>Biggest spend day: <span style={{color:T.textPrimary,fontWeight:600}}>Day {peakDay.day}</span> ({fmt(peakDay.amt)}). </>}
          {zeroDays>0&&<>{zeroDays} {zeroDays===1?"day":"days"} with no spending. </>}
          Total {fmt(varTotal)} over {lastDataDay} {lastDataDay===1?"day":"days"}.
        </div>
      </div>:(()=>{
        // Find past months that DO have spending data — offer them as quick links
        const monthsWithSpend=Object.entries(monthlyData).filter(([m,d])=>(d.txs||[]).some(t=>t.amount>0)&&m!==selectedMonth).map(([m])=>m).sort().reverse().slice(0,4);
        return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 18px",marginBottom:14,textAlign:"center",boxShadow:T.cardShadow}}>
          <div style={{fontSize:24,marginBottom:8}}>📊</div>
          <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:4,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>No daily spending chart yet</div>
          <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.6,marginBottom:monthsWithSpend.length>0?14:0,maxWidth:280,margin:"0 auto"}}>No spending transactions in {monthLabel(selectedMonth)}{isCurMonthLocal?" so far. Once you upload a statement or add a few transactions, the daily spiky line appears here.":". Try a different month — the chart shows day-by-day spending for any month with data."}</div>
          {monthsWithSpend.length>0&&<div style={{marginTop:14}}>
            <div style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4,marginBottom:8}}>OR TRY THESE MONTHS</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
              {monthsWithSpend.map(m=><button key={m} onClick={()=>setSelectedMonth(m)} style={{padding:"6px 12px",borderRadius:14,border:`1px solid ${T.accent}`,background:T.accentSoft,color:T.accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{monthLabelShort(m)}</button>)}
            </div>
          </div>}
        </div>;
      })()}

      {/* Category projection (current month only) */}
      {isCurMonthLocal&&dayOfMonth>5&&byCat.length>0&&(()=>{
        const projByCat=byCat.slice(0,4).map(([cat,amt])=>({cat,actual:Math.abs(amt),projected:Math.abs(amt)*(daysInMonth/dayOfMonth)}));
        return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:T.cardShadow}}>
          <div style={{fontSize:13,fontWeight:700,color:T.textPrimary,marginBottom:12}}>Where you'll likely land</div>
          {projByCat.map(({cat,actual,projected:p},i)=>{
            const budget=profile.budgets?.[cat];
            const overBudget=budget>0&&p>budget;
            return <div key={i} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:T.textPrimary,fontWeight:500}}>{cat}</span>
                <span style={{fontSize:12,fontFamily:"'DM Mono'",fontWeight:600,color:overBudget?T.negative:T.textPrimary}}>{fmt(actual)} → {fmt(p)}</span>
              </div>
              <div style={{height:4,background:T.borderSoft,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100,(actual/p)*100)}%`,background:COLS[cat]||T.accent,borderRadius:4}}/>
              </div>
              {overBudget&&<div style={{fontSize:10,color:T.negative,marginTop:3,fontWeight:600}}>⚠ Will exceed budget of {fmt(budget)}</div>}
            </div>;
          })}
        </div>;
      })()}

      {/* What-if (current month only with data) */}
      {isCurMonthLocal&&dayOfMonth>5&&byCat[0]&&(()=>{
        const top=byCat[0]; const topName=top[0]; const topAmt=Math.abs(top[1]);
        const topProj=topAmt*(daysInMonth/dayOfMonth);
        const remDays=daysInMonth-dayOfMonth;
        return <div style={{background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:18,padding:"14px 16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:6}}>💡 What if?</div>
          <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.55}}>
            Your top spend is <span style={{fontWeight:700,color:T.textPrimary}}>{topName}</span>. If you shave 20% off that for the rest of the month, you'd save an extra <span style={{fontWeight:700,color:T.accent}}>{fmt(topProj*0.2*(remDays/daysInMonth))}</span>.
          </div>
        </div>;
      })()}
    </div>;
  };

  // ── INSIGHTS settings subscreen ────────────────────────────────────────────
  const InsightsScreen=()=>{
    const prefs=new Set(profile?.insightPrefs||[]);
    const toggle=id=>{
      const next=new Set(prefs);
      if(next.has(id)) next.delete(id); else next.add(id);
      saveProfile({...profile,insightPrefs:[...next]});
    };
    return <div style={{padding:"4px 0"}}>
      <div style={{fontSize:13,color:T.textSecondary,marginBottom:18,lineHeight:1.6}}>Pick the insights you want to see on Home. We'll show up to 2 at a time, rotating across days if you enable more.</div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,overflow:"hidden",boxShadow:T.cardShadow,marginBottom:14}}>
        {insightCatalog.map((ins,i)=>{
          const on=prefs.has(ins.id);
          return <div key={ins.id} style={{padding:"14px 16px",borderTop:i?`1px solid ${T.borderSoft}`:"none",display:"flex",alignItems:"center",gap:12,cursor:ins.comingSoon?"default":"pointer",opacity:ins.comingSoon?0.5:1}} onClick={()=>{ if(!ins.comingSoon) toggle(ins.id); }}>
            <div style={{width:32,height:32,borderRadius:16,background:on?T.accentSoft:T.surface2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ins.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,display:"flex",alignItems:"center",gap:6}}>
                {ins.label}
                {ins.comingSoon&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:6,background:T.warning+"20",color:T.warning,fontFamily:"'DM Mono'",letterSpacing:0.4}}>SOON</span>}
                {!ins.comingSoon&&!ins.ready&&on&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:6,background:T.surface2,color:T.textMuted,fontFamily:"'DM Mono'",letterSpacing:0.4}}>NOT YET</span>}
              </div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2,lineHeight:1.4}}>{ins.description}</div>
            </div>
            {/* Toggle */}
            {!ins.comingSoon&&<div style={{width:36,height:22,borderRadius:11,background:on?T.accent:T.borderMid,padding:2,boxSizing:"border-box",transition:"background .15s",flexShrink:0,position:"relative"}}>
              <div style={{width:18,height:18,borderRadius:9,background:"#fff",transform:`translateX(${on?14:0}px)`,transition:"transform .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </div>}
          </div>;
        })}
      </div>
      <div style={{fontSize:11,color:T.textMuted,textAlign:"center",lineHeight:1.5}}>Insights only show when there's enough data to be meaningful — they'll appear on Home automatically when ready.</div>
    </div>;
  };

  // ── INSIGHTS settings subscreen ─ end
  const SearchScreen=()=>{
    // Parse query into structured filters
    const q=(searchQ||"").trim().toLowerCase();
    const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
    const tokens=q.split(/\s+/).filter(Boolean);
    let amtGt=null, amtLt=null, catFilter=null, monthFilter=null;
    const textTerms=[];
    tokens.forEach(tok=>{
      if(/^>\d/.test(tok)){ const v=parseFloat(tok.slice(1)); if(!isNaN(v)) amtGt=v; }
      else if(/^<\d/.test(tok)){ const v=parseFloat(tok.slice(1)); if(!isNaN(v)) amtLt=v; }
      else if(tok.startsWith("category:")){ catFilter=tok.slice(9); }
      else { const monthIdx=MONTHS.findIndex(m=>m.startsWith(tok)&&tok.length>=3); if(monthIdx>=0) monthFilter=monthIdx+1; else if(/^(0?[1-9]|1[0-2])$/.test(tok)){ monthFilter=parseInt(tok,10); } else textTerms.push(tok); }
    });
    // Collect all transactions across all months with their month tag
    const allTxs=[];
    Object.entries(monthlyData).forEach(([m,md])=>{(md.txs||[]).forEach(t=>allTxs.push({...t,_month:m}));});
    // Apply filters
    const filtered=q?allTxs.filter(t=>{
      if(amtGt!==null&&Math.abs(t.amount)<=amtGt) return false;
      if(amtLt!==null&&Math.abs(t.amount)>=amtLt) return false;
      if(catFilter&&!(t.category||"").toLowerCase().includes(catFilter)) return false;
      if(monthFilter!==null){
        const mNum=parseInt(t._month.split("-")[1],10);
        if(mNum!==monthFilter) return false;
      }
      if(textTerms.length>0){
        const haystack=`${t.description||""} ${t.category||""} ${t.notes||""}`.toLowerCase();
        if(!textTerms.every(term=>haystack.includes(term))) return false;
      }
      return true;
    }):[];
    filtered.sort((a,b)=>b.date.localeCompare(a.date));
    const grand=filtered.reduce((s,t)=>{ const ea=effectiveAmount(t); return s+(ea>0?ea:0); },0);

    return <div>
      <input type="text" placeholder="Search… try 'grab', '>30', 'march', 'category:food'" value={searchQ} onChange={e=>setSearchQ(e.target.value)} autoFocus style={{width:"100%",padding:"14px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",boxSizing:"border-box",boxShadow:T.cardShadow}}/>
      {/* Helper chips */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,marginBottom:14}}>
        {[">50","<10","category:food","march","grab"].map(ex=><button key={ex} onClick={()=>setSearchQ(searchQ?`${searchQ} ${ex}`:ex)} style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${T.border}`,background:T.surface,color:T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono'",fontWeight:500}}>{ex}</button>)}
        {searchQ&&<button onClick={()=>setSearchQ("")} style={{padding:"4px 10px",borderRadius:14,border:`1px solid ${T.negative}40`,background:"transparent",color:T.negative,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Clear</button>}
      </div>

      {/* Active filters summary */}
      {q&&<div style={{padding:"10px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:12,marginBottom:14,fontSize:12,color:T.textSecondary,lineHeight:1.6}}>
        <div style={{fontWeight:700,color:T.accent,marginBottom:2,fontSize:11,letterSpacing:0.5,textTransform:"uppercase"}}>{filtered.length} match{filtered.length!==1?"es":""}</div>
        <div>Total: <span style={{fontFamily:"'DM Mono'",fontWeight:700,color:T.textPrimary}}>{fmt(grand)}</span></div>
        {amtGt!==null&&<div>· Amount &gt; {fmt(amtGt)}</div>}
        {amtLt!==null&&<div>· Amount &lt; {fmt(amtLt)}</div>}
        {catFilter&&<div>· Category contains "{catFilter}"</div>}
        {monthFilter!==null&&<div>· Month: {MONTHS[monthFilter-1].slice(0,3).toUpperCase()}</div>}
        {textTerms.length>0&&<div>· Text: {textTerms.join(" + ")}</div>}
      </div>}

      {/* Results */}
      {!q&&<div style={{padding:"40px 20px",textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:12}}>🔍</div>
        <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Search all your transactions</div>
        <div style={{fontSize:12,color:T.textMuted,lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>Try a merchant name, amount filter, or category. Combine them: <code style={{fontFamily:"'DM Mono'",fontSize:11,background:T.surface2,padding:"1px 6px",borderRadius:4}}>grab &gt;30 march</code></div>
      </div>}

      {q&&filtered.length===0&&<div style={{padding:"32px 20px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:10}}>🤷</div>
        <div style={{fontSize:13,color:T.textSecondary,lineHeight:1.5}}>No transactions match. Try different terms.</div>
      </div>}

      {filtered.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",boxShadow:T.cardShadow}}>
        {filtered.slice(0,80).map((t,i)=><div key={t.id+t._month} onClick={()=>{ setSelectedMonth(t._month); setTxDetailId(t.id); setTxDetailMonth(t._month); setSubScreen(null); setTab("money"); }} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderTop:i?`1px solid ${T.borderSoft}`:"none",cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:10,background:(COLS[t.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{t.category?.split(" ")[0]||"📦"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:T.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:6}}>
              {t.description}
              {t.notes&&<span style={{fontSize:10,opacity:0.7}}>📝</span>}
              {t.split?.with&&<span style={{fontSize:10,opacity:0.7}}>🤝</span>}
            </div>
            <div style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date} · {monthLabelShort(t._month)}{t.split?.with?` · ${Math.round((t.split.share||0)*100)}% with ${t.split.with}`:""}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            {t.split?.with
              ?<>
                <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:t.amount<0?T.positive:T.textPrimary}}>{t.amount<0?"-":""}{fmt(Math.abs(effectiveAmount(t)))}</div>
                <div style={{fontFamily:"'DM Mono'",fontSize:10,color:T.textMuted,textDecoration:"line-through"}}>{fmt(Math.abs(t.amount))}</div>
              </>
              :<div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:t.amount<0?T.positive:T.textPrimary}}>{t.amount<0?"-":""}{fmt(Math.abs(t.amount))}</div>}
          </div>
        </div>)}
        {filtered.length>80&&<div style={{padding:"12px 14px",fontSize:11,color:T.textMuted,textAlign:"center",borderTop:`1px solid ${T.borderSoft}`}}>Showing 80 of {filtered.length} — refine your search</div>}
      </div>}
    </div>;
  };

  const AddChooserScreen=()=>{
    const submitQuick=()=>{
      if(!qaDesc.trim()||!qaAmt||isNaN(+qaAmt)||+qaAmt<=0) return;
      addManual({description:qaDesc.trim(),amount:qaAmt,category:qaCat||CATS[0]||"📦 Other",date:qaDate||todayStr()});
      setQaDesc(""); setQaAmt(""); setQaCat(""); setQaDate(todayStr()); setAddMode("choose");
    };
    if(addMode==="choose") return <div style={{padding:"4px 0"}}>
      <div style={{fontSize:13,color:T.textSecondary,marginBottom:18,padding:"0 4px"}}>How do you want to add transactions?</div>
      <button onClick={()=>setSubScreen("upload")} style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"22px 18px",marginBottom:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:T.cardShadow,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:14,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📄</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,marginBottom:3}}>Upload statement</div>
          <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>PDF, CSV, or photo. Claude reads every transaction.</div>
        </div>
        <span style={{fontSize:18,color:T.textMuted,flexShrink:0}}>›</span>
      </button>
      <button onClick={()=>setAddMode("quick")} style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"22px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:T.cardShadow,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:14,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>✏️</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,marginBottom:3}}>Quick add</div>
          <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>One transaction, no review needed.</div>
        </div>
        <span style={{fontSize:18,color:T.textMuted,flexShrink:0}}>›</span>
      </button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:24,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
        <PrivacyLock col={T.textMuted}/>Everything stays on your device
      </div>
    </div>;
    // Quick add form
    return <div>
      <button onClick={()=>setAddMode("choose")} style={{background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:"0 0 12px",marginBottom:4}}>‹ Back</button>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:18,boxShadow:T.cardShadow}}>
        <MicroLabel style={{marginBottom:14}}>QUICK ADD TRANSACTION</MicroLabel>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="text" placeholder="What was it? (e.g. Lunch, Grab)" value={qaDesc} onChange={e=>setQaDesc(e.target.value)} autoFocus style={{padding:"12px 14px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none"}}/>
          <input type="number" inputMode="decimal" placeholder="Amount" value={qaAmt} onChange={e=>setQaAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitQuick()} style={{padding:"12px 14px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:16,fontWeight:600,outline:"none"}}/>
          <select value={qaCat||CATS[0]||"📦 Other"} onChange={e=>setQaCat(e.target.value)} style={{padding:"12px 14px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none"}}>{[...CATS,...FIXED_CATS].map(c=><option key={c}>{c}</option>)}</select>
          <input type="date" value={qaDate} onChange={e=>setQaDate(e.target.value)} style={{padding:"12px 14px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none"}}/>
          <Btn onClick={submitQuick} disabled={!qaDesc.trim()||!qaAmt||+qaAmt<=0} style={{marginTop:6}}>Add transaction</Btn>
        </div>
      </div>
      <div style={{fontSize:11,color:T.textMuted,textAlign:"center",marginTop:14,lineHeight:1.5}}>Saves immediately. No review needed.<br/>You can edit or delete anytime in the Money tab.</div>
    </div>;
  };

  const MoneyContent=()=><div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
    {/* Header — sticky */}
    <div style={{padding:"12px 0 14px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:T.bg,zIndex:10,marginBottom:4}}>
      <div style={{fontSize:24,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Money</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setSubScreen("search")} title="Search transactions" style={{width:36,height:36,borderRadius:18,background:"transparent",border:`1px solid ${T.border}`,color:T.textSecondary,fontSize:16,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>🔍</button>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
      </div>
    </div>

    {/* Subscriptions — promoted to top of Money for visibility */}
    {detectedSubscriptions.length>0&&(()=>{
      const total=detectedSubscriptions.reduce((s,x)=>s+x.amount,0);
      const flagged=detectedSubscriptions.filter(s=>s.priceChange>0||s.monthsSeen>=4).length;
      return <button onClick={()=>setSubScreen("subscriptions")} style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>📱</span>
            <span style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Subscriptions</span>
            {flagged>0&&<span style={{fontSize:10,fontWeight:700,color:T.warning,padding:"2px 7px",background:T.warning+"15",border:`1px solid ${T.warning}30`,borderRadius:8}}>{flagged} to check</span>}
          </div>
          <span style={{fontSize:14,color:T.textMuted}}>›</span>
        </div>
        <div style={{fontSize:24,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.5}}>{fmt(total)}<span style={{fontSize:13,color:T.textMuted,fontWeight:500,marginLeft:6}}>/month</span></div>
        <div style={{fontSize:11,color:T.textSecondary,marginTop:4}}>{detectedSubscriptions.length} active · ~{fmt(total*12)}/yr leaking</div>
      </button>;
    })()}

    {/* Spending breakdown — replaces donut with cleaner horizontal bars */}
    {byCat.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Spending breakdown</div>
        <div style={{fontSize:13,fontFamily:"'DM Mono'",fontWeight:700,color:T.spent}}>{fmt(varTotal)}</div>
      </div>
      {byCat.map(([cat,amt],i)=>{
        const pct=varTotal!==0?(Math.abs(amt)/Math.abs(varTotal)*100):0;
        const budget=profile.budgets?.[cat];
        const overBudget=budget>0&&Math.abs(amt)>=budget*0.8;
        return <div key={cat} style={{marginBottom:i<byCat.length-1?12:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1}}>
              <span style={{fontSize:14,flexShrink:0}}>{cat.split(" ")[0]||"📦"}</span>
              <span style={{fontSize:12,color:T.textPrimary,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.split(" ").slice(1).join(" ")||cat}</span>
              {overBudget&&<span style={{fontSize:9,color:T.warning,fontWeight:700,letterSpacing:0.3,marginLeft:4,flexShrink:0}}>OVER</span>}
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,flexShrink:0}}>
              <span style={{fontSize:13,fontFamily:"'DM Mono'",fontWeight:600,color:T.textPrimary}}>{fmt(Math.abs(amt))}</span>
              <span style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'"}}>{pct.toFixed(0)}%</span>
            </div>
          </div>
          <div style={{height:5,background:T.borderSoft,borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:COLS[cat]||T.accent,borderRadius:5,transition:"width .4s"}}/>
          </div>
        </div>;
      })}
    </div>}

    {/* Income card */}
    {(incomeRows.length>0||oneoffEntries.length>0)&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Income</div>
        <div style={{fontSize:14,fontFamily:"'DM Mono'",fontWeight:700,color:T.positive}}>{fmt(incTotal)}</div>
      </div>
      {incomeRows.map(({stream,amount})=>{
        if(stream.type==="fixed") return <FixedIncomeRow key={stream.id} stream={stream} amount={amount}/>;
        return <VarIncomeRow key={stream.id} stream={stream} amount={amount}/>;
      })}
      {oneoffEntries.map(o=><OneoffRow key={o.id} entry={o}/>)}
      {AddOneoffForm()}
    </div>}

    {/* Bills card */}
    {monthFixed.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Bills</div>
        <div style={{fontSize:14,fontFamily:"'DM Mono'",fontWeight:700,color:T.bills}}>{fmt(fixedTotal)}</div>
      </div>
      {monthFixed.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.borderSoft}`}}>
        <div>
          <div style={{fontSize:13,fontWeight:500,color:T.textPrimary}}>{c.name}</div>
          {c.endMonth&&<div style={{fontSize:10,color:T.textMuted}}>until {monthLabelShort(c.endMonth)}</div>}
        </div>
        <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:T.bills}}>{fmt(+c.amount||0)}</div>
      </div>)}
    </div>}

    {/* Recent transactions */}
    {txs.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 0",marginBottom:12,boxShadow:T.cardShadow}}>
      <div style={{padding:"0 18px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Recent transactions</div>
        <span style={{fontSize:11,color:T.textMuted}}>{filteredTxs.length}</span>
      </div>
      {/* Category filter */}
      {byCat.length>1&&<div style={{padding:"0 14px 10px",display:"flex",gap:6,overflowX:"auto"}}>
        {["All",...byCat.map(([c])=>c)].map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{padding:"6px 12px",borderRadius:16,border:`1px solid ${catFilter===c?T.accent:T.border}`,background:catFilter===c?T.accentSoft:"transparent",color:catFilter===c?T.accent:T.textMuted,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0,fontWeight:catFilter===c?700:500}}>{c==="All"?"All":c.split(" ")[0]}</button>)}
      </div>}
      {(()=>{
        const PER_PAGE=30;
        const totalPages=Math.max(1,Math.ceil(filteredTxs.length/PER_PAGE));
        const page=Math.min(txPage,totalPages);
        const start=(page-1)*PER_PAGE;
        const slice=filteredTxs.slice(start,start+PER_PAGE);
        return <>
          {slice.map((t,i)=><div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderTop:`1px solid ${T.borderSoft}`,cursor:"pointer"}} onClick={()=>{setTxDetailId(t.id);setTxDetailMonth(selectedMonth);}}>
            <div style={{width:32,height:32,borderRadius:10,background:(COLS[t.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{t.category?.split(" ")[0]||"📦"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:T.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:6}}>
                {t.description}
                {t.notes&&<span title="Has note" style={{fontSize:10,color:T.textMuted,flexShrink:0}}>📝</span>}
                {t.split?.with&&<span title={`Split with ${t.split.with}`} style={{fontSize:10,flexShrink:0}}>🤝</span>}
              </div>
              <div style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date}{t.split?.with?` · ${Math.round((t.split.share||0)*100)}% with ${t.split.with}`:""}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {t.split?.with
                ?<>
                  <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:t.amount<0?T.positive:T.textPrimary}}>{t.amount<0?"-":""}{fmt(Math.abs(effectiveAmount(t)))}</div>
                  <div style={{fontFamily:"'DM Mono'",fontSize:10,color:T.textMuted,textDecoration:"line-through"}}>{fmt(Math.abs(t.amount))}</div>
                </>
                :<div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:t.amount<0?T.positive:T.textPrimary}}>{t.amount<0?"-":""}{fmt(Math.abs(t.amount))}</div>}
            </div>
          </div>)}
          {totalPages>1&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderTop:`1px solid ${T.borderSoft}`}}>
            <button onClick={()=>setTxPage(p=>Math.max(1,p-1))} disabled={page<=1} style={{width:32,height:32,borderRadius:16,border:`1px solid ${T.border}`,background:"transparent",color:page<=1?T.textMuted:T.textSecondary,fontSize:18,cursor:page<=1?"default":"pointer",fontFamily:"inherit",lineHeight:1,opacity:page<=1?0.4:1}}>‹</button>
            <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.3}}>Page {page} of {totalPages} · {filteredTxs.length} total</div>
            <button onClick={()=>setTxPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{width:32,height:32,borderRadius:16,border:`1px solid ${T.border}`,background:"transparent",color:page>=totalPages?T.textMuted:T.textSecondary,fontSize:18,cursor:page>=totalPages?"default":"pointer",fontFamily:"inherit",lineHeight:1,opacity:page>=totalPages?0.4:1}}>›</button>
          </div>}
        </>;
      })()}
    </div>}

    {/* Empty state */}
    {txs.length===0&&incomeRows.length===0&&<div onClick={()=>{setAddMode("choose");setSubScreen("add");}} style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:18,padding:"32px 20px",textAlign:"center",cursor:"pointer"}}>
      <div style={{fontSize:32,marginBottom:10}}>💰</div>
      <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Nothing here yet</div>
      <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.6,maxWidth:260,margin:"0 auto"}}>Add transactions to see your spending breakdown, or set up income in <span onClick={(e)=>{e.stopPropagation();setTab("you");}} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>You</span> first.</div>
      <div style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",background:T.accent,color:"#fff",borderRadius:20,fontSize:12,fontWeight:600}}>Add transactions →</div>
    </div>}
  </div>;
  const HomeContent=()=><div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
    {/* Top — APRIL 2026, Hey Alex, avatar + month picker */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 22px"}}>
      <div>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:500,letterSpacing:0.3,marginBottom:2}}>{monthLabelUpper(selectedMonth)}</div>
        <div style={{fontSize:16,fontWeight:600,color:T.textPrimary}}>Hey, {firstName}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
        <div onClick={()=>setTab("you")} style={{cursor:"pointer",flexShrink:0}}>
          {profile.avatar
            ?<img src={profile.avatar} alt="" style={{width:38,height:38,borderRadius:19,objectFit:"cover"}}/>
            :<div style={{width:38,height:38,borderRadius:19,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.accent}}>{firstName[0]?.toUpperCase()||"?"}</div>}
        </div>
      </div>
    </div>

    {/* Viewing past month banner */}
    {selectedMonth!==currentMonth()&&<div onClick={()=>setSelectedMonth(currentMonth())} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 14px",background:T.warning+"15",border:`1px solid ${T.warning}30`,borderRadius:14,marginBottom:18,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
        <span style={{fontSize:14,flexShrink:0}}>🕘</span>
        <div style={{fontSize:12,color:T.warning,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Viewing {monthLabel(selectedMonth)} — past month data below</div>
      </div>
      <span style={{fontSize:11,color:T.warning,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>← Back to current</span>
    </div>}

    {/* HERO — earnings prominent, breakdown pill below */}
    <div style={{marginBottom:22}}>
      {incTotal>0?(()=>{
        const isPastMonth=selectedMonth<currentMonth();
        const isFutureMonth=selectedMonth>currentMonth();

        // Future month — placeholder
        if(isFutureMonth){
          return <>
            <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>Future month</div>
            <div style={{fontSize:36,fontWeight:700,color:T.textPrimary,letterSpacing:-1,lineHeight:1.1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{monthLabel(selectedMonth)}</div>
            <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>Hasn't happened yet. Switch to <span onClick={()=>setSelectedMonth(currentMonth())} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>this month</span> to see what's going on.</div>
          </>;
        }

        // Current or past — show earnings as hero, breakdown below
        const earnedLabel=isPastMonth?"Earned":(isCurMonth&&dayOfMonth<=14?"Earnings expected":"Earned");
        return <>
          <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>
            {isCurMonth&&<span style={{display:"inline-block",width:6,height:6,borderRadius:3,background:T.accent,boxShadow:`0 0 0 4px ${T.accent}25`}}/>}
            {earnedLabel} {isCurMonth?"this month":`in ${monthLabel(selectedMonth).split(" ")[0]}`}
          </div>
          <div style={{fontSize:56,fontWeight:700,color:T.textPrimary,letterSpacing:-2,lineHeight:1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
            {(()=>{ const abs=Math.abs(incTotal); const cents=(abs-Math.floor(abs)).toFixed(2).slice(1); return <><CountUp value={Math.floor(abs)} duration={900} format={n=>sym+Math.floor(n).toLocaleString("en-SG")}/><span style={{fontSize:28,color:T.textMuted,fontWeight:500}}>{cents}</span></>; })()}
          </div>

          {/* Breakdown pill */}
          <div style={{display:"flex",gap:8,marginTop:18,padding:"10px 12px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.cardShadow}}>
            <div style={{flex:1,textAlign:"center",padding:"4px 6px"}}>
              <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:0.4,fontFamily:"'DM Mono'"}}>BILLS</div>
              <div style={{fontSize:13,fontWeight:700,color:T.bills,fontFamily:"'DM Mono'",marginTop:2}}>{fmt(fixedTotal)}</div>
            </div>
            <div style={{width:1,background:T.borderSoft,margin:"4px 0"}}/>
            <div style={{flex:1,textAlign:"center",padding:"4px 6px"}}>
              <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:0.4,fontFamily:"'DM Mono'"}}>SPENT</div>
              <div style={{fontSize:13,fontWeight:700,color:T.spent,fontFamily:"'DM Mono'",marginTop:2}}>{fmt(varTotal)}</div>
            </div>
            <div style={{width:1,background:T.borderSoft,margin:"4px 0"}}/>
            <div style={{flex:1,textAlign:"center",padding:"4px 6px"}}>
              <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:0.4,fontFamily:"'DM Mono'"}}>KEPT</div>
              <div style={{fontSize:13,fontWeight:700,color:saved>=0?T.accent:T.negative,fontFamily:"'DM Mono'",marginTop:2}}>{fmt(saved)}</div>
            </div>
          </div>

          {/* Context line */}
          {isCurMonth?<div style={{fontSize:12,color:T.textMuted,marginTop:12,lineHeight:1.5,textAlign:"center"}}>
            Day {dayOfMonth} of {daysInMonth}{savingsRate>0&&dayOfMonth>5?` · ${savingsRate.toFixed(0)}% saved so far`:""}{prevSaved!==0&&saved>=0&&savedDelta!==0?` · ${savedDelta>=0?"+":""}${fmt(savedDelta)} vs last month`:""}
          </div>:<div style={{fontSize:12,color:T.textMuted,marginTop:12,lineHeight:1.5,textAlign:"center"}}>
            {savingsRate.toFixed(0)}% saved of income{prevSaved!==0&&savedDelta!==0?` · ${savedDelta>=0?"better":"less"} than the month before`:""}
          </div>}
        </>;
      })():<>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>Welcome to {monthLabel(selectedMonth)}</div>
        <div style={{fontSize:32,fontWeight:700,color:T.textPrimary,letterSpacing:-1,lineHeight:1.1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Let's get you set up</div>
        <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>Add your income sources in <span onClick={()=>setTab("you")} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>You</span> to see your full picture.</div>
      </>}
    </div>

    {/* WHERE IT WENT — stacked bar viz, lighter now that we have the breakdown pill */}
    {(fixedTotal>0||varTotal>0||Math.max(0,saved)>0)&&<div style={{marginBottom:22}}>
      <div style={{display:"flex",height:10,borderRadius:5,overflow:"hidden",gap:2,background:T.surface2}}>
        {billsFlex>0&&<div style={{flex:billsFlex,background:T.bills}}/>}
        {spentFlex>0&&<div style={{flex:spentFlex,background:T.spent}}/>}
        {savedFlex>0&&<div style={{flex:savedFlex,background:T.accent}}/>}
      </div>
    </div>}

    {/* ── Across all months ── (cross-month section, independent of selectedMonth) */}
    {spendingTrend.filter(p=>p.hasData).length>=2&&(()=>{
      const pts=spendingTrend.filter(p=>p.hasData);
      const last3=pts.slice(-3);
      const avg3=last3.length>0?last3.reduce((s,p)=>s+p.total,0)/last3.length:0;
      const monthTops=pts.map(p=>{
        const entries=Object.entries(p.byCat).sort((a,b)=>b[1]-a[1]);
        return entries[0]?entries[0][0]:null;
      }).filter(Boolean);
      const topCounts={};
      monthTops.forEach(c=>{topCounts[c]=(topCounts[c]||0)+1;});
      const topCatEntry=Object.entries(topCounts).sort((a,b)=>b[1]-a[1])[0];
      const topCat=topCatEntry?topCatEntry[0]:null;
      const topCatN=topCatEntry?topCatEntry[1]:0;
      return <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",marginBottom:10,padding:"0 2px"}}>Across all months</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {renderSpendingTrendChart()}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"14px 16px",boxShadow:T.cardShadow,display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:36,height:36,borderRadius:18,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🗓</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:2}}>Recent activity</div>
              <div style={{fontSize:11,color:T.textSecondary,lineHeight:1.5}}>
                Averaging <span style={{fontFamily:"'DM Mono'",fontWeight:700,color:T.textPrimary}}>{fmt(avg3)}</span>/month over your last {last3.length} months
                {topCat&&topCatN>=2&&<>. Top category: <span style={{fontWeight:700}}>{topCat.split(" ").slice(1).join(" ")||topCat}</span> ({topCatN} of {pts.length} months)</>}
              </div>
            </div>
          </div>
        </div>
      </div>;
    })()}

    {/* Goal emphasis card (different for each goal type) */}
    {profile.goal&&(()=>{
      const g=profile.goal;
      const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
      // Save more — savings rate progress + monthly target if income known
      if(g.type==="save_more"){
        const savRate=incTotal>0?(saved/incTotal*100):null;
        if(savRate===null) return null;
        const goalRate=20; // 20% reasonable default goal
        const onTrack=savRate>=goalRate;
        const ringPct=Math.max(0,Math.min(1,savRate/Math.max(goalRate,1)));
        return <div onClick={()=>setSubScreen("insights")} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
          {/* Ring */}
          <svg width="64" height="64" viewBox="0 0 64 64" style={{flexShrink:0}}>
            <circle cx="32" cy="32" r="26" stroke={T.borderSoft} strokeWidth="6" fill="none"/>
            <circle cx="32" cy="32" r="26" stroke={onTrack?T.accent:T.warning} strokeWidth="6" fill="none" strokeDasharray={`${ringPct*163.36} 163.36`} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 32 32)"/>
            <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill={T.textPrimary} fontFamily="'Bricolage Grotesque','DM Sans',sans-serif">{savRate.toFixed(0)}%</text>
          </svg>
          <div style={{flex:1,minWidth:0}}>
            <MicroLabel style={{marginBottom:4}}>SAVE MORE · GOAL {goalRate}%</MicroLabel>
            <div style={{fontSize:14,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{onTrack?"On track":"Below target"}</div>
            <div style={{fontSize:11,color:T.textSecondary,marginTop:2,lineHeight:1.4}}>{onTrack?`${fmt(saved)} saved · ${(savRate-goalRate).toFixed(0)} points above goal`:`${fmt(saved)} saved · ${fmt(incTotal*goalRate/100-saved)} more to hit goal`}</div>
          </div>
        </div>;
      }
      // Get out of debt — debt remaining + projected payoff
      if(g.type==="get_out_of_debt"){
        const totalDebt=+g.params?.totalDebt||0;
        if(totalDebt<=0) return null;
        // Use last 3 months avg saved as monthly payoff capacity
        const recent=monthlySavings.filter(m=>m.hasData&&!m.isCurrent).slice(-3);
        const avgNet=recent.length>0?recent.reduce((s,m)=>s+m.saved,0)/recent.length:0;
        const monthsLeft=avgNet>0?Math.ceil(totalDebt/avgNet):null;
        const payoffDate=monthsLeft?new Date(new Date().setMonth(new Date().getMonth()+monthsLeft)):null;
        return <div onClick={()=>setSubScreen("insights")} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer"}}>
          <MicroLabel style={{marginBottom:6}}>DEBT-FREE PLAN</MicroLabel>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.8}}>{fmt(totalDebt)}</div>
            <div style={{fontSize:11,color:T.textMuted}}>remaining</div>
          </div>
          {monthsLeft?<div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>At your recent pace ({fmt(avgNet)}/mo net), you'd be debt-free by <span style={{fontWeight:700,color:T.accent}}>{payoffDate.toLocaleDateString("en-SG",{month:"short",year:"numeric"})}</span> ({monthsLeft} month{monthsLeft!==1?"s":""}).</div>
            :<div style={{fontSize:12,color:T.textMuted,lineHeight:1.5}}>Save more each month to project a payoff date.</div>}
        </div>;
      }
      // Understand spending — surface most active insight
      if(g.type==="understand_spending"){
        // Pick the most "interesting" ready insight that isn't already on the visible list
        const candidates=insightCatalog.filter(i=>i.ready&&i.renderHome&&(i.id==="category_vs_usual"||i.id==="highest_category"));
        if(candidates.length===0) return null;
        const ins=candidates[0];
        return <div onClick={()=>setSubScreen("insights")} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer"}}>
          <div style={{padding:"10px 14px 0",fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>WORTH NOTING</div>
          {ins.renderHome({T,fmt})}
        </div>;
      }
      // Spend less on a category — daily-budget-remaining
      if(g.type==="spend_less_on"){
        const cat=g.params?.category;
        const cap=+g.params?.cap||0;
        if(!cat) return null;
        const catSpent=Math.abs((txs||[]).filter(t=>t.category===cat&&t.amount>0).reduce((s,t)=>s+effectiveAmount(t),0));
        const today=new Date(); const dayOfM=today.getDate(); const dim=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
        const daysLeft=Math.max(0,dim-dayOfM);
        const remaining=cap>0?Math.max(0,cap-catSpent):null;
        const dailyAllowed=remaining&&daysLeft>0?remaining/daysLeft:null;
        const pct=cap>0?Math.min(1,catSpent/cap):0;
        const over=cap>0&&catSpent>cap;
        return <div onClick={()=>setSubScreen("insights")} style={{background:T.surface,border:`1px solid ${over?T.negative+"40":T.border}`,borderRadius:18,padding:"14px 16px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <MicroLabel>SPEND LESS ON {cat.split(" ").slice(1).join(" ").toUpperCase()||cat}</MicroLabel>
            <span style={{fontFamily:"'DM Mono'",fontSize:11,color:T.textMuted}}>{daysLeft} days left</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
            <span style={{fontSize:20,fontWeight:800,color:over?T.negative:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.6}}>{fmt(catSpent)}</span>
            {cap>0&&<span style={{fontSize:12,color:T.textMuted}}>of {fmt(cap)}</span>}
          </div>
          {cap>0&&<div style={{height:5,background:T.borderSoft,borderRadius:4,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",width:`${pct*100}%`,background:over?T.negative:pct>0.8?T.warning:T.accent,borderRadius:4,transition:"width .3s"}}/>
          </div>}
          {dailyAllowed!==null&&!over&&<div style={{fontSize:11,color:T.textSecondary}}>{fmt(dailyAllowed)}/day for the rest of the month keeps you under.</div>}
          {over&&<div style={{fontSize:11,color:T.negative,fontWeight:600}}>Over by {fmt(catSpent-cap)} this month.</div>}
          {!cap&&<div style={{fontSize:11,color:T.textMuted}}>Set a monthly cap in You → Goal to track this.</div>}
        </div>;
      }
      return null;
    })()}

    {/* 6-MONTH TREND — line chart */}
    {monthlySavings.filter(m=>m.hasData).length>=2&&(()=>{
      const points=monthlySavings;
      const W=320, H=110, padX=14, padY=18;
      const innerW=W-padX*2, innerH=H-padY*2;
      const values=points.flatMap(p=>[p.saved,p.projected].filter(v=>v!=null));
      const max=Math.max(...values,0);
      const min=Math.min(...values,0);
      const range=Math.max(1,max-min);
      const xFor=i=>padX+(points.length<=1?innerW/2:(i/(points.length-1))*innerW);
      const yFor=v=>padY+innerH-((v-min)/range)*innerH;
      const zeroY=yFor(0);
      // Build solid path (only points with data, ending at last full month or current actual)
      const solidPts=points.map((p,i)=>p.hasData?{x:xFor(i),y:yFor(p.saved),i,p}:null).filter(Boolean);
      const solidPath=solidPts.map((pt,i)=>`${i===0?"M":"L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
      // Build dashed projection segment if current month has projected
      const curIdx=points.findIndex(p=>p.isCurrent);
      const cur=points[curIdx];
      let projPath=null, projEndPt=null;
      if(cur&&cur.projected!=null&&cur.hasData){
        // Dashed line from current actual to projected
        projEndPt={x:xFor(curIdx),y:yFor(cur.projected)};
        const startPt={x:xFor(curIdx),y:yFor(cur.saved)};
        projPath=`M${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} L${projEndPt.x.toFixed(1)} ${projEndPt.y.toFixed(1)}`;
      }
      const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
      const fmtCompact=v=>{ const a=Math.abs(v); if(a>=1000) return `${v<0?"-":""}${sym}${(a/1000).toFixed(a>=10000?0:1)}k`; return `${v<0?"-":""}${sym}${a.toFixed(0)}`; };
      const lastSaved=cur?.hasData?cur.saved:(solidPts.length?solidPts[solidPts.length-1].p.saved:0);
      const prevPt=solidPts.length>=2?solidPts[solidPts.length-2]:null;
      const trendUp=prevPt?lastSaved>=prevPt.p.saved:true;

      return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"14px 16px 10px",marginBottom:12,boxShadow:T.cardShadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
          <div>
            <MicroLabel style={{marginBottom:2}}>6-MONTH TREND</MicroLabel>
            <div style={{fontSize:11,color:T.textMuted}}>{trendUp?"↑ trending up":"↓ trending down"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:T.textMuted}}>Avg saved</div>
            <div style={{fontSize:13,fontFamily:"'DM Mono'",fontWeight:700,color:T.textPrimary}}>{fmtCompact(solidPts.reduce((s,p)=>s+p.p.saved,0)/Math.max(1,solidPts.length))}</div>
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:"block",overflow:"visible"}}>
          {/* Zero baseline */}
          {min<0&&zeroY>=padY&&zeroY<=H-padY&&<line x1={padX} y1={zeroY} x2={W-padX} y2={zeroY} stroke={T.border} strokeWidth="1" strokeDasharray="2,3"/>}
          {/* Solid path */}
          {solidPath&&<path d={solidPath} fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
          {/* Projection */}
          {projPath&&<path d={projPath} fill="none" stroke={T.accent} strokeWidth="2" strokeDasharray="4,4" strokeLinecap="round" opacity="0.55"/>}
          {/* Points */}
          {solidPts.map((pt,i)=><g key={i} style={{cursor:"pointer"}} onClick={()=>setSelectedMonth(pt.p.month)}>
            <circle cx={pt.x} cy={pt.y} r="11" fill="transparent"/>
            <circle cx={pt.x} cy={pt.y} r={pt.p.month===selectedMonth?5:3.5} fill={pt.p.month===selectedMonth?T.accent:T.surface} stroke={T.accent} strokeWidth="2"/>
          </g>)}
          {/* Projected dot */}
          {projEndPt&&<circle cx={projEndPt.x} cy={projEndPt.y} r="3" fill={T.surface} stroke={T.accent} strokeWidth="2" opacity="0.55"/>}
          {/* X-axis month labels */}
          {points.map((p,i)=>{
            const isSel=p.month===selectedMonth;
            const lbl=monthLabelShort(p.month).split(" ")[0]; // "Apr"
            return <text key={`l${i}`} x={xFor(i)} y={H-3} textAnchor="middle" fontSize="9" fill={isSel?T.accent:T.textMuted} fontFamily="DM Mono" fontWeight={isSel?"700":"500"}>{lbl}</text>;
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,fontSize:10,color:T.textMuted}}>
          <span>Tap a point to switch month</span>
          {projEndPt&&<span><span style={{display:"inline-block",width:10,height:2,background:T.accent,opacity:0.55,verticalAlign:"middle",marginRight:4}}/>projected</span>}
        </div>
      </div>;
    })()}

    {/* Forecast insight */}
    {isCurMonth&&incTotal>0&&dayOfMonth>5&&<div onClick={()=>setSubScreen("forecast")} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"14px 16px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{fontSize:18}}>📈</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:2}}>You'll likely save ~{fmt(projectedSaved)} by month-end</div>
          <div style={{fontSize:11,color:T.textSecondary,lineHeight:1.5}}>{prevSaved!==0?(projectedSaved>=prevSaved?`That's ${fmt(projectedSaved-prevSaved)} more than last month.`:`That's ${fmt(prevSaved-projectedSaved)} less than last month.`):"Based on your spending so far this month."}</div>
        </div>
        <span style={{fontSize:14,color:T.textMuted}}>›</span>
      </div>
    </div>}

    {/* Active insights (curated by user) */}
    {visibleInsights.length>0&&<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
      {visibleInsights.map(ins=><div key={ins.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,boxShadow:T.cardShadow,cursor:"pointer"}} onClick={()=>setSubScreen("insights")}>
        {ins.renderHome({T,fmt})}
      </div>)}
    </div>}

    {/* Subscriptions insight — promoted to Home */}
    {detectedSubscriptions.length>0&&(()=>{
      const subTotal=detectedSubscriptions.reduce((s,x)=>s+x.amount,0);
      const yearly=subTotal*12;
      const flagged=detectedSubscriptions.filter(s=>s.priceChange>0||s.monthsSeen>=4);
      const hasFlag=flagged.length>0;
      return <button onClick={()=>setSubScreen("subscriptions")} style={{width:"100%",background:T.surface,border:`1px solid ${hasFlag?T.warning+"40":T.border}`,borderRadius:18,padding:"14px 16px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:36,height:36,borderRadius:18,background:hasFlag?T.warning+"20":T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{hasFlag?"⚠":"📱"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:2}}>{hasFlag?`${flagged.length} subscription${flagged.length!==1?"s":""} worth checking`:`${detectedSubscriptions.length} active subscription${detectedSubscriptions.length!==1?"s":""}`}</div>
          <div style={{fontSize:11,color:T.textSecondary}}>{fmt(subTotal)}/mo · {fmt(yearly)}/yr</div>
        </div>
        <span style={{fontSize:14,color:T.textMuted,flexShrink:0}}>›</span>
      </button>;
    })()}

    {/* Things to do — consolidated nudges */}
    {(()=>{
      const todos=[];
      if(pendingTxs.length>0) todos.push({
        id:"review", icon:"📋", color:T.warning,
        label:`${pendingTxs.length} new transaction${pendingTxs.length!==1?"s":""} to check`,
        sub:"From your latest import",
        onClick:()=>setSubScreen("review")
      });
      const pendVar=pendingVarStreams(streams,ov,selectedMonth);
      if(pendVar.length>0) todos.push({
        id:"varincome", icon:"💰", color:T.info,
        label:`${pendVar.length} variable income${pendVar.length>1?"s":""} to enter`,
        sub:`${pendVar.map(p=>p.stream.name).slice(0,2).join(", ")}${pendVar.length>2?` +${pendVar.length-2}`:""}`,
        onClick:()=>setTab("money")
      });
      // Budget alerts: any category over 80% of its budget this month
      if(profile.budgets){
        const overBudget=byCat.filter(([cat,amt])=>{ const b=profile.budgets[cat]; return b&&b>0&&Math.abs(amt)>=b*0.8; });
        if(overBudget.length>0) todos.push({
          id:"budget", icon:"⚠", color:T.negative,
          label:`${overBudget.length} budget${overBudget.length!==1?"s":""} near limit`,
          sub:overBudget.slice(0,2).map(([c])=>c.split(" ")[1]||c).join(", "),
          onClick:()=>setTab("money")
        });
      }
      if(todos.length===0) return null;

      // Single-todo: render expanded by default (no point collapsing one item)
      if(todos.length===1){
        const t=todos[0];
        return <button onClick={t.onClick} style={{width:"100%",background:t.color+"10",border:`1px solid ${t.color}30`,borderRadius:18,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:32,height:32,borderRadius:16,background:t.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{t.icon}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{t.label}</div>
              <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>{t.sub}</div>
            </div>
          </div>
          <span style={{fontSize:16,color:t.color}}>→</span>
        </button>;
      }

      // Multi-todo: collapsible header + expandable list
      return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,marginBottom:12,boxShadow:T.cardShadow,overflow:"hidden"}}>
        <button onClick={()=>setTodosExpanded(e=>!e)} style={{width:"100%",padding:"14px 16px",background:"transparent",border:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:32,height:32,borderRadius:16,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.accent,fontWeight:800}}>{todos.length}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{todos.length} things to do</div>
              <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>{todos.map(t=>t.icon).join(" · ")}</div>
            </div>
          </div>
          <span style={{fontSize:14,color:T.textMuted,transition:"transform .15s",transform:todosExpanded?"rotate(180deg)":"rotate(0)"}}>▾</span>
        </button>
        {todosExpanded&&<div style={{borderTop:`1px solid ${T.borderSoft}`}}>
          {todos.map((t,i)=><button key={t.id} onClick={t.onClick} style={{width:"100%",padding:"12px 16px",background:"transparent",border:"none",borderTop:i>0?`1px solid ${T.borderSoft}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:28,height:28,borderRadius:14,background:t.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{t.icon}</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{t.label}</div>
                <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>{t.sub}</div>
              </div>
            </div>
            <span style={{fontSize:14,color:t.color}}>→</span>
          </button>)}
        </div>}
      </div>;
    })()}

    {/* Top spending — tappable to Money tab */}
    {byCat.length>0&&<button onClick={()=>setTab("money")} style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:16,marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"block"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Top spending</div>
        <span style={{fontSize:11,color:T.accent,fontWeight:600}}>{byCat.length>4?`+${byCat.length-4} more →`:"See all →"}</span>
      </div>
      {byCat.slice(0,4).map(([cat,amt])=>{
        const pct=varTotal!==0?(Math.abs(amt)/Math.abs(varTotal)*100):0;
        return <div key={cat} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:T.textPrimary}}>{cat}</span>
            <span style={{fontSize:12,fontFamily:"'DM Mono'",fontWeight:600,color:T.textPrimary}}>{fmt(Math.abs(amt))}</span>
          </div>
          <div style={{height:4,background:T.borderSoft,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:COLS[cat]||T.accent,borderRadius:4}}/>
          </div>
        </div>;
      })}
    </button>}

    {/* Empty state */}
    {byCat.length===0&&<div onClick={()=>{setAddMode("choose");setSubScreen("add");}} style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:18,padding:"32px 20px",textAlign:"center",cursor:"pointer",marginBottom:12}}>
      <div style={{fontSize:32,marginBottom:10}}>👋</div>
      <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,marginBottom:6,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Add your first transactions</div>
      <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.6,maxWidth:260,margin:"0 auto"}}>Upload a bank statement to extract everything in one go, or quick-add a transaction by hand.</div>
      <div style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",background:T.accent,color:"#fff",borderRadius:20,fontSize:12,fontWeight:600}}>Add transactions →</div>
    </div>}

    {/* Privacy badge */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:24,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
      <PrivacyLock col={T.textMuted}/>
      100% on-device · nothing leaves your phone
    </div>
  </div>;

  // ── UPLOAD screen content ─────────────────────────────────────────────────
  const UploadScreen=()=>{
    const STEPS=[
      {id:1,label:"Reading file"},
      {id:2,label:"Claude is reading your statement"},
      {id:3,label:uploadTxCount>0?`Categorising ${uploadTxCount} transactions`:"Categorising by merchant"},
      {id:4,label:"Ready for review"},
    ];
    const submitManual=()=>{ addManual({description:manualDesc,amount:manualAmt,category:manualCat||CATS[0]||"📦 Other",date:manualDate}); setManualDesc("");setManualAmt("");setManualOpen(false); };

    return <div>
      {!uploading&&uploadStep===0
        ?<>
          <div style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:20,padding:"32px 20px",textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:42,marginBottom:12}}>📄</div>
            <div style={{fontSize:17,fontWeight:700,color:T.textPrimary,marginBottom:4,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Upload your bank statement</div>
            <div style={{fontSize:13,color:T.textSecondary,lineHeight:1.5,marginBottom:14}}>Claude reads every transaction · You review before saving</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.warning+"15",border:`1px solid ${T.warning}30`,borderRadius:10,padding:"7px 12px",marginBottom:18,fontSize:11,color:T.warning,fontWeight:600}}><span>📶</span>Use WiFi for best results</div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>fileRef.current.click()} style={{padding:"13px 22px",background:T.accent,color:"#fff",border:"none",borderRadius:14,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8}}>📄 PDF or CSV</button>
              <button onClick={()=>photoRef.current.click()} style={{padding:"13px 22px",background:"transparent",color:T.textPrimary,border:`1px solid ${T.borderMid}`,borderRadius:14,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8}}>📷 Photo</button>
            </div>
            {uploadMsg&&<div style={{marginTop:14,fontSize:12,color:uploadMsg.startsWith("✓")?T.positive:T.negative}}>{uploadMsg}</div>}
          </div>
        </>
        :<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:18,marginBottom:14,boxShadow:T.cardShadow}}>
          {uploadFile&&<div style={{padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:18}}>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:T.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{uploadFile.name}</div>
                <div style={{fontSize:10,color:T.textMuted}}>{(uploadFile.size/1024/1024).toFixed(1)} MB · {uploadStep<4?"Processing…":"Done"}</div>
              </div>
            </div>
            <div style={{height:4,background:"rgba(0,0,0,0.06)",borderRadius:3,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",inset:0,background:T.accent,borderRadius:3,animation:uploadStep<4?"pulsebar 1.4s ease-in-out infinite":"none",width:uploadStep===4?"100%":"60%"}}/>
            </div>
          </div>}
          {uploadStep===4&&uploadInsight.topCat
            ?<div style={{padding:"6px 0 4px"}}>
              <MicroLabel style={{marginBottom:14,color:T.accent}}>HERE'S WHAT WE FOUND</MicroLabel>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                <div style={{padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:12,display:"flex",alignItems:"center",gap:12,animation:"slideIn 0.4s ease-out 0s both"}}>
                  <div style={{fontSize:22}}>🧾</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>FOUND</div>
                    <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{uploadTxCount} transactions{uploadInsight.monthsCovered>1?` across ${uploadInsight.monthsCovered} months`:""}</div>
                  </div>
                </div>
                <div style={{padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:12,display:"flex",alignItems:"center",gap:12,animation:"slideIn 0.4s ease-out 0.45s both"}}>
                  <div style={{fontSize:22}}>{uploadInsight.topCat?.split(" ")[0]||"📊"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>TOP CATEGORY</div>
                    <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{uploadInsight.topCat?.split(" ").slice(1).join(" ")||uploadInsight.topCat}</div>
                  </div>
                </div>
                <div style={{padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:12,display:"flex",alignItems:"center",gap:12,animation:"slideIn 0.4s ease-out 0.9s both"}}>
                  <div style={{fontSize:22}}>💸</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",fontWeight:600,letterSpacing:0.4}}>TOTAL SPENT</div>
                    <div style={{fontSize:15,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(uploadInsight.totalSpent)}</div>
                  </div>
                </div>
              </div>
              <div style={{textAlign:"center",fontSize:11,color:T.textMuted,fontStyle:"italic",animation:"fadeIn 0.4s ease-out 1.3s both"}}>Opening review…</div>
            </div>
            :<>
              <MicroLabel style={{marginBottom:10}}>{uploadStep===3?"Organising transactions":uploadStep===2?"Claude is reading":"Reading file"}</MicroLabel>
              {STEPS.map(s=>{
                const done=uploadStep>s.id; const active=uploadStep===s.id;
                return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <span style={{fontSize:14,width:20,display:"flex",justifyContent:"center"}}>{done?"✅":active?<span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⏳</span>:"⏳"}</span>
                  <span style={{fontSize:13,color:done?T.textMuted:active?T.textPrimary:T.textMuted,fontWeight:active?600:400,opacity:uploadStep<s.id?0.5:1}}>{s.label}</span>
                </div>;
              })}
            </>}
          {uploadMsg&&uploadMsg.startsWith("⚠")&&<div style={{marginTop:14,fontSize:12,color:T.negative}}>{uploadMsg}</div>}
          <style>{`@keyframes pulsebar{0%,100%{opacity:.4}50%{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        </div>}

      <input ref={fileRef} type="file" accept=".pdf,.csv,application/pdf,text/csv" style={{display:"none"}} onChange={handleFile}/>
      <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:18,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
        <PrivacyLock col={T.textMuted}/>Your statement never leaves this device
      </div>
    </div>;
  };

  // ── SUBSCRIPTIONS detail screen ───────────────────────────────────────────
  const SubscriptionsScreen=()=>{
    const total=detectedSubscriptions.reduce((s,x)=>s+x.amount,0);
    const yearly=total*12;
    const flagged=detectedSubscriptions.filter(s=>s.priceChange>0||s.monthsSeen>=4);
    return <div>
      <div style={{textAlign:"center",marginBottom:22}}>
        <MicroLabel style={{marginBottom:8}}>YOU'RE SPENDING</MicroLabel>
        <div style={{fontSize:48,fontWeight:700,color:T.textPrimary,letterSpacing:-1.5,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(total)}<span style={{fontSize:18,color:T.textMuted,fontWeight:500}}>/mo</span></div>
        <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>That's <span style={{fontWeight:700,color:T.textPrimary}}>{fmt(yearly)}</span> a year</div>
      </div>

      {flagged.length>0&&<div style={{background:T.warning+"10",border:`1px solid ${T.warning}30`,borderRadius:18,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:T.warning,marginBottom:6}}>⚠ Worth checking</div>
        <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>{flagged.length} subscription{flagged.length!==1?"s":""} {flagged.some(f=>f.priceChange>0)?"had a price increase":"running a while now"}.</div>
      </div>}

      <MicroLabel style={{marginBottom:10,marginLeft:4}}>ACTIVE SUBSCRIPTIONS</MicroLabel>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,overflow:"hidden",marginBottom:14,boxShadow:T.cardShadow}}>
        {detectedSubscriptions.length===0&&<div style={{padding:"32px 20px",textAlign:"center",fontSize:13,color:T.textMuted}}>No subscriptions detected yet.<br/>Import 2+ months of statements to see recurring charges.</div>}
        {detectedSubscriptions.map((s,i)=>{
          const flags=[]; if(s.priceChange>0) flags.push({col:T.warning,text:`+${fmt(s.priceChange)} vs first charge`});
          if(s.monthsSeen>=4) flags.push({col:T.textMuted,text:`Active ${s.monthsSeen} months`});
          return <div key={i} style={{padding:"14px 16px",borderTop:i?`1px solid ${T.borderSoft}`:"none",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.category?.split(" ")[0]||"📱"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.description}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>~{fmt(s.amount*12)}/yr</div>
              {flags.map((f,j)=><div key={j} style={{fontSize:10,color:f.col,marginTop:2,fontWeight:600}}>{f.text}</div>)}
            </div>
            <div style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:700,color:T.textPrimary}}>{fmt(s.amount)}</div>
          </div>;
        })}
      </div>

      {detectedSubscriptions.length>0&&<div style={{padding:"12px 14px",fontSize:11,color:T.textMuted,textAlign:"center",lineHeight:1.5}}>Subscriptions are auto-detected from your statements based on recurring charges with similar amounts each month.</div>}
    </div>;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const exitPreview=()=>{
    // Clear the sample data and return to a real (empty) dashboard
    lsSave("monthlyData",{});
    setMonthlyData({});
    setPreviewMode(false);
    setSelectedMonth(currentMonth());
    setSubScreen(null);
    setTab("home");
    setTxDetailId(null);
    showToast("Preview cleared — your real dashboard awaits");
  };

  return <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&family=Bricolage+Grotesque:wght@600;700;800&display=swap" rel="stylesheet"/>

      {/* Preview banner — sticky at top, clear sample-data signal */}
      {previewMode&&<div style={{position:"sticky",top:0,zIndex:150,background:T.warning,color:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 2px 12px rgba(0,0,0,0.18)"}}>
        <div style={{fontSize:18,flexShrink:0}}>👁</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,lineHeight:1.2}}>Preview — this is sample data</div>
          <div style={{fontSize:10,opacity:0.9,marginTop:1}}>Tap around to explore. Then tap the button →</div>
        </div>
        <button onClick={exitPreview} style={{background:"#fff",color:T.warning,border:"none",borderRadius:14,padding:"6px 12px",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Take me to my real dashboard</button>
      </div>}

      {/* Global overlays */}
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {showPrivacy&&<PrivacyModal onClose={()=>setShowPrivacy(false)}/>}
      {restoreCandidate&&<RestoreModal backup={restoreCandidate} onConfirm={()=>doRestore(restoreCandidate)} onClose={()=>setRestoreCandidate(null)}/>}
      {showReset&&<ResetModal onConfirm={doReset} onClose={()=>setShowReset(false)} onDownloadFirst={()=>{dlBackup(profile,monthlyData,insights,archive);showToast("Backup downloaded");}}/>}

      {/* Sub-screen overlays */}
      {subScreen&&<div style={{position:"fixed",inset:0,background:T.bg,zIndex:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{maxWidth:580,margin:"0 auto",padding:"8px 18px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 0 18px"}}>
            <button onClick={()=>{setSubScreen(null);setAddMode("choose");setIbDraft(null);setGoalsDraft(null);}} style={{background:"none",border:"none",fontSize:24,color:T.textSecondary,cursor:"pointer",padding:"4px 8px",fontFamily:"inherit"}}>‹</button>
            <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
              {subScreen==="add"?"Add":subScreen==="upload"?"Upload statement":subScreen==="review"?"Quick review":subScreen==="forecast"?"Forecast":subScreen==="subscriptions"?"Subscriptions":subScreen==="income-bills"?"Income & Bills":subScreen==="goals"?"Goals":subScreen==="theme"?"Theme":subScreen==="advanced"?"Advanced":subScreen==="search"?"Search":subScreen==="insights"?"Insights":""}
            </div>
          </div>
          {subScreen==="add"&&AddChooserScreen()}
          {subScreen==="upload"&&UploadScreen()}
          {subScreen==="subscriptions"&&SubscriptionsScreen()}
          {subScreen==="forecast"&&ForecastScreen()}
          {subScreen==="review"&&ReviewScreen()}
          {subScreen==="income-bills"&&IncomeBillsSection()}
          {subScreen==="goals"&&GoalsSection()}
          {subScreen==="theme"&&ThemeSection()}
          {subScreen==="advanced"&&AdvancedSection()}
          {subScreen==="search"&&SearchScreen()}
          {subScreen==="insights"&&InsightsScreen()}
        </div>
      </div>}

      {/* Transaction detail modal */}
      {txDetailId&&(()=>{
        const found=findTx(txDetailId);
        if(!found) return null;
        // Build autocomplete suggestions from past split-with names
        const sugg=new Set();
        Object.values(monthlyData).forEach(md=>(md.txs||[]).forEach(t=>{ if(t.split?.with) sugg.add(t.split.with); }));
        return <TxDetailModal tx={found.tx} month={found.month} monthLabel={monthLabel} allCats={[...CATS,...FIXED_CATS]} fmt={fmt} onSave={d=>editTx(d,found.month)} onArchive={(id,m)=>archiveTx(id,m)} onClose={()=>{setTxDetailId(null);setTxDetailMonth(null);}} splitSuggestions={[...sugg]}/>;
      })()}

      {/* Bills/Recurring detection modals */}
      {fixedCommitDetected&&<FixedCommitModal detected={fixedCommitDetected} fmt={fmt} onConfirm={handleFixedCommitConfirm} onSkip={()=>{
        const toReview=(fixedCommitDetected||[]).filter(c=>c.fullTx).map(c=>c.fullTx);
        if(toReview.length>0) setPendingTxs(p=>[...p,...toReview]);
        setFixedCommitDetected(null);
      }}/>}
      {recurringDetected&&<RecurringModal suggestions={recurringDetected} onConfirm={handleRecurringConfirm} onDismiss={()=>setRecurringDetected(null)}/>}

      {/* Main content */}
      <div style={{maxWidth:580,margin:"0 auto",paddingBottom:96}}>
        {tab==="home"&&HomeContent()}
        {tab==="money"&&MoneyContent()}
        {tab==="you"&&YouContent()}
      </div>

      {/* Bottom tab bar with floating + button */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,paddingBottom:"max(env(safe-area-inset-bottom), 18px)",paddingTop:8,display:"flex",zIndex:100}}>
        {[
          ["home",TabIconHome,"Home"],
          ["money",TabIconMoney,"Money"],
          ["you",TabIconYou,"You"],
        ].map(([id,Icon,lbl])=>{
          const active=tab===id;
          return <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 0",background:"none",border:"none",color:active?T.accent:T.textMuted,fontFamily:"inherit",fontSize:10,fontWeight:active?700:500,cursor:"pointer"}}>
            <Icon active={active} col={T.accent} muted={T.textMuted}/>
            {lbl}
          </button>;
        })}
        {/* Floating + button — anchored to right side, raised */}
        <button onClick={()=>{setAddMode("choose");setSubScreen("add");}} style={{position:"absolute",right:18,top:-26,width:56,height:56,borderRadius:28,background:T.accent,border:`4px solid ${T.bg}`,color:"#fff",fontSize:28,fontWeight:300,cursor:"pointer",boxShadow:`0 6px 20px ${T.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,paddingBottom:4,fontFamily:"inherit"}}>+</button>
      </div>
    </div>
  </ThemeCtx.Provider>;
}

