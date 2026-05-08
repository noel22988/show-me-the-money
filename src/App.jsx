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
  startMonth:currentMonth()
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

// ── Habit helpers ─────────────────────────────────────────────────────────────
const HABIT_THRESHOLD = 1;
function habitFlags(eh,ch){
  const mf={},cf={};
  for(const [k,v] of Object.entries(eh||{})){ const count=typeof v==="object"?v.count:v; if(count>=HABIT_THRESHOLD) mf[k]=v; }
  for(const [k,v] of Object.entries(ch||{})) if(v>=HABIT_THRESHOLD) cf[k]=v;
  return {mf,cf};
}
function habitReason(tx,mf,cf){
  const k=tx.description?.toLowerCase().trim();
  if(mf[k]) return `excluded before`;
  if(cf[tx.category]) return `category excluded before`;
  return null;
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
function mkSnap(profile,md,eh,ch,ins,arc){ return {version:APP_VERSION,createdAt:new Date().toISOString(),profile,monthlyData:md,excludeHistory:eh,catExcludeHistory:ch,insights:ins,archive:arc}; }
function autoBackup(profile,md,eh,ch,ins,arc){
  try{ const snap=mkSnap(profile,md,eh,ch,ins,arc); const ex=lsLoad("autoBackups")||[]; const today=todayStr(); lsSave("autoBackups",[snap,...ex.filter(b=>!b.createdAt?.startsWith(today))].slice(0,MAX_AUTO_BACKUPS)); }catch(e){ console.error(e); }
}
function dlBackup(profile,md,eh,ch,ins,arc){
  const blob=new Blob([JSON.stringify(mkSnap(profile,md,eh,ch,ins,arc),null,2)],{type:"application/json"});
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

  const finishWithProfile=(extraMonthly={})=>{
    const profile={...DEFAULT_PROFILE,name:name.trim()||"You",currency,onboarded:true,incomeStreams:streams.filter(s=>s.name?.trim()),fixedCommitments:bills.filter(b=>b.name?.trim()&&+b.amount>0),startMonth:currentMonth()};
    if(Object.keys(extraMonthly).length>0){ lsSave("monthlyData",extraMonthly); }
    onComplete(profile);
  };
  const skipWithSample=()=>{
    const sample=generateSampleData();
    const profile={...DEFAULT_PROFILE,name:name.trim()||"You",currency,onboarded:true,incomeStreams:[{id:"salary_sample",name:"Salary",type:"fixed",defaultAmount:5400,active:true,startFrom:""}],fixedCommitments:[{id:`c${Date.now()}1`,name:"Rent",amount:1800,startFrom:""},{id:`c${Date.now()}2`,name:"Insurance",amount:185,startFrom:""}],startMonth:Object.keys(sample)[0]};
    lsSave("monthlyData",sample);
    onComplete(profile);
  };

  const banks=["DBS","OCBC","UOB","Citi","HSBC","Standard Chartered","CIMB","Maybank","Trust Bank","GXS","Wise","Revolut"];
  const inp={padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"};
  const inpS={...inp,padding:"10px 12px",fontSize:13,background:T.surface2};

  const StepDots=()=><div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24}}>
    {[0,1,2,3,4].map(i=><div key={i} style={{width:i===step?22:6,height:6,borderRadius:3,background:i===step?T.accent:i<step?T.accent:T.border,transition:"width .2s"}}/>)}
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

  // Step 2 — Income
  if(step===2) return <Wrap>
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
      <Btn onClick={()=>setStep(3)}>Continue</Btn>
      <button onClick={()=>setStep(3)} style={{marginTop:8,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip for now</button>
    </div>
  </Wrap>;

  // Step 3 — Bills
  if(step===3) return <Wrap>
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
      <Btn onClick={()=>setStep(4)}>Continue</Btn>
      <button onClick={()=>setStep(4)} style={{marginTop:8,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>Skip for now</button>
    </div>
  </Wrap>;

  // Step 4 — Privacy / supported banks reassurance + finish
  return <Wrap>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:18,display:"inline-flex",width:72,height:72,borderRadius:36,background:T.accentSoft,color:T.accent,alignItems:"center",justifyContent:"center",fontSize:36}}>🎉</div>
      <div style={{fontSize:26,fontWeight:800,color:T.textPrimary,letterSpacing:-0.8,lineHeight:1.1,marginBottom:14,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>You're all set, {name.split(" ")[0]}</div>
      <div style={{fontSize:14,color:T.textSecondary,lineHeight:1.6,marginBottom:18}}>Tap the green + button to upload your first bank statement. We support PDFs and CSVs from:</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:24}}>
        {banks.map(b=><div key={b} style={{padding:"5px 11px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,fontSize:11,color:T.textSecondary,fontWeight:500}}>{b}</div>)}
        <div style={{padding:"5px 11px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:14,fontSize:11,color:T.accent,fontWeight:600}}>+ any other</div>
      </div>
      <Btn onClick={()=>finishWithProfile()}>Start tracking →</Btn>
      <button onClick={()=>setStep(3)} style={{marginTop:10,background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:8}}>← Back</button>
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
  const [eh,setEh]=useState({});
  const [ch,setCh]=useState({});
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
  // Money tab state
  const [moneyShowSubs,setMoneyShowSubs]=useState(true);
  const [catFilter,setCatFilter]=useState("All");
  const fileRef=useRef(); const photoRef=useRef();
  const backupTimer=useRef(null);

  useEffect(()=>{
    const p=lsLoad("profile"); setProfile(p||DEFAULT_PROFILE);
    const md=lsLoad("monthlyData"); if(md) setMonthlyData(md);
    const e=lsLoad("excludeHistory"); if(e) setEh(e);
    const c=lsLoad("catExcludeHistory"); if(c) setCh(c);
    const ins=lsLoad("insights"); if(ins) setInsights(ins);
    const arc=lsLoad("archive"); if(arc) setArchive(arc);
  },[]);
  useEffect(()=>{ if(profile?.startMonth&&selectedMonth<profile.startMonth) setSelectedMonth(profile.startMonth); },[profile?.startMonth]);
  useEffect(()=>{
    if(!profile?.onboarded) return;
    clearTimeout(backupTimer.current);
    backupTimer.current=setTimeout(()=>autoBackup(profile,monthlyData,eh,ch,insights,archive),3000);
    return()=>clearTimeout(backupTimer.current);
  },[profile,monthlyData,eh,ch,archive]);

  const theme=useMemo(()=>buildTheme(profile?.accentColor||CALM_DEFAULT_ACCENT, profile?.bgColor||CALM_DEFAULT_BG),[profile?.accentColor,profile?.bgColor]);
  const T=theme;
  const fmt=useCallback(n=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; return sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2}); },[profile?.currency]);
  const streams=profile?.incomeStreams||[];
  const saveProfile=p=>{ setProfile(p); lsSave("profile",p); };
  const saveArchive=arr=>{ setArchive(arr); lsSave("archive",arr); };
  const showToast=msg=>setToast(msg);
  const doReset=()=>{ lsClear(); window.location.reload(); };
  const doRestore=snap=>{ saveProfile(snap.profile||DEFAULT_PROFILE); lsSave("monthlyData",snap.monthlyData||{}); setMonthlyData(snap.monthlyData||{}); lsSave("excludeHistory",snap.excludeHistory||{}); setEh(snap.excludeHistory||{}); lsSave("catExcludeHistory",snap.catExcludeHistory||{}); setCh(snap.catExcludeHistory||{}); if(snap.insights){setInsights(snap.insights);lsSave("insights",snap.insights);} if(snap.archive){saveArchive(snap.archive);} setRestoreCandidate(null); showToast("✓ Backup restored"); window.location.reload(); };

  // Lifetime saved (across all months)
  const allTimeSaved=useMemo(()=>Object.entries(monthlyData).filter(([m])=>!profile?.startMonth||m>=profile.startMonth).reduce((total,[m,md])=>{
    const inc=totalIncome(streams,md.incomeOverrides||{},m);
    const spent=(md.txs||[]).reduce((s,t)=>s+t.amount,0);
    const fix=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
    return total+(inc-spent-fix);
  },0),[monthlyData,streams,profile]);

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
  const archiveTx=async id=>{
    const md0=monthlyData[selectedMonth]||{}; const tx=(md0.txs||[]).find(t=>t.id===id); if(!tx) return;
    saveArchive([{...tx,archivedAt:new Date().toISOString()},...archive].slice(0,500));
    await saveMD(selectedMonth,{txs:(md0.txs||[]).filter(t=>t.id!==id)});
    showToast("Moved to archive");
  };
  const editTx=async draft=>{
    const md0=monthlyData[selectedMonth]||{};
    await saveMD(selectedMonth,{txs:(md0.txs||[]).map(t=>t.id===draft.id?draft:t)});
    showToast("Updated");
  };
  const addManual=async({description,amount,category,date})=>{
    if(!description?.trim()||!amount||isNaN(+amount)||+amount<=0) return;
    const tx={id:Date.now()+Math.random(),date:date||todayStr(),description:description.trim(),category,amount:parseFloat(amount),source:"manual"};
    const month=monthKey(tx.date);
    if(profile?.startMonth&&month<profile.startMonth){ showToast("⚠ Before your start month"); return; }
    const ex=(monthlyData[month]||{}).txs||[];
    await saveMD(month,{txs:[tx,...ex]});
    showToast("Transaction added");
    if(month!==selectedMonth) setSelectedMonth(month);
    setSubScreen(null);
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

  const {mf,cf}=habitFlags(eh,ch);
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
          fixedDetected.push({id:`fd${nonce}${i}`,description:t.description||"Unknown",category:cat,rawAmount:Math.abs(amount),date:t.date||todayStr(),fullTx:{id:`${nonce}${i}f`,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:false,habitReason:null}});
          return null;
        }
        const reason=habitReason({description:(t.description||"").toLowerCase().trim(),category:cat},mf,cf);
        return {id:`${nonce}${i}`,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:!reason,habitReason:reason};
      }).filter(Boolean);
      setPendingTxs(p=>[...p,...imported]);
      if(fixedDetected.length>0) setFixedCommitDetected(fixedDetected);
      setUploadStep(4); setUploadTxCount(imported.length);
      const months=[...new Set(imported.map(t=>monthKey(t.date)))].sort();
      setUploadMsg(`✓ Found ${imported.length} transactions across ${months.length} month${months.length>1?"s":""}`);
      setTimeout(()=>{setSubScreen("review");},700);
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
  if(!profile.onboarded) return <ThemeCtx.Provider value={theme}><Onboarding onComplete={saveProfile}/></ThemeCtx.Provider>;

  // ── Compute current-month derived values for Home ──────────────────────────
  const md=monthlyData[selectedMonth]||{txs:[],incomeOverrides:{}};
  const ov=md.incomeOverrides||{};
  const incTotal=totalIncome(streams,ov,selectedMonth);
  const txs=md.txs||[];
  const varTotal=txs.reduce((s,t)=>s+t.amount,0);
  const monthFixed=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||selectedMonth>=c.startFrom)&&(!c.endMonth||selectedMonth<=c.endMonth));
  const fixedTotal=monthFixed.reduce((s,c)=>s+(+c.amount||0),0);
  const saved=incTotal-varTotal-fixedTotal;
  const savingsRate=incTotal>0?(saved/incTotal*100):0;
  const pm=prevMonth(selectedMonth);
  const pmd=monthlyData[pm]||{txs:[],incomeOverrides:{}};
  const prevOv=pmd.incomeOverrides||{};
  const prevVarTotal=(pmd.txs||[]).reduce((s,t)=>s+t.amount,0);
  const prevIncTotal=totalIncome(streams,prevOv,pm);
  const prevFixed=(pmd.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||pm>=c.startFrom)&&(!c.endMonth||pm<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const prevSaved=prevIncTotal-prevVarTotal-prevFixed;
  const savedDelta=saved-prevSaved;
  const byCat=(()=>{ const m={}; txs.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); })();
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
    const [draft,setDraft]=useState(amount===null||amount===undefined?"":String(amount));
    const [flash,setFlash]=useState(false);
    const isSaved=amount!==null&&amount!==undefined;
    useEffect(()=>{ setDraft(amount===null||amount===undefined?"":String(amount)); },[amount,stream.id,selectedMonth]);
    const dirty=isSaved?String(amount)!==String(parseFloat(draft)):draft.trim()!=="";
    const save=()=>{ const v=parseFloat(draft); if(draft===""||isNaN(v)||v<0) return; updateOv(stream.id,v); setFlash(true); setTimeout(()=>setFlash(false),1400); };
    const clear=()=>{ setDraft(""); clearOv(stream.id); };
    return <div style={{padding:"12px 0",borderBottom:`1px solid ${T.borderSoft}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:T.warning,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{stream.name}</div>
          <div style={{fontSize:10,color:T.warning,fontFamily:"'DM Mono'",fontWeight:600}}>VARIABLE{!isSaved?" · needs amount":""}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input type="number" inputMode="decimal" placeholder="Enter amount" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){save();e.target.blur();}}} style={{flex:1,padding:"9px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:13,outline:"none"}}/>
        <button onClick={save} disabled={!dirty} style={{padding:"9px 14px",background:flash?T.positive:dirty?T.accent:T.border,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:12,color:flash||dirty?"#fff":T.textMuted,cursor:dirty?"pointer":"default",whiteSpace:"nowrap",transition:"background .2s"}}>{flash?"✓":isSaved?"Update":"Save"}</button>
        {isSaved&&<button onClick={clear} style={{padding:"9px 12px",background:"transparent",border:`1px solid ${T.borderMid}`,borderRadius:10,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer"}}>×</button>}
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
    const [open,setOpen]=useState(false);
    const [name,setName]=useState(""); const [amt,setAmt]=useState("");
    const submit=()=>{ const v=parseFloat(amt); if(!name.trim()||isNaN(v)||v<=0) return; addOneoff(name.trim(),v); setName("");setAmt("");setOpen(false); };
    if(!open) return <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"12px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:12,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",marginTop:10}}>+ Add one-off income (bonus, refund, gift…)</button>;
    return <div style={{padding:"12px 0",borderTop:`1px solid ${T.borderSoft}`,display:"flex",flexDirection:"column",gap:8}}>
      <MicroLabel>Add one-off income</MicroLabel>
      <input placeholder="Name (e.g. Tax refund, Bonus)" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}} autoFocus/>
      <input type="number" inputMode="decimal" placeholder="Amount" value={amt} onChange={e=>setAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:13,outline:"none"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={submit} disabled={!name.trim()||!amt||parseFloat(amt)<=0} style={{flex:1,padding:"10px",background:name.trim()&&parseFloat(amt)>0?T.accent:T.border,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:13,color:name.trim()&&parseFloat(amt)>0?"#fff":T.textMuted,cursor:"pointer"}}>Add</button>
        <button onClick={()=>{setOpen(false);setName("");setAmt("");}} style={{padding:"10px 18px",background:"transparent",border:`1px solid ${T.borderMid}`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer"}}>Cancel</button>
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
    // Update habit memory for skipped
    if(skipped.length>0){
      const newEh={...eh};
      skipped.forEach(t=>{
        const k=t.description?.toLowerCase().trim();
        if(k){
          const ex=newEh[k]; const count=(typeof ex==="object"?ex.count:ex||0)+1;
          newEh[k]={count,lastTx:{description:t.description,date:t.date,amount:t.amount,category:t.category}};
        }
      });
      setEh(newEh); lsSave("excludeHistory",newEh);
      saveArchive([...skipped.map(t=>({...t,archivedAt:new Date().toISOString()})),...archive].slice(0,500));
    }
    setPendingTxs([]); setSubScreen(null);
    showToast(`✓ Saved ${checked.length} transaction${checked.length!==1?"s":""}${skipped.length>0?` · ${skipped.length} skipped`:""}`);
  };

  // ── REVIEW screen — Tinder-style swipe with undo ─────────────────────────
  const ReviewScreen=()=>{
    // Local state for swipe
    const [idx,setIdx]=useState(0);
    const [decisions,setDecisions]=useState([]); // [{id,kept}]
    const [drag,setDrag]=useState({x:0,active:false});
    const [exiting,setExiting]=useState(null); // {id,direction}
    const [undoToast,setUndoToast]=useState(null);
    const [keepAllConfirm,setKeepAllConfirm]=useState(false);
    const cardRef=useRef();
    const startX=useRef(0);
    const undoTimer=useRef(null);
    const COLS=getAllCatCols(profile.customCategories);

    const remaining=pendingTxs.filter(t=>!decisions.find(d=>d.id===t.id));
    const current=remaining[0];
    const next=remaining[1];
    const total=pendingTxs.length;
    const done=decisions.length;
    const allDone=done>=total;

    const decide=(kept)=>{
      if(!current||exiting) return;
      setExiting({id:current.id,direction:kept?"right":"left"});
      setTimeout(()=>{
        const newDecisions=[...decisions,{id:current.id,kept}];
        setDecisions(newDecisions);
        setExiting(null); setDrag({x:0,active:false});
        // Show undo toast
        clearTimeout(undoTimer.current);
        setUndoToast({tx:current,kept});
        undoTimer.current=setTimeout(()=>setUndoToast(null),5000);
      },220);
    };
    const undo=()=>{
      if(!undoToast) return;
      setDecisions(d=>d.filter(x=>x.id!==undoToast.tx.id));
      clearTimeout(undoTimer.current);
      setUndoToast(null);
    };
    const onTouchStart=e=>{ if(exiting) return; startX.current=e.touches?e.touches[0].clientX:e.clientX; setDrag({x:0,active:true}); };
    const onTouchMove=e=>{ if(!drag.active||exiting) return; const x=(e.touches?e.touches[0].clientX:e.clientX)-startX.current; setDrag({x,active:true}); };
    const onTouchEnd=()=>{
      if(!drag.active||exiting) return;
      const TH=80;
      if(drag.x>TH) decide(true);
      else if(drag.x<-TH) decide(false);
      else setDrag({x:0,active:false});
    };

    const finish=async()=>{
      // Build pendingTxs from decisions
      const updated=pendingTxs.map(t=>{ const d=decisions.find(x=>x.id===t.id); return {...t,checked:d?d.kept:true}; });
      setPendingTxs(updated);
      // Wait a tick then commit
      setTimeout(()=>commitTransactions(),50);
    };
    const keepAll=()=>{
      const updated=pendingTxs.map(t=>({...t,checked:true}));
      setPendingTxs(updated);
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
      const kept=decisions.filter(d=>d.kept).length;
      const skipped=decisions.length-kept;
      return <div style={{padding:"40px 18px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:14}}>🎉</div>
        <div style={{fontSize:24,fontWeight:800,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.5}}>All done!</div>
        <div style={{fontSize:14,color:T.textSecondary,marginBottom:24,lineHeight:1.6}}>You kept <span style={{fontWeight:700,color:T.accent}}>{kept}</span> and skipped <span style={{fontWeight:700,color:T.negative}}>{skipped}</span>.</div>
        <Btn onClick={finish} style={{maxWidth:280,margin:"0 auto"}}>Save these transactions</Btn>
        <button onClick={()=>{setDecisions([]);setIdx(0);}} style={{marginTop:14,background:"none",border:"none",color:T.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Start over</button>
      </div>;
    }

    if(keepAllConfirm){
      return <div style={{padding:"40px 18px",textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:14}}>📋</div>
        <div style={{fontSize:20,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Keep all {total - done}?</div>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:24,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>This skips review and saves everything. You can still edit or delete later.</div>
        <div style={{display:"flex",gap:10,maxWidth:280,margin:"0 auto"}}>
          <Btn variant="ghost" onClick={()=>setKeepAllConfirm(false)} size="sm">Cancel</Btn>
          <Btn onClick={keepAll} size="sm">Keep all</Btn>
        </div>
      </div>;
    }

    if(!current) return null;

    const rotation=drag.x*0.06;
    const tint=drag.x>0?T.accent:drag.x<0?T.negative:null;
    const tintOpacity=Math.min(0.18,Math.abs(drag.x)/250);
    const isCredit=current.amount<0;

    return <div style={{padding:"0 18px"}}>
      {/* Progress bar */}
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'",fontWeight:600}}>
          <span>{done} OF {total}</span>
          <button onClick={()=>setKeepAllConfirm(true)} style={{background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono'",fontWeight:600,padding:0}}>SKIP REVIEW →</button>
        </div>
        <div style={{height:4,background:T.borderSoft,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(done/total)*100}%`,background:T.accent,borderRadius:4,transition:"width .25s"}}/>
        </div>
      </div>

      {/* Card stack (current + next behind) */}
      <div style={{position:"relative",height:380,marginBottom:24}}>
        {next&&<div style={{position:"absolute",top:8,left:6,right:6,bottom:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:22,boxShadow:T.cardShadow,opacity:0.5,transform:"scale(0.96)"}}/>}
        <div ref={cardRef}
             onMouseDown={onTouchStart} onMouseMove={drag.active?onTouchMove:undefined} onMouseUp={onTouchEnd} onMouseLeave={drag.active?onTouchEnd:undefined}
             onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
             style={{position:"absolute",inset:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:22,padding:22,boxShadow:T.cardShadow,cursor:exiting?"default":"grab",transform:exiting?`translateX(${exiting.direction==="right"?500:-500}px) rotate(${exiting.direction==="right"?20:-20}deg)`:`translateX(${drag.x}px) rotate(${rotation}deg)`,transition:exiting?"transform .22s ease-out":drag.active?"none":"transform .2s",userSelect:"none",touchAction:"pan-y"}}>
          {/* Decision tint overlay */}
          {tint&&<div style={{position:"absolute",inset:0,background:tint,opacity:tintOpacity,borderRadius:22,pointerEvents:"none"}}/>}
          {/* KEEP / SKIP labels */}
          {drag.x>30&&<div style={{position:"absolute",top:24,left:24,padding:"6px 14px",border:`3px solid ${T.accent}`,borderRadius:8,color:T.accent,fontSize:18,fontWeight:800,transform:"rotate(-10deg)",letterSpacing:1}}>KEEP</div>}
          {drag.x<-30&&<div style={{position:"absolute",top:24,right:24,padding:"6px 14px",border:`3px solid ${T.negative}`,borderRadius:8,color:T.negative,fontSize:18,fontWeight:800,transform:"rotate(10deg)",letterSpacing:1}}>SKIP</div>}

          {/* Card content */}
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
            {current.habitReason&&<div style={{padding:"10px 14px",background:T.warning+"15",border:`1px solid ${T.warning}30`,borderRadius:12,marginTop:14,fontSize:11,color:T.warning,textAlign:"center",fontWeight:500}}>⚠ {current.habitReason}</div>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:14}}>
        <button onClick={()=>decide(false)} style={{width:64,height:64,borderRadius:32,background:T.surface,border:`2px solid ${T.negative}40`,color:T.negative,fontSize:28,cursor:"pointer",fontFamily:"inherit",boxShadow:T.cardShadow,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <select value={current.category} onChange={e=>{ setPendingTxs(p=>p.map(t=>t.id===current.id?{...t,category:e.target.value}:t)); }} style={{padding:"0 18px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:32,color:T.textSecondary,fontFamily:"inherit",fontSize:12,cursor:"pointer",outline:"none"}}>{[...CATS,...FIXED_CATS].map(c=><option key={c}>{c}</option>)}</select>
        <button onClick={()=>decide(true)} style={{width:64,height:64,borderRadius:32,background:T.accent,border:"none",color:"#fff",fontSize:30,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 18px ${T.accent}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>♥</button>
      </div>
      <div style={{textAlign:"center",fontSize:11,color:T.textMuted}}>Swipe right to keep · left to skip</div>

      {/* Undo toast */}
      {undoToast&&<div style={{position:"fixed",bottom:108,left:"50%",transform:"translateX(-50%)",background:T.textPrimary,color:T.surface,borderRadius:24,padding:"10px 14px 10px 22px",fontSize:13,zIndex:3000,display:"flex",alignItems:"center",gap:14,boxShadow:"0 12px 32px rgba(0,0,0,0.3)"}}>
        <span>{undoToast.kept?"✓ Kept":"✕ Skipped"} {undoToast.tx.description.slice(0,18)}{undoToast.tx.description.length>18?"…":""}</span>
        <button onClick={undo} style={{background:"none",border:"none",color:T.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",padding:"4px 8px"}}>UNDO</button>
      </div>}
    </div>;
  };
  const [youSection,setYouSection]=useState(null);
  const [pName,setPName]=useState(profile.name||"");
  const [pOcc,setPOcc]=useState(profile.occupation||"");
  const [pCurrency,setPCurrency]=useState(profile.currency||"SGD");
  const [pStartMonth,setPStartMonth]=useState(profile.startMonth||currentMonth());
  useEffect(()=>{ setPName(profile.name||""); setPOcc(profile.occupation||""); setPCurrency(profile.currency||"SGD"); setPStartMonth(profile.startMonth||currentMonth()); },[profile]);

  const avatarRef=useRef();
  const restoreFileRef=useRef();
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
    const saveIdentity=()=>{ saveProfile({...profile,name:pName.trim(),occupation:pOcc.trim(),currency:pCurrency,startMonth:pStartMonth}); showToast("✓ Profile updated"); setYouSection(null); };
    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
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

  const IncomeBillsSection=()=>{
    const [draft,setDraft]=useState(profile);
    useEffect(()=>setDraft(profile),[profile.incomeStreams,profile.fixedCommitments]);
    const updS=(id,field,val)=>setDraft(p=>({...p,incomeStreams:(p.incomeStreams||[]).map(s=>s.id===id?{...s,[field]:val}:s)}));
    const addS=()=>setDraft(p=>({...p,incomeStreams:[...(p.incomeStreams||[]),{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true,startFrom:""}]}));
    const rmS=id=>setDraft(p=>({...p,incomeStreams:(p.incomeStreams||[]).filter(s=>s.id!==id)}));
    const updF=(id,field,val)=>setDraft(p=>({...p,fixedCommitments:(p.fixedCommitments||[]).map(c=>c.id===id?{...c,[field]:val}:c)}));
    const addF=()=>setDraft(p=>({...p,fixedCommitments:[...(p.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:0,startFrom:"",endMonth:""}]}));
    const rmF=id=>setDraft(p=>({...p,fixedCommitments:(p.fixedCommitments||[]).filter(c=>c.id!==id)}));
    const save=()=>{ saveProfile({...draft,onboarded:true}); showToast("✓ Saved"); setYouSection(null); };
    const inpS={padding:"9px 11px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"};
    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
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

      <Btn onClick={save} size="sm">Save changes</Btn>
    </div>;
  };

  const GoalsSection=()=>{
    const [draft,setDraft]=useState(profile);
    useEffect(()=>setDraft(profile),[profile.goals]);
    const upd=(id,f,v)=>setDraft(p=>({...p,goals:(p.goals||[]).map(g=>g.id===id?{...g,[f]:v}:g)}));
    const add=()=>setDraft(p=>({...p,goals:[...(p.goals||[]),{id:`g${Date.now()}`,name:"",target:0,date:"",startingBalance:0}]}));
    const rm=id=>setDraft(p=>({...p,goals:(p.goals||[]).filter(g=>g.id!==id)}));
    const save=()=>{ saveProfile({...draft}); showToast("✓ Goals saved"); setYouSection(null); };
    const inpS={padding:"9px 11px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"};
    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
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
      <Btn onClick={save} size="sm">Save changes</Btn>
    </div>;
  };

  const ThemeSection=()=>{
    const change=(ac,bg)=>{ saveProfile({...profile,accentColor:ac,bgColor:bg}); showToast("Theme updated"); };
    const rp=p=>{ const active=p.accent===youAccent&&p.bg===youBg; return <div key={p.name} onClick={()=>change(p.accent,p.bg)} style={{borderRadius:14,overflow:"hidden",border:`2px solid ${active?T.accent:T.border}`,cursor:"pointer",transition:"border-color .15s"}}>
      <div style={{background:p.bg,padding:"14px"}}><div style={{width:18,height:18,borderRadius:"50%",background:p.accent,marginBottom:7}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.5,marginBottom:3}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.2,width:"55%"}}/></div>
      <div style={{background:isLight(p.bg)?mixHex(p.bg,"#000000",0.05):mixHex(p.bg,"#ffffff",0.05),padding:"6px 10px",fontSize:11,color:isLight(p.bg)?"#555":"#aaa",fontFamily:"'DM Mono'"}}>{p.name}</div>
    </div>; };
    return <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Light</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{LIGHT_PRESETS.map(rp)}</div>
      <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Dark</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{DARK_PRESETS.map(rp)}</div>
    </div>;
  };

  const AdvancedSection=()=>{
    const ab=lsLoad("autoBackups")||[];
    return <div style={{padding:"6px 0 14px",borderTop:`1px solid ${T.borderSoft}`}}>
      <SettingsRow icon="⬇" label="Export transactions as CSV" desc={`${txCount} transactions, ${moCount} months`} onClick={()=>txCount>0?exportCSV(monthlyData):showToast("No data to export")}/>
      <SettingsRow icon="💾" label="Download full backup (JSON)" desc="All data, settings, history" onClick={()=>{dlBackup(profile,monthlyData,eh,ch,insights,archive);showToast("Backup downloaded");}}/>
      <SettingsRow icon="↑" label="Restore from backup" desc="Load a previous JSON backup" onClick={()=>restoreFileRef.current.click()}/>
      <SettingsRow icon="🔐" label="Change / Remove PIN" desc="Reset PIN on next open" onClick={()=>{ lsSave("pinHash",null); setPinHash(null); setPinUnlocked(false); setPinSkipped(false); }}/>
      {ab.length>0&&<div style={{padding:"10px 16px",fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'",letterSpacing:0.5,borderTop:`1px solid ${T.borderSoft}`}}>{ab.length} AUTO-BACKUP{ab.length!==1?"S":""} AVAILABLE</div>}
      {ab.slice(0,3).map((snap,i)=>{
        const date=new Date(snap.createdAt);
        return <div key={i} style={{padding:"10px 16px",borderTop:`1px solid ${T.borderSoft}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:12,color:T.textPrimary,fontWeight:500}}>{date.toLocaleDateString("en-SG",{day:"numeric",month:"short"})} · {date.toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:10,color:T.textMuted}}>{countAllTx(snap.monthlyData||{})} transactions</div>
          </div>
          <button onClick={()=>setRestoreCandidate(snap)} style={{padding:"5px 12px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Restore</button>
        </div>;
      })}
      <div style={{padding:"14px 16px",borderTop:`1px solid ${T.borderSoft}`}}>
        <button onClick={()=>setShowReset(true)} style={{width:"100%",padding:"12px",background:"transparent",border:`1px solid ${T.negative}40`,borderRadius:12,color:T.negative,fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>Reset everything & start again</button>
      </div>
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
        {youSection==="identity"&&<IdentitySection/>}
        <SettingsRow icon="💰" label="Income & Bills" desc={`${(profile.incomeStreams||[]).length} sources · ${(profile.fixedCommitments||[]).length} bills`} onClick={()=>setYouSection(youSection==="incomebills"?null:"incomebills")}/>
        {youSection==="incomebills"&&<IncomeBillsSection/>}
        <SettingsRow icon="🎯" label="Goals" desc={(profile.goals||[]).length>0?`${(profile.goals||[]).length} active`:"No goals set yet"} onClick={()=>setYouSection(youSection==="goals"?null:"goals")}/>
        {youSection==="goals"&&<GoalsSection/>}
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <SettingsRow icon="🎨" label="Theme" desc={`${LIGHT_PRESETS.concat(DARK_PRESETS).find(p=>p.accent===youAccent&&p.bg===youBg)?.name||"Custom"}`} onClick={()=>setYouSection(youSection==="theme"?null:"theme")}/>
        {youSection==="theme"&&<ThemeSection/>}
      </SettingsGroup>

      <SettingsGroup title="Privacy & Data">
        <SettingsRow icon="🔒" label="Privacy policy" desc="What we do (and don't) with your data" onClick={()=>setShowPrivacy(true)}/>
        <SettingsRow icon="ℹ" label="About this app" desc="Version & landing page" onClick={()=>{window.location.href="/landing";}}/>
        <SettingsRow icon="⚙" label="Advanced — backup, restore, reset" desc={`${txCount} transactions stored locally`} onClick={()=>setYouSection(youSection==="advanced"?null:"advanced")}/>
        {youSection==="advanced"&&<AdvancedSection/>}
      </SettingsGroup>

      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:18,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
        <PrivacyLock col={T.textMuted}/>v{APP_VERSION} · all data on this device
      </div>
    </div>;
  };

  // ── FORECAST detail screen ───────────────────────────────────────────────
  const ForecastScreen=()=>{
    if(!isCurMonth||incTotal===0||dayOfMonth<=5){
      return <div style={{padding:"24px 18px",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:14}}>📈</div>
        <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,marginBottom:8,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Forecast not ready yet</div>
        <div style={{fontSize:13,color:T.textSecondary,maxWidth:300,margin:"0 auto",lineHeight:1.6}}>{!isCurMonth?"Forecast only works for the current month. Select this month to see projections.":incTotal===0?"Set up your income in You first.":"Add at least 5 days of transactions to get a useful projection."}</div>
      </div>;
    }
    const dailyAvg=varTotal/dayOfMonth;
    const remainingDays=daysInMonth-dayOfMonth;
    const chartH=120; const chartW=300;
    const dailyBudget=incTotal-fixedTotal>0?(incTotal-fixedTotal)/daysInMonth:0;
    const projByCat=byCat.slice(0,4).map(([cat,amt])=>({cat,actual:Math.abs(amt),projected:Math.abs(amt)*(daysInMonth/dayOfMonth)}));

    return <div>
      <div style={{textAlign:"center",marginBottom:22}}>
        <MicroLabel style={{marginBottom:8}}>YOU'LL LIKELY SAVE</MicroLabel>
        <div style={{fontSize:48,fontWeight:700,color:projectedSaved>=0?T.accent:T.negative,letterSpacing:-1.5,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>{fmt(projectedSaved)}</div>
        <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>by end of {monthLabel(selectedMonth)}{prevSaved!==0?` — ${projectedSaved>=prevSaved?"better":"less"} than last month`:""}</div>
      </div>

      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:T.cardShadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:T.textPrimary}}>Spending pace</div>
          <div style={{fontSize:11,color:T.textMuted}}>Day {dayOfMonth} of {daysInMonth}</div>
        </div>
        <svg width="100%" height={chartH+30} viewBox={`0 0 ${chartW} ${chartH+30}`} preserveAspectRatio="none">
          {dailyBudget>0&&(()=>{const maxV=Math.max(varTotal,projected,dailyBudget*daysInMonth,1);const y=chartH-(dailyBudget*daysInMonth/maxV)*(chartH-10);return <line x1="0" y1={y} x2={chartW} y2={y} stroke={T.warning} strokeWidth="1.5" strokeDasharray="3,3"/>;})()}
          {(()=>{
            const maxV=Math.max(varTotal,projected,dailyBudget*daysInMonth,1);
            const todayX=(dayOfMonth/daysInMonth)*chartW;
            const todayY=chartH-(varTotal/maxV)*(chartH-10);
            const projY=chartH-(projected/maxV)*(chartH-10);
            return <>
              <line x1="0" y1={chartH} x2={todayX} y2={todayY} stroke={T.accent} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1={todayX} y1={todayY} x2={chartW} y2={projY} stroke={T.accent} strokeWidth="2" strokeDasharray="4,4" strokeLinecap="round" opacity="0.5"/>
              <circle cx={todayX} cy={todayY} r="4" fill={T.accent}/>
            </>;
          })()}
          <text x="2" y={chartH+18} fill={T.textMuted} fontSize="9" fontFamily="DM Mono">Day 1</text>
          <text x={chartW-32} y={chartH+18} fill={T.textMuted} fontSize="9" fontFamily="DM Mono" textAnchor="start">Day {daysInMonth}</text>
        </svg>
        <div style={{display:"flex",gap:14,fontSize:10,color:T.textMuted,marginTop:6,flexWrap:"wrap"}}>
          <span><span style={{display:"inline-block",width:10,height:2,background:T.accent,verticalAlign:"middle",marginRight:4}}/> Actual</span>
          <span><span style={{display:"inline-block",width:10,height:2,background:T.accent,opacity:0.5,verticalAlign:"middle",marginRight:4}}/> Projected</span>
          {dailyBudget>0&&<span><span style={{display:"inline-block",width:10,height:2,background:T.warning,verticalAlign:"middle",marginRight:4}}/> Budget cap</span>}
        </div>
        <div style={{marginTop:12,padding:"10px 12px",background:T.surface2,borderRadius:10,fontSize:11,color:T.textSecondary,lineHeight:1.5}}>
          <span style={{color:T.textMuted,fontWeight:600}}>Why we think this:</span> You've spent {fmt(varTotal)} in {dayOfMonth} days (avg {fmt(dailyAvg)}/day). At this pace you'll hit {fmt(projected)} by month-end. Your actual landing could be ±{fmt(projected*0.1)} depending on the next {remainingDays} days.
        </div>
      </div>

      {projByCat.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:T.cardShadow}}>
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
      </div>}

      {projByCat[0]&&<div style={{background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:18,padding:"14px 16px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:6}}>💡 What if?</div>
        <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.55}}>
          Your top spend is <span style={{fontWeight:700,color:T.textPrimary}}>{projByCat[0].cat}</span>. If you shave 20% off that for the rest of the month, you'd save an extra <span style={{fontWeight:700,color:T.accent}}>{fmt(projByCat[0].projected*0.2*(remainingDays/daysInMonth))}</span>.
        </div>
      </div>}
    </div>;
  };

  const MoneyContent=()=><div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
    {/* Header */}
    <div style={{padding:"12px 0 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{fontSize:24,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Money</div>
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
    </div>

    {/* Donut */}
    {byCat.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:18,marginBottom:12,display:"flex",alignItems:"center",gap:16,boxShadow:T.cardShadow}}>
      <DonutChart/>
      <div style={{flex:1,fontSize:11,minWidth:0}}>
        {byCat.slice(0,5).map(([cat,amt],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
          <div style={{width:8,height:8,borderRadius:4,background:COLS[cat]||T.accent,flexShrink:0}}/>
          <span style={{color:T.textSecondary,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.split(" ").slice(1).join(" ")||cat}</span>
          <span style={{fontFamily:"'DM Mono'",fontWeight:600,color:T.textPrimary,flexShrink:0}}>{fmt(Math.abs(amt))}</span>
        </div>)}
      </div>
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
      <AddOneoffForm/>
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

    {/* Subscriptions teaser */}
    {detectedSubscriptions.length>0&&<button onClick={()=>setSubScreen("subscriptions")} style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",marginBottom:12,boxShadow:T.cardShadow,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>📱 Subscriptions</div>
        <span style={{fontSize:14,color:T.textMuted}}>›</span>
      </div>
      <div style={{fontSize:24,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif",letterSpacing:-0.5}}>{fmt(detectedSubscriptions.reduce((s,x)=>s+x.amount,0))}<span style={{fontSize:13,color:T.textMuted,fontWeight:500,marginLeft:6}}>/month</span></div>
      <div style={{fontSize:11,color:T.textSecondary,marginTop:4}}>{detectedSubscriptions.length} active · ~{fmt(detectedSubscriptions.reduce((s,x)=>s+x.amount,0)*12)}/yr</div>
    </button>}

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
      {filteredTxs.slice(0,30).map((t,i)=><div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderTop:i?`1px solid ${T.borderSoft}`:`1px solid ${T.borderSoft}`}}>
        <div style={{width:32,height:32,borderRadius:10,background:(COLS[t.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{t.category?.split(" ")[0]||"📦"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:T.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.description}</div>
          <div style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date}</div>
        </div>
        <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:t.amount<0?T.positive:T.textPrimary}}>{t.amount<0?"-":""}{fmt(Math.abs(t.amount))}</div>
        <button onClick={()=>archiveTx(t.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>×</button>
      </div>)}
      {filteredTxs.length>30&&<div style={{padding:"12px 18px",fontSize:11,color:T.textMuted,textAlign:"center"}}>Showing first 30 of {filteredTxs.length}</div>}
    </div>}

    {/* Empty state */}
    {txs.length===0&&incomeRows.length===0&&<div onClick={()=>setSubScreen("upload")} style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:18,padding:"32px 20px",textAlign:"center",cursor:"pointer"}}>
      <div style={{fontSize:32,marginBottom:10}}>📄</div>
      <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:4}}>Nothing here yet</div>
      <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>Tap + below to upload your first bank statement,<br/>or set up income in <span onClick={(e)=>{e.stopPropagation();setTab("you");}} style={{color:T.accent,fontWeight:700}}>You</span></div>
    </div>}
  </div>;
  const HomeContent=()=><div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
    {/* Top — APRIL 2026, Hey Alex, avatar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 22px"}}>
      <div>
        <div style={{fontSize:11,color:T.textMuted,fontWeight:500,letterSpacing:0.3,marginBottom:2}}>{monthLabelUpper(selectedMonth)}</div>
        <div style={{fontSize:16,fontWeight:600,color:T.textPrimary}}>Hey, {firstName}</div>
      </div>
      <div onClick={()=>setTab("you")} style={{cursor:"pointer",flexShrink:0}}>
        {profile.avatar
          ?<img src={profile.avatar} alt="" style={{width:38,height:38,borderRadius:19,objectFit:"cover"}}/>
          :<div style={{width:38,height:38,borderRadius:19,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.accent}}>{firstName[0]?.toUpperCase()||"?"}</div>}
      </div>
    </div>

    {/* HERO */}
    <div style={{marginBottom:26}}>
      {incTotal>0?<>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>{saved>=0?"You've kept":"You're over by"}</div>
        <div style={{fontSize:56,fontWeight:700,color:T.textPrimary,letterSpacing:-2,lineHeight:1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
          {(()=>{ const abs=Math.abs(saved); const cents=(abs-Math.floor(abs)).toFixed(2).slice(1); return <><CountUp value={Math.floor(abs)} duration={900} format={n=>sym+Math.floor(n).toLocaleString("en-SG")}/><span style={{fontSize:28,color:T.textMuted,fontWeight:500}}>{cents}</span></>; })()}
        </div>
        <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>
          {saved>=0
            ?<>That's <span style={{color:T.accent,fontWeight:700}}>{savingsRate.toFixed(0)}% saved</span> this month{prevSaved!==0&&savedDelta!==0?` — ${savedDelta>=0?"better":"less"} than last month`:""}{prevSaved>0&&savedDelta>0?" 🎉":""}</>
            :<>Spending exceeded income by <span style={{color:T.negative,fontWeight:700}}>{fmt(Math.abs(saved))}</span></>}
        </div>
      </>:<>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>Welcome to {monthLabel(selectedMonth)}</div>
        <div style={{fontSize:32,fontWeight:700,color:T.textPrimary,letterSpacing:-1,lineHeight:1.1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Let's get you set up</div>
        <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>Add your income sources in <span onClick={()=>setTab("you")} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>You</span> to see your full picture.</div>
      </>}
    </div>

    {/* WHERE IT WENT */}
    {(fixedTotal>0||varTotal>0||Math.max(0,saved)>0)&&<div style={{marginBottom:22}}>
      <MicroLabel style={{marginBottom:10}}>WHERE IT WENT</MicroLabel>
      <div style={{display:"flex",height:14,borderRadius:7,overflow:"hidden",marginBottom:12,gap:2,background:T.surface2}}>
        {billsFlex>0&&<div style={{flex:billsFlex,background:T.bills}}/>}
        {spentFlex>0&&<div style={{flex:spentFlex,background:T.spent}}/>}
        {savedFlex>0&&<div style={{flex:savedFlex,background:T.accent}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
        <div>
          <div style={{display:"inline-block",width:8,height:8,borderRadius:4,background:T.bills,marginRight:6,verticalAlign:"middle"}}/><span style={{color:T.textSecondary}}>Bills</span>
          <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:T.textPrimary,marginTop:2}}>{fmt(fixedTotal)}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{display:"inline-block",width:8,height:8,borderRadius:4,background:T.spent,marginRight:6,verticalAlign:"middle"}}/><span style={{color:T.textSecondary}}>Spent</span>
          <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:T.textPrimary,marginTop:2}}>{fmt(varTotal)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{display:"inline-block",width:8,height:8,borderRadius:4,background:saved>=0?T.accent:T.negative,marginRight:6,verticalAlign:"middle"}}/><span style={{color:T.textSecondary}}>Saved</span>
          <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:saved>=0?T.accent:T.negative,marginTop:2}}>{fmt(saved)}</div>
        </div>
      </div>
    </div>}

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

    {/* Review nudge */}
    {pendingTxs.length>0&&<button onClick={()=>setSubScreen("review")} style={{width:"100%",background:T.warning+"10",border:`1px solid ${T.warning}30`,borderRadius:18,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <div style={{width:32,height:32,borderRadius:16,background:T.warning+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📋</div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{pendingTxs.length} new transaction{pendingTxs.length!==1?"s":""} to check</div>
          <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>From your latest import</div>
        </div>
      </div>
      <span style={{fontSize:16,color:T.warning}}>→</span>
    </button>}

    {/* Variable income waiting */}
    {pendingVarStreams(streams,ov,selectedMonth).length>0&&<button onClick={()=>setTab("money")} style={{width:"100%",background:T.info+"10",border:`1px solid ${T.info}30`,borderRadius:18,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <div style={{width:32,height:32,borderRadius:16,background:T.info+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💰</div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{pendingVarStreams(streams,ov,selectedMonth).length} variable income to enter</div>
          <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>Tap to enter in Money</div>
        </div>
      </div>
      <span style={{fontSize:16,color:T.info}}>→</span>
    </button>}

    {/* Top spending */}
    {byCat.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:16,marginBottom:12,boxShadow:T.cardShadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Top spending</div>
        <span style={{fontSize:11,color:T.textMuted}}>This month</span>
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
    </div>}

    {/* Empty state */}
    {byCat.length===0&&<div onClick={()=>setSubScreen("upload")} style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:18,padding:"28px 20px",textAlign:"center",cursor:"pointer",marginBottom:12}}>
      <div style={{fontSize:32,marginBottom:10}}>📄</div>
      <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:4}}>No transactions yet</div>
      <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>Tap the + button below to upload<br/>your first bank statement</div>
    </div>}

    {/* Month picker */}
    <div style={{marginTop:18,display:"flex",justifyContent:"center"}}>
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
    </div>

    {/* Privacy badge */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:18,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
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
    const [manualOpen,setManualOpen]=useState(false);
    const [mDesc,setMDesc]=useState(""); const [mAmt,setMAmt]=useState(""); const [mCat,setMCat]=useState(CATS[0]||"📦 Other"); const [mDate,setMDate]=useState(todayStr());
    const submitManual=()=>{ addManual({description:mDesc,amount:mAmt,category:mCat,date:mDate}); };

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
          <MicroLabel style={{marginBottom:10}}>{uploadStep===4?"All done — opening review":uploadStep===3?"Organising transactions":uploadStep===2?"Claude is reading":"Reading file"}</MicroLabel>
          {STEPS.map(s=>{
            const done=uploadStep>s.id; const active=uploadStep===s.id;
            return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <span style={{fontSize:14,width:20,display:"flex",justifyContent:"center"}}>{done?"✅":active?<span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⏳</span>:"⏳"}</span>
              <span style={{fontSize:13,color:done?T.textMuted:active?T.textPrimary:T.textMuted,fontWeight:active?600:400,opacity:uploadStep<s.id?0.5:1}}>{s.label}</span>
            </div>;
          })}
          {uploadMsg&&uploadMsg.startsWith("⚠")&&<div style={{marginTop:14,fontSize:12,color:T.negative}}>{uploadMsg}</div>}
          <style>{`@keyframes pulsebar{0%,100%{opacity:.4}50%{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>}

      <input ref={fileRef} type="file" accept=".pdf,.csv,application/pdf,text/csv" style={{display:"none"}} onChange={handleFile}/>
      <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

      {/* Manual add — secondary */}
      {!uploading&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"16px 18px",boxShadow:T.cardShadow}}>
        <button onClick={()=>setManualOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:"inherit",padding:0,color:T.textPrimary}}>
          <div style={{fontSize:13,fontWeight:600}}>Or add a transaction manually</div>
          <span style={{fontSize:14,color:T.textMuted}}>{manualOpen?"▲":"▼"}</span>
        </button>
        {manualOpen&&<div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <input type="text" placeholder="Description" value={mDesc} onChange={e=>setMDesc(e.target.value)} style={{gridColumn:"1/-1",padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
          <input type="number" placeholder="Amount" value={mAmt} onChange={e=>setMAmt(e.target.value)} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:13,outline:"none"}}/>
          <input type="date" value={mDate} onChange={e=>setMDate(e.target.value)} style={{padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
          <select value={mCat} onChange={e=>setMCat(e.target.value)} style={{gridColumn:"1/-1",padding:"10px 12px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none"}}>{[...CATS,...FIXED_CATS].map(c=><option key={c}>{c}</option>)}</select>
          <Btn onClick={submitManual} style={{gridColumn:"1/-1"}} size="sm">Add transaction</Btn>
        </div>}
      </div>}

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
  return <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&family=Bricolage+Grotesque:wght@600;700;800&display=swap" rel="stylesheet"/>

      {/* Global overlays */}
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {showPrivacy&&<PrivacyModal onClose={()=>setShowPrivacy(false)}/>}
      {restoreCandidate&&<RestoreModal backup={restoreCandidate} onConfirm={()=>doRestore(restoreCandidate)} onClose={()=>setRestoreCandidate(null)}/>}
      {showReset&&<ResetModal onConfirm={doReset} onClose={()=>setShowReset(false)} onDownloadFirst={()=>{dlBackup(profile,monthlyData,eh,ch,insights,archive);showToast("Backup downloaded");}}/>}

      {/* Sub-screen overlays */}
      {subScreen&&<div style={{position:"fixed",inset:0,background:T.bg,zIndex:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{maxWidth:580,margin:"0 auto",padding:"8px 18px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 0 18px"}}>
            <button onClick={()=>setSubScreen(null)} style={{background:"none",border:"none",fontSize:24,color:T.textSecondary,cursor:"pointer",padding:"4px 8px",fontFamily:"inherit"}}>‹</button>
            <div style={{fontSize:18,fontWeight:700,color:T.textPrimary,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
              {subScreen==="upload"?"Add transactions":subScreen==="review"?"Quick review":subScreen==="forecast"?"Forecast":subScreen==="subscriptions"?"Subscriptions":""}
            </div>
          </div>
          {subScreen==="upload"&&<UploadScreen/>}
          {subScreen==="subscriptions"&&<SubscriptionsScreen/>}
          {subScreen==="forecast"&&<ForecastScreen/>}
          {subScreen==="review"&&<ReviewScreen/>}
        </div>
      </div>}

      {/* Bills/Recurring detection modals */}
      {fixedCommitDetected&&<FixedCommitModal detected={fixedCommitDetected} fmt={fmt} onConfirm={handleFixedCommitConfirm} onSkip={()=>{
        const toReview=(fixedCommitDetected||[]).filter(c=>c.fullTx).map(c=>c.fullTx);
        if(toReview.length>0) setPendingTxs(p=>[...p,...toReview]);
        setFixedCommitDetected(null);
      }}/>}
      {recurringDetected&&<RecurringModal suggestions={recurringDetected} onConfirm={handleRecurringConfirm} onDismiss={()=>setRecurringDetected(null)}/>}

      {/* Main content */}
      <div style={{maxWidth:580,margin:"0 auto",paddingBottom:96}}>
        {tab==="home"&&<HomeContent/>}
        {tab==="money"&&<MoneyContent/>}
        {tab==="you"&&<YouContent/>}
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
        <button onClick={()=>setSubScreen("upload")} style={{position:"absolute",right:18,top:-26,width:56,height:56,borderRadius:28,background:T.accent,border:`4px solid ${T.bg}`,color:"#fff",fontSize:28,fontWeight:300,cursor:"pointer",boxShadow:`0 6px 20px ${T.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,paddingBottom:4,fontFamily:"inherit"}}>+</button>
      </div>
    </div>
  </ThemeCtx.Provider>;
}
