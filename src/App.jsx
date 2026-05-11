// ════════════════════════════════════════════════════════════════════════════
// $how Me The Money — Calm rebuild · Phase 1
// 3-tab structure (Home · Money · You) with floating + button
// All existing logic preserved (parser, storage, PIN, backups, recurring, etc.)
// ════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { PrivacyModal } from "./Landing.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = ["🍔 Food & Dining","🛒 Groceries","🚗 Transport","🎬 Entertainment","🏥 Health","👕 Shopping","💡 Utilities","✈️ Travel","📦 Other"];
const FIXED_CATS = ["🏠 Rent/Mortgage","💳 Insurance","🏦 Loan Repayment","📱 Subscription","🔒 Investment","💰 Savings Transfer"];
// Softer Calm category palette
const CAT_COLORS = {"🍔 Food & Dining":"#E8806B","🛒 Groceries":"#6BA368","🚗 Transport":"#5B8FCB","🎬 Entertainment":"#A87BC9","🏥 Health":"#E89656","👕 Shopping":"#D67BA0","💡 Utilities":"#D4A93C","✈️ Travel":"#5BB5A8","📦 Other":"#8B8B96","🏠 Rent/Mortgage":"#5B8FCB","💳 Insurance":"#E8806B","🏦 Loan Repayment":"#D4A93C","📱 Subscription":"#A87BC9","🔒 Investment":"#6BA368","💰 Savings Transfer":"#5BB5A8"};
const CURRENCIES = ["SGD","USD","MYR","AUD","GBP","EUR","JPY","HKD","THB","IDR"];
const CURRENCY_SYMBOLS = {"SGD":"S$","USD":"$","MYR":"RM","AUD":"A$","GBP":"£","EUR":"€","JPY":"¥","HKD":"HK$","THB":"฿","IDR":"Rp"};

const MAX_AUTO_BACKUPS = 7;
const APP_VERSION = "4.0";
const SIDEBAR_W = 260;

// ── Calm theme presets ─────────────────────────────────────────────────────
const LIGHT_PRESETS = [
  {name:"Calm",   accent:"#1A7A40", bg:"#F6F3EC"},  // green on cream — DEFAULT
  {name:"Indigo", accent:"#5C5FEF", bg:"#F7F4ED"},  // indigo on cream
  {name:"Mist",   accent:"#3D7B8C", bg:"#F2F4F5"},  // teal on fog
  {name:"Linen",  accent:"#9C5A3C", bg:"#FAF5EE"},  // terracotta on linen
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
const greeting = () => { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };
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
  const accentText=isLight(accent)?"#FFFFFF":"#FFFFFF";
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

// ── Category helpers ──────────────────────────────────────────────────────────
function getAllCats(cc=[]){ return [...BUILTIN_CATEGORIES,...(cc||[]).map(c=>`${c.emoji} ${c.name}`)]; }
function getAllCatCols(cc=[]){ const x={}; (cc||[]).forEach(c=>{x[`${c.emoji} ${c.name}`]=c.color||"#868E96";}); return {...CAT_COLORS,...x}; }
function isFixedCat(cat){ return FIXED_CATS.includes(cat); }

// ── Income helpers ────────────────────────────────────────────────────────────
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
  for(const [k,v] of Object.entries(eh||{})){
    const count=typeof v==="object"?v.count:v;
    if(count>=HABIT_THRESHOLD) mf[k]=v;
  }
  for(const [k,v] of Object.entries(ch||{})) if(v>=HABIT_THRESHOLD) cf[k]=v;
  return {mf,cf};
}
function habitReason(tx,mf,cf){
  const k=tx.description?.toLowerCase().trim();
  if(mf[k]) return `excluded before`;
  if(cf[tx.category]) return `category excluded before`;
  return null;
}

// ── CSV chunker ───────────────────────────────────────────────────────────────
function splitCSV(text,size=15000){
  const lines=text.split("\n"); const hdr=lines[0]; const rows=lines.slice(1).filter(l=>l.trim());
  const chunks=[]; let cur=[hdr];
  for(const line of rows){ cur.push(line); if(cur.join("\n").length>size){chunks.push(cur.join("\n"));cur=[hdr];} }
  if(cur.length>1) chunks.push(cur.join("\n"));
  return chunks.length?chunks:[text];
}

// ── Export / backup ───────────────────────────────────────────────────────────
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

// ── Shared UI components ──────────────────────────────────────────────────────
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
function Check({checked,onChange}){ const T=useTheme(); return <div onClick={onChange} style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${checked?T.accent:T.borderMid}`,background:checked?T.accentSoft:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>{checked&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>; }
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

function EditableAmt({value,onSave,fmt,color}){
  const T=useTheme(); const [ed,setEd]=useState(false); const [draft,setDraft]=useState("");
  if(ed) return <input type="number" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus style={{width:110,padding:"5px 10px",background:T.surface,border:`1px solid ${T.accent}`,borderRadius:8,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:14,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter"){onSave(parseFloat(draft)||0);setEd(false);}if(e.key==="Escape")setEd(false);}} onBlur={()=>{onSave(parseFloat(draft)||0);setEd(false);}}/>;
  return <div onClick={()=>{setDraft(Math.abs(value).toString());setEd(true);}} style={{fontFamily:"'DM Mono'",fontSize:14,color:color||T.textPrimary,cursor:"pointer",borderBottom:`1px dashed ${T.borderMid}`,paddingBottom:1,fontWeight:600}}>{fmt(value)}</div>;
}

// Theme preset picker (used in You tab settings)
function ThemePresets({accentColor,bgColor,onChange}){
  const T=useTheme();
  const rp=p=>{ const active=p.accent===accentColor&&p.bg===bgColor; return <div key={p.name} onClick={()=>onChange(p.accent,p.bg)} style={{borderRadius:14,overflow:"hidden",border:`2px solid ${active?T.accent:T.border}`,cursor:"pointer",transition:"border-color .15s"}}>
    <div style={{background:p.bg,padding:"14px"}}><div style={{width:18,height:18,borderRadius:"50%",background:p.accent,marginBottom:7}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.5,marginBottom:3}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.2,width:"55%"}}/></div>
    <div style={{background:isLight(p.bg)?mixHex(p.bg,"#000000",0.05):mixHex(p.bg,"#ffffff",0.05),padding:"6px 10px",fontSize:11,color:isLight(p.bg)?"#555":"#aaa",fontFamily:"'DM Mono'"}}>{p.name}</div>
  </div>; };
  return <div>
    <MicroLabel style={{marginBottom:8}}>LIGHT</MicroLabel>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>{LIGHT_PRESETS.map(rp)}</div>
    <MicroLabel style={{marginBottom:8}}>DARK</MicroLabel>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{DARK_PRESETS.map(rp)}</div>
  </div>;
}

// MonthPicker — pill button + dropdown
function MonthPicker({value,onChange,startMonth}){
  const T=useTheme(); const inp=useInp(); const [open,setOpen]=useState(false); const [typed,setTyped]=useState(value);
  const btnRef=useRef(); const dropRef=useRef(); const [pos,setPos]=useState({top:0,left:0,right:"auto"});
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
  const shortLabel=monthLabelShort(value);
  return <div style={{position:"relative",display:"inline-block"}}>
    <button ref={btnRef} onClick={()=>setOpen(o=>!o)} style={{padding:"8px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,color:T.textSecondary,fontFamily:"'DM Mono'",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontWeight:600}}>{shortLabel} ▾</button>
    {open&&<><div style={{position:"fixed",inset:0,zIndex:299}} onClick={()=>setOpen(false)}/>
      <div ref={dropRef} style={{position:"fixed",top:pos.top,left:pos.left,right:pos.right,background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,zIndex:300,maxHeight:300,overflowY:"auto",minWidth:240,boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"10px"}}><input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&/^\d{4}-\d{2}$/.test(typed)&&(!startMonth||typed>=startMonth)){onChange(typed);setOpen(false);}}} placeholder="YYYY-MM" style={{...inp,fontSize:13,padding:"9px 12px"}}/></div>
        {months.map(m=><div key={m} onClick={()=>{onChange(m);setOpen(false);}} style={{padding:"10px 18px",fontSize:13,color:m===value?T.accent:T.textSecondary,cursor:"pointer",fontFamily:"'DM Mono'",background:m===value?T.accentSoft:"transparent"}}>{monthLabel(m)}</div>)}
      </div></>}
  </div>;
}

// ── SVG tab icons (replaces emoji) ──────────────────────────────────────────
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

// ── Modals (Overlay + ModalCard) ──────────────────────────────────────────────
function Overlay({children,onClose,zIndex=700}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:24,overflowY:"auto"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",display:"flex"}}>{children}</div>
  </div>;
}
function ModalCard({children,maxWidth=380}){ const T=useTheme(); return <div style={{background:T.surface,borderRadius:24,padding:24,width:"100%",maxWidth,maxHeight:"calc(100vh - 48px)",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.25)",WebkitOverflowScrolling:"touch"}}>{children}</div>; }

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

// ── HOME tab content (Calm prototype) ─────────────────────────────────────────
function HomeContent({profile,selectedMonth,setSelectedMonth,monthlyData,streams,fmt,setTab,setSubScreen,pendingTxs,T,onUploadClick}){
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

  const byCat=useMemo(()=>{ const m={}; txs.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); },[txs]);
  const COLS=getAllCatCols(profile.customCategories);

  const totalBar=Math.max(1,fixedTotal+varTotal+Math.max(0,saved));
  const billsFlex=fixedTotal/totalBar;
  const spentFlex=varTotal/totalBar;
  const savedFlex=Math.max(0,saved)/totalBar;

  // Forecast estimate
  const today=new Date();
  const isCurMonth=monthKey(today.toISOString())===selectedMonth;
  const dayOfMonth=isCurMonth?today.getDate():30;
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const projected=isCurMonth&&dayOfMonth>5?Math.round(varTotal*(daysInMonth/dayOfMonth)):varTotal;
  const projectedSaved=incTotal-fixedTotal-projected;

  const firstName=(profile.name||"there").split(" ")[0];

  return <div style={{padding:"8px 18px 24px",color:T.textPrimary}}>
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

    {/* HERO — the big answer */}
    <div style={{marginBottom:26}}>
      {incTotal>0?<>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>{saved>=0?"You've kept":"You're over by"}</div>
        <div style={{fontSize:56,fontWeight:700,color:T.textPrimary,letterSpacing:-2,lineHeight:1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>
          {(()=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; const abs=Math.abs(saved); const whole=Math.floor(abs).toLocaleString("en-SG"); const cents=(abs-Math.floor(abs)).toFixed(2).slice(1); return <><CountUp value={Math.floor(abs)} duration={900} format={n=>sym+Math.floor(n).toLocaleString("en-SG")}/><span style={{fontSize:28,color:T.textMuted,fontWeight:500}}>{cents}</span></>; })()}
        </div>
        <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>
          {saved>=0
            ?<>That's <span style={{color:T.accent,fontWeight:700}}>{savingsRate.toFixed(0)}% saved</span> this month{prevSaved>0&&savedDelta!==0?` — ${savedDelta>=0?"better":"less"} than last month`:""}{prevSaved>0&&savedDelta>0?" 🎉":""}</>
            :<>Spending exceeded income by <span style={{color:T.negative,fontWeight:700}}>{fmt(Math.abs(saved))}</span></>}
        </div>
      </>:<>
        <div style={{fontSize:13,color:T.textSecondary,marginBottom:6,fontWeight:500}}>Welcome to {monthLabel(selectedMonth)}</div>
        <div style={{fontSize:36,fontWeight:700,color:T.textPrimary,letterSpacing:-1,lineHeight:1.1,fontFamily:"'Bricolage Grotesque','DM Sans',sans-serif"}}>Let's get you set up</div>
        <div style={{fontSize:14,color:T.textSecondary,marginTop:8,lineHeight:1.5}}>Add your income sources in <span onClick={()=>setTab("you")} style={{color:T.accent,fontWeight:700,cursor:"pointer"}}>You</span> to see your full picture.</div>
      </>}
    </div>

    {/* WHERE IT WENT — stacked bar */}
    {(fixedTotal>0||varTotal>0||saved>0)&&<div style={{marginBottom:22}}>
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
    {isCurMonth&&incTotal>0&&dayOfMonth>5&&<div onClick={()=>setSubScreen("forecast")} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,padding:"14px 16px",marginBottom:12,cursor:"pointer",boxShadow:T.cardShadow}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{fontSize:18}}>📈</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,marginBottom:2}}>You'll likely save ~{fmt(projectedSaved)} by month-end</div>
          <div style={{fontSize:11,color:T.textSecondary,lineHeight:1.5}}>{prevSaved>0?(projectedSaved>=prevSaved?`That's ${fmt(projectedSaved-prevSaved)} more than last month.`:`That's ${fmt(prevSaved-projectedSaved)} less than last month.`):"Based on your spending so far this month."}</div>
        </div>
        <span style={{fontSize:14,color:T.textMuted}}>›</span>
      </div>
    </div>}

    {/* Review nudge */}
    {pendingTxs.length>0&&<button onClick={()=>setTab("review")} style={{width:"100%",background:T.warning+"10",border:`1px solid ${T.warning}30`,borderRadius:18,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
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
          <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{pendingVarStreams(streams,ov,selectedMonth).length} variable income{pendingVarStreams(streams,ov,selectedMonth).length>1?"s":""} need amount</div>
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

    {/* Empty state — no transactions */}
    {byCat.length===0&&incTotal>0&&<div onClick={onUploadClick} style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:18,padding:"28px 20px",textAlign:"center",cursor:"pointer",marginBottom:12}}>
      <div style={{fontSize:32,marginBottom:10}}>📄</div>
      <div style={{fontSize:14,fontWeight:600,color:T.textPrimary,marginBottom:4}}>No transactions yet</div>
      <div style={{fontSize:12,color:T.textSecondary,lineHeight:1.5}}>Tap the + button below to upload<br/>your first bank statement</div>
    </div>}

    {/* Privacy badge */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:22,fontSize:10,color:T.textMuted,letterSpacing:0.5}}>
      <PrivacyLock col={T.textMuted}/>
      100% on-device · nothing leaves your phone
    </div>

    <div style={{marginTop:14,display:"flex",justifyContent:"center"}}>
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
    </div>
  </div>;
}

