// ╔══════════════════════════════════════════════════════════════╗
// ║  SHOW ME THE MONEY — Part 1 of 4                            ║
// ║  Constants · Helpers · Theme · Shared UI · Primitives       ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";

// ── Categories ────────────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = [
  "🍔 Food & Dining","🛒 Groceries","🚗 Transport","🎬 Entertainment",
  "🏥 Health","👕 Shopping","💡 Utilities","✈️ Travel","📦 Other"
];
const FIXED_COMMITMENT_CATEGORIES = [
  "🏠 Rent/Mortgage","💳 Insurance","🏦 Loan Repayment",
  "📱 Subscription","🔒 Investment","💰 Savings Transfer"
];
const CAT_COLORS = {
  "🍔 Food & Dining":"#FF6B6B","🛒 Groceries":"#51CF66","🚗 Transport":"#339AF0",
  "🎬 Entertainment":"#CC5DE8","🏥 Health":"#FF922B","👕 Shopping":"#F06595",
  "💡 Utilities":"#FAB005","✈️ Travel":"#20C997","📦 Other":"#868E96",
  "🏠 Rent/Mortgage":"#60AAFF","💳 Insurance":"#FF6B6B","🏦 Loan Repayment":"#FAB005",
  "📱 Subscription":"#CC5DE8","🔒 Investment":"#51CF66","💰 Savings Transfer":"#20C997"
};

// ── Currencies ────────────────────────────────────────────────────────────────
const CURRENCIES = ["SGD","USD","MYR","AUD","GBP","EUR","JPY","HKD","THB","IDR"];
const CURRENCY_SYMBOLS = {
  "SGD":"S$","USD":"$","MYR":"RM","AUD":"A$","GBP":"£",
  "EUR":"€","JPY":"¥","HKD":"HK$","THB":"฿","IDR":"Rp"
};

// ── Theme Presets ─────────────────────────────────────────────────────────────
const DARK_PRESETS = [
  { name:"Midnight", accent:"#C8FF57", bg:"#0C0C12" },
  { name:"Ocean",    accent:"#60AAFF", bg:"#0A1628" },
  { name:"Noir",     accent:"#FF6B9D", bg:"#1A0812" },
];
const LIGHT_PRESETS = [
  { name:"Slate",    accent:"#5C5FEF", bg:"#F0F2F5" },
  { name:"Sage",     accent:"#2D7D4F", bg:"#F2F5F0" },
  { name:"Sand",     accent:"#C45E00", bg:"#FAF5EE" },
];
const ALL_PRESETS = [...DARK_PRESETS, ...LIGHT_PRESETS];

// ── App Constants ─────────────────────────────────────────────────────────────
const HABIT_THRESHOLD = 3;
const MAX_AUTO_BACKUPS = 7;
const APP_VERSION = "3.0";
const SIDEBAR_WIDTH = 220;

// ── Date Helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const monthKey = d => d.slice(0, 7);
const currentMonth = () => monthKey(todayStr());
const monthLabel = m => {
  try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"long",year:"numeric"}); }
  catch { return m; }
};
const monthLabelShort = m => {
  try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"short",year:"2-digit"}); }
  catch { return m; }
};
const prevMonth = m => {
  const [y,mo]=m.split("-"); const d=new Date(+y,+mo-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};
const greeting = () => {
  const h=new Date().getHours();
  return h<12?"Good morning":h<17?"Good afternoon":"Good evening";
};
const monthsBetween = (a,b) => {
  const [ay,am]=a.split("-").map(Number);
  const [by,bm]=b.split("-").map(Number);
  return (by-ay)*12+(bm-am);
};

// ── Default Profile ───────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  name:"", occupation:"", currency:"SGD", avatar:"",
  incomeStreams:[], fixedCommitments:[], goals:[],
  customCategories:[], budgets:{},
  onboarded:false, accentColor:"#C8FF57", bgColor:"#0C0C12",
  startMonth: currentMonth(),
};

// ── localStorage ──────────────────────────────────────────────────────────────
function lsLoad(key){
  try { const v=localStorage.getItem(key); return v?JSON.parse(v):null; } catch { return null; }
}
function lsSave(key,val){
  try { localStorage.setItem(key,JSON.stringify(val)); } catch(e){ console.error(e); }
}
function lsClear(){
  ["profile","monthlyData","excludeHistory","catExcludeHistory",
   "insights","autoBackups","editHintSeen","archive","pinHash"]
    .forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
}

// ── PIN ───────────────────────────────────────────────────────────────────────
function hashPin(pin){
  let h=0;
  for(let i=0;i<pin.length;i++){ h=((h<<5)-h)+pin.charCodeAt(i); h|=0; }
  return h.toString(36);
}

// ── Colour Engine ─────────────────────────────────────────────────────────────
function hexToRgb(hex){
  const h=hex.replace("#","");
  const f=h.length===3?h.split("").map(c=>c+c).join(""):h;
  const n=parseInt(f,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgbToHex(r,g,b){
  return "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
}
function luminance({r,g,b}){
  const s=[r,g,b].map(v=>{ const c=v/255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); });
  return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2];
}
function contrastRatio(a,b){
  const la=luminance(a),lb=luminance(b);
  return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05);
}
function isLight(hex){ return luminance(hexToRgb(hex))>0.25; }
function mixHex(hex,target,pct){
  const a=hexToRgb(hex),b=hexToRgb(target);
  return rgbToHex(a.r+(b.r-a.r)*pct, a.g+(b.g-a.g)*pct, a.b+(b.b-a.b)*pct);
}
function ensureContrast(accent,bg,minRatio=3.5){
  let hex=accent, a=hexToRgb(hex), itr=0;
  while(contrastRatio(a,hexToRgb(bg))<minRatio && itr<24){
    hex=isLight(bg)?mixHex(hex,"#000000",0.1):mixHex(hex,"#ffffff",0.1);
    a=hexToRgb(hex); itr++;
  }
  return { hex, adjusted:itr>2 };
}
function buildTheme(accentRaw,bgRaw){
  const bg=bgRaw||"#0C0C12";
  const {hex:accent}=ensureContrast(accentRaw||"#C8FF57",bg);
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
  return {
    bg,surface,surface2,border,borderMid,accent,accentText,
    accentMuted:accent+"20",accentBorder:accent+"40",
    positive,negative,warning,info,
    textPrimary,textSecondary,textMuted,
    bgLight,cardShadow
  };
}

// ── Theme Context ─────────────────────────────────────────────────────────────
const ThemeCtx = createContext(buildTheme("#C8FF57","#0C0C12"));
const useTheme = () => useContext(ThemeCtx);

// ── Category Helpers ──────────────────────────────────────────────────────────
function getAllCategories(customCategories=[]){
  return [...BUILTIN_CATEGORIES,...(customCategories||[]).map(c=>`${c.emoji} ${c.name}`)];
}
function getAllCatColors(customCategories=[]){
  const custom={};
  (customCategories||[]).forEach(c=>{ custom[`${c.emoji} ${c.name}`]=c.color||"#868E96"; });
  return { ...CAT_COLORS, ...custom };
}
function isFixedCommitmentCategory(cat){ return FIXED_COMMITMENT_CATEGORIES.includes(cat); }

// ── Income Helpers ────────────────────────────────────────────────────────────
function getMonthStreams(streams,monthOverrides,selectedMonth){
  return (streams||[]).filter(s=>{
    if(!s.active) return false;
    if(s.type==="oneoff"){
      return (monthOverrides||{})[`oneoff_month_${s.id}`]===selectedMonth;
    }
    if(s.startFrom && selectedMonth && monthsBetween(s.startFrom,selectedMonth)<0) return false;
    return true;
  }).map(s=>{
    const override=(monthOverrides||{})[s.id];
    if(s.type==="fixed") return { stream:s, amount:override!==undefined?override:s.defaultAmount };
    return { stream:s, amount:override!==undefined?override:null };
  });
}
function totalIncome(streams,monthOverrides,selectedMonth){
  return getMonthStreams(streams,monthOverrides,selectedMonth)
    .reduce((s,{amount})=>s+(amount||0),0)
    +((monthOverrides||{}).__extra__||0);
}
function pendingVariableStreams(streams,monthOverrides,selectedMonth){
  return getMonthStreams(streams,monthOverrides,selectedMonth)
    .filter(({stream,amount})=>(stream.type==="variable"||stream.type==="oneoff")&&amount===null);
}

// ── Habit Helpers ─────────────────────────────────────────────────────────────
function habitFlags(eh,ch){
  const mf={},cf={};
  for(const [k,v] of Object.entries(eh||{})) if(v>=HABIT_THRESHOLD) mf[k]=v;
  for(const [k,v] of Object.entries(ch||{})) if(v>=HABIT_THRESHOLD) cf[k]=v;
  return { mf, cf };
}
function habitReason(tx,mf,cf){
  const k=tx.description?.toLowerCase().trim();
  if(mf[k]) return `excluded ${mf[k]}× before`;
  if(cf[tx.category]) return `category excluded ${cf[tx.category]}× before`;
  return null;
}

// ── CSV Chunker ───────────────────────────────────────────────────────────────
function splitCSVIntoChunks(text,chunkSize=15000){
  const lines=text.split("\n");
  const header=lines[0];
  const dataLines=lines.slice(1).filter(l=>l.trim());
  const chunks=[]; let current=[header];
  for(const line of dataLines){
    current.push(line);
    if(current.join("\n").length>chunkSize){
      chunks.push(current.join("\n"));
      current=[header];
    }
  }
  if(current.length>1) chunks.push(current.join("\n"));
  return chunks.length?chunks:[text];
}

// ── Export Helpers ────────────────────────────────────────────────────────────
function exportCSV(monthlyData){
  const rows=[["Date","Description","Category","Amount","Month"]];
  Object.entries(monthlyData).sort().forEach(([month,md])=>{
    (md.txs||[]).forEach(t=>{
      rows.push([t.date,`"${(t.description||"").replace(/"/g,'""')}"`,t.category,t.amount.toFixed(2),month]);
    });
  });
  const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`spending-${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
}
function countAllTx(monthlyData){
  return Object.values(monthlyData).reduce((s,md)=>s+(md.txs||[]).length,0);
}

function exportMonthlySummaryHTML(month,profile,monthData,incomeStreams){
  const txs=monthData?.txs||[];
  const inc=totalIncome(incomeStreams,monthData?.incomeOverrides||{},month);
  const spent=txs.reduce((s,t)=>s+t.amount,0);
  const fixed=(monthData?.fixedOverrides||profile?.fixedCommitments||[])
    .filter(c=>(!c.startFrom||month>=c.startFrom)&&(!c.endMonth||month<=c.endMonth))
    .reduce((s,c)=>s+(+c.amount||0),0);
  const saved=inc-spent-fixed;
  const rate=inc>0?(saved/inc*100):0;
  const byCat={};
  txs.forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
  const f=n=>sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2});
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Summary – ${monthLabel(month)}</title>
<style>
body{font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#111;}
h1{font-size:22px;margin-bottom:4px;}.sub{font-size:13px;color:#888;margin-bottom:32px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;}
.card{border:1px solid #eee;border-radius:10px;padding:16px;}
.lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
.val{font-size:22px;font-weight:600;font-family:monospace;}
.green{color:#1A7A40;}.red{color:#C0202A;}.blue{color:#1060B0;}
.bar-wrap{background:#f0f0f0;border-radius:4px;height:6px;margin-top:6px;overflow:hidden;}
.bar{height:100%;border-radius:4px;}
table{width:100%;border-collapse:collapse;margin-top:16px;}
th{font-size:11px;color:#888;text-align:left;padding:6px 0;border-bottom:1px solid #eee;}
td{padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:13px;}
.footer{margin-top:32px;font-size:11px;color:#bbb;text-align:center;}
@media print{body{margin:0;}}
</style></head><body>
<h1>${monthLabel(month)}</h1>
<div class="sub">Financial Summary · ${profile?.name||""}</div>
<div class="grid">
  <div class="card"><div class="lbl">Income</div><div class="val green">${f(inc)}</div></div>
  <div class="card"><div class="lbl">Fixed</div><div class="val blue">${f(fixed)}</div></div>
  <div class="card"><div class="lbl">Spent</div><div class="val red">${f(spent)}</div></div>
  <div class="card"><div class="lbl">Saved</div><div class="val ${saved>=0?"green":"red"}">${f(saved)}</div></div>
</div>
<div class="card">
  <div class="lbl">Savings Rate</div>
  <div class="val ${rate>=20?"green":rate>=10?"":"red"}">${rate.toFixed(1)}%</div>
  <div class="bar-wrap"><div class="bar" style="width:${Math.min(100,Math.max(0,rate))}%;background:${rate>=20?"#1A7A40":rate>=10?"#A06800":"#C0202A"}"></div></div>
</div>
<table>
  <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${topCats.map(([cat,amt])=>`<tr><td>${cat}</td><td style="text-align:right;font-family:monospace">${f(amt)}</td></tr>`).join("")}</tbody>
</table>
<div class="footer">Generated by Show Me The Money · ${new Date().toLocaleDateString("en-SG")}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  window.open(url,"_blank");
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}

function generateShareCard(month,profile,monthData,incomeStreams){
  const txs=monthData?.txs||[];
  const inc=totalIncome(incomeStreams,monthData?.incomeOverrides||{},month);
  const spent=txs.reduce((s,t)=>s+t.amount,0);
  const fixed=(monthData?.fixedOverrides||profile?.fixedCommitments||[])
    .filter(c=>(!c.startFrom||month>=c.startFrom)&&(!c.endMonth||month<=c.endMonth))
    .reduce((s,c)=>s+(+c.amount||0),0);
  const saved=inc-spent-fixed;
  const rate=inc>0?(saved/inc*100):0;
  const byCat={};
  txs.forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
  const f=n=>sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2});
  const accent=profile?.accentColor||"#C8FF57";
  const bg=profile?.bgColor||"#0C0C12";
  const textCol=isLight(bg)?"#111118":"#EEEAE0";
  const canvas=document.createElement("canvas");
  canvas.width=800; canvas.height=450;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle=bg; ctx.fillRect(0,0,800,450);
  ctx.fillStyle=accent+"15"; ctx.fillRect(0,0,800,450);
  ctx.fillStyle=accent; ctx.font="bold 16px 'Helvetica Neue'";
  ctx.fillText("SHOW ME THE MONEY",40,48);
  ctx.fillStyle=textCol; ctx.font="bold 30px 'Helvetica Neue'";
  ctx.fillText(monthLabel(month),40,90);
  if(profile?.name){
    ctx.fillStyle=textCol+"70"; ctx.font="13px 'Helvetica Neue'";
    ctx.fillText(profile.name,40,112);
  }
  const boxes=[
    ["Spent",f(spent),"#FF6B6B"],
    ["Saved",f(saved),saved>=0?"#51CF66":"#FF6B6B"],
    ["Rate",rate.toFixed(1)+"%",rate>=20?"#51CF66":rate>=10?"#FAB005":"#FF6B6B"]
  ];
  boxes.forEach(([label,val,col],i)=>{
    const x=40+i*240, y=148;
    ctx.fillStyle=textCol+"10";
    ctx.beginPath(); ctx.roundRect(x,y,220,110,12); ctx.fill();
    ctx.fillStyle=textCol+"55"; ctx.font="10px 'Helvetica Neue'";
    ctx.fillText(label.toUpperCase(),x+16,y+24);
    ctx.fillStyle=col; ctx.font="bold 26px 'Helvetica Neue'";
    ctx.fillText(val,x+16,y+68);
  });
  const barY=306, barW=720;
  ctx.fillStyle=textCol+"12";
  ctx.beginPath(); ctx.roundRect(40,barY,barW,10,5); ctx.fill();
  const fillW=Math.min(barW,Math.max(0,(rate/100)*barW));
  ctx.fillStyle=rate>=20?"#51CF66":rate>=10?"#FAB005":"#FF6B6B";
  ctx.beginPath(); ctx.roundRect(40,barY,fillW,10,5); ctx.fill();
  ctx.fillStyle=textCol+"70"; ctx.font="12px 'Helvetica Neue'";
  ctx.fillText(`Savings rate: ${rate.toFixed(1)}%`,40,336);
  if(topCat){
    ctx.fillStyle=textCol+"50";
    ctx.fillText(`Top spend: ${topCat[0]} · ${f(topCat[1])}`,40,356);
  }
  ctx.fillStyle=accent+"50"; ctx.font="10px 'Helvetica Neue'";
  ctx.fillText("showmethemoney.app",40,420);
  canvas.toBlob(blob=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`summary-${month}.png`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  },"image/png");
}

// ── Backup ────────────────────────────────────────────────────────────────────
function createSnapshot(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive){
  return { version:APP_VERSION, createdAt:new Date().toISOString(), profile, monthlyData, excludeHistory, catExcludeHistory, insights, archive };
}
function runAutoBackup(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive){
  try{
    const snap=createSnapshot(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive);
    const existing=lsLoad("autoBackups")||[];
    const today=todayStr();
    const filtered=existing.filter(b=>!b.createdAt?.startsWith(today));
    lsSave("autoBackups",[snap,...filtered].slice(0,MAX_AUTO_BACKUPS));
  }catch(e){ console.error("Auto-backup failed",e); }
}
function downloadBackup(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive){
  const blob=new Blob([JSON.stringify(createSnapshot(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`smtm-backup-${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SHARED UI PRIMITIVES                                        ║
// ╚══════════════════════════════════════════════════════════════╝

function useInpStyle(){
  const T=useTheme();
  return {
    padding:"9px 12px", background:T.surface2,
    border:`1px solid ${T.borderMid}`, borderRadius:9,
    color:T.textPrimary, fontFamily:"inherit",
    fontSize:13, outline:"none", width:"100%", boxSizing:"border-box"
  };
}

function Card({children,style}){
  const T=useTheme();
  return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",boxShadow:T.cardShadow,...style}}>{children}</div>;
}

function SLabel({children,style}){
  const T=useTheme();
  return <p style={{margin:"0 0 8px",fontSize:10,letterSpacing:2,color:T.textMuted,textTransform:"uppercase",fontFamily:"'DM Mono'",...style}}>{children}</p>;
}

function AccentBtn({children,onClick,disabled,style}){
  const T=useTheme();
  return <button onClick={onClick} disabled={disabled} style={{padding:"12px",background:disabled?T.border:T.accent,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:14,color:disabled?T.textMuted:T.accentText,cursor:disabled?"default":"pointer",width:"100%",...style}}>{children}</button>;
}

function GhostBtn({children,onClick,style}){
  const T=useTheme();
  return <button onClick={onClick} style={{padding:"9px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer",...style}}>{children}</button>;
}

function Checkbox({checked,onChange}){
  const T=useTheme();
  return <div onClick={onChange} style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${checked?T.accent:T.borderMid}`,background:checked?T.accentMuted:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>
    {checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>;
}

function Toast({msg,onDone}){
  const T=useTheme();
  useEffect(()=>{ const t=setTimeout(onDone,2800); return()=>clearTimeout(t); },[onDone]);
  return <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:T.accent,color:T.accentText,borderRadius:20,padding:"8px 20px",fontSize:13,fontWeight:600,zIndex:1999,whiteSpace:"nowrap",pointerEvents:"none"}}>{msg}</div>;
}

function EditableAmount({value,onSave,fmt,color}){
  const T=useTheme();
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState("");
  if(editing) return <input
    type="number" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus
    style={{width:90,padding:"4px 8px",background:T.surface2,border:`1px solid ${T.accent}`,borderRadius:6,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:13,outline:"none"}}
    onKeyDown={e=>{ if(e.key==="Enter"){onSave(parseFloat(draft)||0);setEditing(false);} if(e.key==="Escape")setEditing(false); }}
    onBlur={()=>{ onSave(parseFloat(draft)||0); setEditing(false); }}/>;
  return <div
    onClick={()=>{ setDraft(Math.abs(value).toString()); setEditing(true); }}
    style={{fontFamily:"'DM Mono'",fontSize:13,color:color||T.textPrimary,cursor:"pointer",borderBottom:`1px dashed ${T.borderMid}`,paddingBottom:1}}>
    {fmt(value)}
  </div>;
}

// ── Theme Preset Picker ───────────────────────────────────────────────────────
function ThemePresetPicker({accentColor,bgColor,onChange}){
  const T=useTheme();
  const renderPreset=p=>{
    const active=p.accent===accentColor&&p.bg===bgColor;
    return <div key={p.name} onClick={()=>onChange(p.accent,p.bg)}
      style={{borderRadius:10,overflow:"hidden",border:`2px solid ${active?T.accent:T.border}`,cursor:"pointer",transition:"border-color .15s"}}>
      <div style={{background:p.bg,padding:"10px"}}>
        <div style={{width:14,height:14,borderRadius:"50%",background:p.accent,marginBottom:5}}/>
        <div style={{height:2,background:p.accent,borderRadius:2,opacity:.5,marginBottom:2}}/>
        <div style={{height:2,background:p.accent,borderRadius:2,opacity:.2,width:"60%"}}/>
      </div>
      <div style={{background:isLight(p.bg)?mixHex(p.bg,"#000000",0.06):mixHex(p.bg,"#ffffff",0.06),padding:"4px 8px",fontSize:10,color:isLight(p.bg)?"#333":"#aaa",fontFamily:"'DM Mono'"}}>{p.name}</div>
    </div>;
  };
  return <div>
    <SLabel>Theme</SLabel>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'"}}>DARK</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
      {DARK_PRESETS.map(renderPreset)}
    </div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:6,fontFamily:"'DM Mono'"}}>LIGHT</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
      {LIGHT_PRESETS.map(renderPreset)}
    </div>
  </div>;
}

// ── Draggable List ────────────────────────────────────────────────────────────
function DraggableList({items,onReorder,renderItem}){
  const T=useTheme();
  const [dragIdx,setDragIdx]=useState(null);
  const [overIdx,setOverIdx]=useState(null);
  return <div>
    {(items||[]).map((item,i)=>(
      <div key={item.id||i} draggable
        onDragStart={()=>setDragIdx(i)}
        onDragOver={e=>{ e.preventDefault(); setOverIdx(i); }}
        onDrop={e=>{ e.preventDefault(); if(dragIdx===null||dragIdx===i)return; const a=[...items]; const[it]=a.splice(dragIdx,1); a.splice(i,0,it); onReorder(a); setDragIdx(null); setOverIdx(null); }}
        onDragEnd={()=>{ setDragIdx(null); setOverIdx(null); }}
        style={{opacity:dragIdx===i?0.4:1,borderTop:overIdx===i&&dragIdx!==i?`2px solid ${T.accent}`:"2px solid transparent",transition:"border-color .1s"}}>
        {renderItem(item,i)}
      </div>
    ))}
  </div>;
}

// ── Month Picker ──────────────────────────────────────────────────────────────
function MonthPicker({value,onChange,startMonth}){
  const T=useTheme(); const inp=useInpStyle();
  const [open,setOpen]=useState(false);
  const [typed,setTyped]=useState(value);
  useEffect(()=>setTyped(value),[value]);
  const months=[]; const now=new Date();
  for(let i=0;i<36;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(startMonth&&m<startMonth) break;
    months.push(m);
  }
  return <div style={{position:"relative"}}>
    <button onClick={()=>setOpen(o=>!o)}
      style={{...inp,width:"auto",padding:"6px 12px",color:T.accent,background:T.surface,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono'"}}>
      {monthLabel(value)} ▾
    </button>
    {open&&<>
      <div style={{position:"fixed",inset:0,zIndex:199}} onClick={()=>setOpen(false)}/>
      <div style={{position:"fixed",top:70,right:16,background:T.surface,border:`1px solid ${T.borderMid}`,borderRadius:12,zIndex:200,maxHeight:260,overflowY:"auto",minWidth:200,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
        <div style={{padding:"8px"}}>
          <input value={typed} onChange={e=>setTyped(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&/^\d{4}-\d{2}$/.test(typed)&&(!startMonth||typed>=startMonth)){onChange(typed);setOpen(false);} }}
            placeholder="YYYY-MM" style={{...inp,fontSize:12}}/>
        </div>
        {months.map(m=>(
          <div key={m} onClick={()=>{ onChange(m); setOpen(false); }}
            style={{padding:"8px 14px",fontSize:13,color:m===value?T.accent:T.textSecondary,cursor:"pointer",fontFamily:"'DM Mono'",background:m===value?T.accentMuted:"transparent"}}>
            {monthLabel(m)}
          </div>
        ))}
      </div>
    </>}
  </div>;
}

// ── 6-Month Chart ─────────────────────────────────────────────────────────────
function SixMonthChart({monthlyData,incomeStreams,selectedMonth,startMonth}){
  const T=useTheme();
  const months=useMemo(()=>{
    const r=[]; let m=selectedMonth;
    for(let i=0;i<6;i++){
      if(startMonth&&m<startMonth) break;
      r.unshift(m); m=prevMonth(m);
    }
    return r;
  },[selectedMonth,startMonth]);
  const data=useMemo(()=>months.map(m=>{
    const md=monthlyData[m]||{};
    const txs=md.txs||[];
    const inc=totalIncome(incomeStreams,md.incomeOverrides||{},m);
    const spent=Math.abs(txs.reduce((s,t)=>s+t.amount,0));
    return { m, inc, spent, hasIncome:inc>0 };
  }),[months,monthlyData,incomeStreams]);
  const maxVal=useMemo(()=>Math.max(...data.map(d=>Math.max(d.inc,d.spent)),1),[data]);
  return <div>
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:6}}>
      {data.map(({m,inc,spent,hasIncome})=>{
        const isCurrent=m===selectedMonth;
        const incH=Math.max(2,(inc/maxVal)*76);
        const spentH=Math.max(2,(spent/maxVal)*76);
        const ratio=inc>0?spent/inc:0;
        const barColor=ratio>0.8?T.negative:ratio>0.6?T.warning:T.positive;
        return <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:76}}>
            <div style={{flex:1,borderRadius:"3px 3px 0 0",background:hasIncome?T.accent+"40":"transparent",border:hasIncome?"none":`1px dashed ${T.border}`,height:incH,transition:"height .4s ease"}}/>
            <div style={{flex:1,borderRadius:"3px 3px 0 0",background:barColor,height:spentH,transition:"height .4s ease"}}/>
          </div>
          <div style={{fontSize:9,color:isCurrent?T.accent:T.textMuted,fontFamily:"'DM Mono'",fontWeight:isCurrent?600:400,whiteSpace:"nowrap"}}>{monthLabelShort(m)}</div>
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:12,fontSize:10,color:T.textMuted}}>
      <span><span style={{color:T.accent}}>■</span> Income</span>
      <span><span style={{color:T.positive}}>■</span> Spending</span>
      <span style={{opacity:.5}}>dashed = not set</span>
    </div>
  </div>;
}

// ── InsightCards ──────────────────────────────────────────────────────────────
function InsightCards({text}){
  const T=useTheme();
  if(!text) return null;
  const items=text.split(/\n+/).filter(l=>l.trim())
    .map(l=>l.replace(/^\d+[\.\)]\s*/,"").replace(/^[-•]\s*/,"").trim())
    .filter(Boolean);
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    {items.map((item,i)=>(
      <div key={i} style={{background:T.surface2,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`,display:"flex",gap:10}}>
        <span style={{fontSize:11,color:T.accent,fontFamily:"'DM Mono'",fontWeight:600,flexShrink:0,marginTop:1}}>{String(i+1).padStart(2,"0")}</span>
        <span style={{fontSize:13,color:T.textSecondary,lineHeight:1.65}}>{item}</span>
      </div>
    ))}
  </div>;
}

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({tx,onArchive,onEdit,fmt,customCategories}){
  const T=useTheme(); const inp=useInpStyle();
  const CATS=getAllCategories(customCategories);
  const CCOLS=getAllCatColors(customCategories);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(tx);
  useEffect(()=>setDraft(tx),[tx.id]);
  const isCredit=tx.amount<0;
  if(editing) return <div style={{background:T.surface,borderRadius:11,padding:"12px",border:`1px solid ${T.accent}60`}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
      <input value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} style={{...inp,gridColumn:"1/-1"}} placeholder="Description"/>
      <input type="number" value={Math.abs(draft.amount)}
        onChange={e=>setDraft(d=>({...d,amount:isCredit?-(parseFloat(e.target.value)||0):(parseFloat(e.target.value)||0)}))}
        style={inp} placeholder="Amount"/>
      <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={inp}/>
      <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))} style={{...inp,gridColumn:"1/-1"}}>
        {CATS.map(c=><option key={c}>{c}</option>)}
      </select>
    </div>
    <div style={{display:"flex",gap:7}}>
      <AccentBtn onClick={()=>{ onEdit(draft); setEditing(false); }} style={{padding:"8px",fontSize:13}}>Save</AccentBtn>
      <GhostBtn onClick={()=>setEditing(false)} style={{padding:"8px",fontSize:13,flex:1}}>Cancel</GhostBtn>
    </div>
  </div>;
  return <div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,borderRadius:11,padding:"11px 13px",border:`1px solid ${isCredit?T.positive+"50":T.borderMid}`,boxShadow:T.cardShadow}}>
    <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:(CCOLS[tx.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
      {tx.category?.split(" ")[0]}
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:T.textPrimary}}>
        {tx.description}
        {tx.source==="imported"&&<span style={{marginLeft:6,fontSize:9,color:T.accent,opacity:.5,fontFamily:"'DM Mono'"}}>AI</span>}
        {isCredit&&<span style={{marginLeft:6,fontSize:9,color:T.positive,fontFamily:"'DM Mono'",border:`1px solid ${T.positive}40`,borderRadius:4,padding:"1px 5px"}}>CR</span>}
        {tx.isDuplicate&&<span style={{marginLeft:6,fontSize:9,color:T.warning,fontFamily:"'DM Mono'",border:`1px solid ${T.warning}40`,borderRadius:4,padding:"1px 5px"}}>dup?</span>}
      </div>
      <div style={{display:"flex",gap:6,marginTop:2}}>
        <span style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{tx.date}</span>
        <span style={{fontSize:11,color:T.textMuted}}>{tx.category?.split(" ").slice(1).join(" ")}</span>
      </div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:500,color:isCredit?T.positive:T.textPrimary,flexShrink:0}}>
      {isCredit?"-":""}{fmt(Math.abs(tx.amount))}
    </div>
    {onEdit&&<button onClick={()=>setEditing(true)} style={{background:"none",border:`1px solid ${T.borderMid}`,borderRadius:6,color:T.textSecondary,cursor:"pointer",fontSize:12,padding:"3px 7px",flexShrink:0,marginLeft:2}}>✎</button>}
    {onArchive&&<button onClick={()=>onArchive(tx.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:17,padding:"0 2px",flexShrink:0}}>×</button>}
  </div>;
}

// ── VariableIncomeEntry ───────────────────────────────────────────────────────
function VariableIncomeEntry({streams,monthOverrides,onUpdate,selectedMonth}){
  const T=useTheme(); const inp=useInpStyle();
  const pending=pendingVariableStreams(streams,monthOverrides,selectedMonth);
  if(pending.length===0) return null;
  return <Card style={{border:`1px solid ${T.warning}40`,background:T.warning+"08"}}>
    <SLabel style={{color:T.warning}}>Income — {pending.length} stream{pending.length>1?"s":""} need amounts</SLabel>
    {pending.map(({stream})=>(
      <div key={stream.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:T.textSecondary,marginBottom:3}}>{stream.name} ({stream.type})</div>
          <input type="number" placeholder="Enter amount" style={inp}
            onBlur={e=>{ const v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0) onUpdate(stream.id,v); }}
            onKeyDown={e=>{ if(e.key==="Enter"){ const v=parseFloat(e.target.value); if(!isNaN(v)&&v>=0){onUpdate(stream.id,v);e.target.value="";}}}}/>
        </div>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.warning,flexShrink:0,marginTop:16}}/>
      </div>
    ))}
  </Card>;
}

// ── IncomeBreakdown ───────────────────────────────────────────────────────────
function IncomeBreakdown({streams,monthOverrides,prevMonthOverrides,fmt,selectedMonth,onUpdateOverride}){
  const T=useTheme();
  const rows=getMonthStreams(streams,monthOverrides,selectedMonth);
  const prevRows=getMonthStreams(streams,prevMonthOverrides||{},prevMonth(selectedMonth));
  const extra=(monthOverrides||{}).__extra__||0;
  const total=rows.reduce((s,{amount})=>s+(amount||0),0)+extra;
  const typeColor=t=>t==="fixed"?T.info:t==="variable"?T.warning:T.positive;
  const typeLabel=t=>t==="fixed"?"Fixed":t==="variable"?"Variable":"One-off";
  return <div>
    {rows.map(({stream:s,amount})=>{
      const prev=prevRows.find(r=>r.stream.id===s.id);
      const pa=prev?.amount||0;
      return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:typeColor(s.type),flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,color:T.textPrimary,fontWeight:500}}>{s.name}</div>
          <div style={{fontSize:10,color:typeColor(s.type),fontFamily:"'DM Mono'"}}>{typeLabel(s.type)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          {amount===null
            ?<span style={{fontSize:13,color:T.textMuted}}>—</span>
            :<EditableAmount value={amount} fmt={fmt} color={T.textPrimary} onSave={v=>onUpdateOverride(s.id,v)}/>}
          {pa>0&&amount!==null&&<div style={{fontSize:10,color:amount>=pa?T.positive:T.negative,fontFamily:"'DM Mono'"}}>{amount>=pa?"+":""}{fmt(amount-pa)}</div>}
        </div>
      </div>;
    })}
    {extra>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontSize:13,color:T.textPrimary}}>Extra income</span>
      <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.positive}}>{fmt(extra)}</span>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",paddingTop:8}}>
      <span style={{fontSize:12,color:T.textMuted}}>Total income</span>
      <span style={{fontFamily:"'DM Mono'",fontSize:14,color:T.positive,fontWeight:600}}>{fmt(total)}</span>
    </div>
  </div>;
}
// ╔══════════════════════════════════════════════════════════════╗
// ║  SHOW ME THE MONEY — Part 2 of 4                            ║
// ║  PIN Screen · Modals · Onboarding                           ║
// ╚══════════════════════════════════════════════════════════════╝
//

// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({storedHash,onUnlock,onSetup}){
  const T=useTheme();
  const [digits,setDigits]=useState([]);
  const [error,setError]=useState("");
  const [setting,setSetting]=useState(!storedHash);
  const [confirm,setConfirm]=useState(false);
  const [first,setFirst]=useState("");

  const pad=d=>{
    const next=[...digits,d.toString()];
    if(next.length===4){
      if(setting){
        if(!confirm){
          setFirst(next.join(""));
          setConfirm(true);
          setDigits([]);
        } else {
          if(next.join("")===first){ onSetup(next.join("")); }
          else { setError("PINs don't match"); setDigits([]); setConfirm(false); setFirst(""); }
        }
      } else {
        if(hashPin(next.join(""))===storedHash){ onUnlock(); }
        else { setError("Incorrect PIN"); setDigits([]); }
      }
    } else setDigits(next);
  };
  const del=()=>setDigits(d=>d.slice(0,-1));

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,fontFamily:"'DM Sans',sans-serif"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:13,fontWeight:700,color:T.accent,marginBottom:4}}>Show Me The Money</div>
      <div style={{fontSize:15,color:T.textPrimary,fontWeight:600}}>
        {setting?(confirm?"Confirm your PIN":"Set a PIN"):"Enter your PIN"}
      </div>
      {setting&&!confirm&&<div style={{fontSize:12,color:T.textMuted,marginTop:4}}>You'll need this every time you open the app</div>}
    </div>
    <div style={{display:"flex",gap:12}}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<digits.length?T.accent:T.border,transition:"background .15s"}}/>
      ))}
    </div>
    {error&&<div style={{fontSize:12,color:T.negative}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:12}}>
      {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
        <button key={i}
          onClick={()=>{ if(d==="") return; if(d==="⌫") del(); else pad(d); }}
          style={{width:72,height:72,borderRadius:18,background:d===""?"transparent":T.surface,border:`1px solid ${d===""?"transparent":T.border}`,fontSize:d==="⌫"?20:22,fontWeight:600,color:d===""?"transparent":T.textPrimary,cursor:d===""?"default":"pointer",fontFamily:"inherit",transition:"background .1s"}}>
          {d}
        </button>
      ))}
    </div>
    {setting&&<button onClick={()=>{ setSetting(false); onSetup(null); }}
      style={{background:"none",border:"none",color:T.textMuted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
      Skip PIN setup
    </button>}
  </div>;
}

// ── Generic Modal Wrapper ─────────────────────────────────────────────────────
function Modal({children,onClose,zIndex=700}){
  return <div
    style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
    onClick={onClose}>
    <div onClick={e=>e.stopPropagation()}>{children}</div>
  </div>;
}

// ── Restore Modal ─────────────────────────────────────────────────────────────
function RestoreModal({backup,onConfirm,onClose}){
  const T=useTheme();
  const txCount=countAllTx(backup.monthlyData||{});
  const moCount=Object.keys(backup.monthlyData||{}).length;
  return <Modal onClose={onClose}>
    <div style={{background:T.surface,borderRadius:16,padding:20,width:"100%",maxWidth:320}}>
      <p style={{margin:"0 0 4px",fontSize:16,fontWeight:600,color:T.textPrimary}}>Restore backup?</p>
      <p style={{margin:"0 0 12px",fontSize:12,color:T.textSecondary}}>
        {new Date(backup.createdAt).toLocaleString("en-SG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
      </p>
      <div style={{background:T.surface2,borderRadius:9,padding:"10px 12px",marginBottom:10,fontSize:12,color:T.textSecondary}}>
        {txCount} transactions · {moCount} months · {backup.profile?.name||"Unknown"}
      </div>
      <div style={{padding:"10px 12px",background:T.negative+"18",borderRadius:9,fontSize:12,color:T.negative,marginBottom:16}}>
        ⚠ This replaces ALL current data and cannot be undone.
      </div>
      <div style={{display:"flex",gap:8}}>
        <GhostBtn onClick={onClose} style={{flex:1,padding:"9px",fontSize:13}}>Cancel</GhostBtn>
        <button onClick={onConfirm} style={{flex:1,padding:"9px",background:T.negative,border:"none",borderRadius:9,fontFamily:"inherit",fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer"}}>Restore</button>
      </div>
    </div>
  </Modal>;
}

// ── Reset Modal ───────────────────────────────────────────────────────────────
function ResetModal({onConfirm,onClose,onDownloadFirst}){
  const T=useTheme();
  return <Modal onClose={onClose} zIndex={800}>
    <div style={{background:T.surface,borderRadius:16,padding:20,width:"100%",maxWidth:320}}>
      <p style={{margin:"0 0 4px",fontSize:16,fontWeight:600,color:T.textPrimary}}>Reset everything?</p>
      <p style={{margin:"0 0 12px",fontSize:13,color:T.textSecondary}}>
        Deletes your profile, all transactions, and all history. You'll start fresh from onboarding.
      </p>
      <div style={{padding:"10px 12px",background:T.negative+"18",borderRadius:9,fontSize:12,color:T.negative,marginBottom:16}}>
        ⚠ This cannot be undone.
      </div>
      <button onClick={onDownloadFirst}
        style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer",marginBottom:8,textAlign:"left"}}>
        ⬇ Download backup first (recommended)
      </button>
      <div style={{display:"flex",gap:8}}>
        <GhostBtn onClick={onClose} style={{flex:1,padding:"9px",fontSize:13}}>Cancel</GhostBtn>
        <button onClick={onConfirm} style={{flex:1,padding:"9px",background:T.negative,border:"none",borderRadius:9,fontFamily:"inherit",fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer"}}>Reset</button>
      </div>
    </div>
  </Modal>;
}

// ── Fixed Commitment Modal ────────────────────────────────────────────────────
function FixedCommitmentModal({detected,fmt,onConfirm,onSkip}){
  const T=useTheme();
  const [sel,setSel]=useState(detected.map((_,i)=>i));
  const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Modal onClose={onSkip}>
    <div style={{background:T.surface,borderRadius:16,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}>
      <p style={{margin:"0 0 4px",fontSize:16,fontWeight:600,color:T.textPrimary}}>Fixed commitments detected</p>
      <p style={{margin:"0 0 14px",fontSize:12,color:T.textSecondary}}>
        These look like recurring fixed payments. Add them to your Fixed Commitments tracker?
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {detected.map((t,i)=>(
          <div key={i} onClick={()=>tog(i)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:sel.includes(i)?T.accentMuted:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:10,cursor:"pointer"}}>
            <Checkbox checked={sel.includes(i)} onChange={()=>tog(i)}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:T.textPrimary}}>{t.description}</div>
              <div style={{fontSize:11,color:T.textMuted}}>{t.category}</div>
            </div>
            <div style={{fontFamily:"'DM Mono'",fontSize:13,color:T.accent}}>{fmt(t.rawAmount)}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <GhostBtn onClick={onSkip} style={{flex:1,padding:"9px",fontSize:13}}>Skip</GhostBtn>
        <AccentBtn onClick={()=>onConfirm(sel.map(i=>detected[i]))} style={{flex:1,padding:"9px",fontSize:13}}>Add Selected</AccentBtn>
      </div>
    </div>
  </Modal>;
}

// ── Recurring Detection Modal ─────────────────────────────────────────────────
function RecurringModal({suggestions,onConfirm,onDismiss}){
  const T=useTheme();
  const [sel,setSel]=useState(suggestions.map((_,i)=>i));
  const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Modal onClose={onDismiss}>
    <div style={{background:T.surface,borderRadius:16,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}>
      <p style={{margin:"0 0 4px",fontSize:16,fontWeight:600,color:T.textPrimary}}>Recurring transactions detected</p>
      <p style={{margin:"0 0 14px",fontSize:12,color:T.textSecondary}}>
        These appear every month at a similar amount. Add to Fixed Commitments?
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {suggestions.map((s,i)=>(
          <div key={i} onClick={()=>tog(i)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:sel.includes(i)?T.accentMuted:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:10,cursor:"pointer"}}>
            <Checkbox checked={sel.includes(i)} onChange={()=>tog(i)}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:T.textPrimary}}>{s.description}</div>
              <div style={{fontSize:11,color:T.textMuted}}>~{s.amount.toFixed(2)} · appears {s.count} months</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <GhostBtn onClick={onDismiss} style={{flex:1,padding:"9px",fontSize:13}}>Not now</GhostBtn>
        <AccentBtn onClick={()=>onConfirm(sel.map(i=>suggestions[i]))} style={{flex:1,padding:"9px",fontSize:13}}>Add Selected</AccentBtn>
      </div>
    </div>
  </Modal>;
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const T=useTheme();
  const inp=useInpStyle();
  const [step,setStep]=useState(0);
  const [p,setP]=useState({
    name:"", currency:"SGD", occupation:"",
    accentColor:"#C8FF57", bgColor:"#0C0C12",
    incomeStreams:[], fixedCommitments:[],
    startMonth:currentMonth()
  });
  const avatarRef=useRef();

  const handleAvatar=e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        canvas.width=200; canvas.height=200;
        const ctx=canvas.getContext("2d");
        const size=Math.min(img.width,img.height);
        const sx=(img.width-size)/2; const sy=(img.height-size)/2;
        ctx.drawImage(img,sx,sy,size,size,0,0,200,200);
        setP(v=>({...v,avatar:canvas.toDataURL("image/jpeg",0.85)}));
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  const finish=()=>onComplete({
    ...DEFAULT_PROFILE, ...p,
    incomeStreams:(p.incomeStreams||[]).map(s=>({...s,defaultAmount:parseFloat(s.defaultAmount)||0})),
    fixedCommitments:[],
    onboarded:true
  });

  const updateStream=(id,field,val)=>setP(v=>({...v,incomeStreams:v.incomeStreams.map(x=>x.id===id?{...x,[field]:val}:x)}));

  const steps=[
    // ── Step 0: Identity ──────────────────────────────────────────────────────
    <div key="s0">
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:T.accent,fontFamily:"'DM Mono'",marginBottom:8,opacity:.8}}>Welcome to</div>
        <div style={{fontSize:28,fontWeight:600,color:T.textPrimary,letterSpacing:-0.5,lineHeight:1.2}}>Show Me The Money</div>
        <div style={{fontSize:13,color:T.textSecondary,marginTop:8,lineHeight:1.6}}>Import statements, track spending, understand your money.</div>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div onClick={()=>avatarRef.current.click()} style={{width:72,height:72,borderRadius:"50%",background:T.accentMuted,border:`2px dashed ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
          {p.avatar?<img src={p.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28,color:T.accent,opacity:.7}}>+</span>}
        </div>
        <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <input placeholder="Your name *" value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))} style={inp}/>
        <input placeholder="Occupation (optional)" value={p.occupation||""} onChange={e=>setP(v=>({...v,occupation:e.target.value}))} style={inp}/>
        <select value={p.currency} onChange={e=>setP(v=>({...v,currency:e.target.value}))} style={inp}>
          {CURRENCIES.map(c=><option key={c}>{c}</option>)}
        </select>
        <div>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Tracking from (your fresh start month)</div>
          <input type="month" value={p.startMonth} onChange={e=>setP(v=>({...v,startMonth:e.target.value}))} style={inp}/>
          <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>Only months from here will appear in the app.</div>
        </div>
      </div>
      <AccentBtn onClick={()=>p.name.trim()&&setStep(1)} disabled={!p.name.trim()} style={{marginTop:20}}>Continue →</AccentBtn>
    </div>,

    // ── Step 1: Income Streams ────────────────────────────────────────────────
    <div key="s1">
      <p style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:T.textPrimary}}>Income streams</p>
      <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary,lineHeight:1.6}}>
        Fixed = same every month. Variable = enter each month. One-off = occasional.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {p.incomeStreams.map((s,i)=>(
          <div key={s.id} style={{background:T.surface2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
              <input placeholder="Stream name (e.g. Salary)" value={s.name}
                onChange={e=>updateStream(s.id,"name",e.target.value)} style={inp}/>
              {i>0&&<button onClick={()=>setP(v=>({...v,incomeStreams:v.incomeStreams.filter(x=>x.id!==s.id)}))}
                style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
            </div>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:8}}>
              {["fixed","variable","oneoff"].map(t=>(
                <button key={t} onClick={()=>updateStream(s.id,"type",t)}
                  style={{flex:1,padding:"5px 8px",background:s.type===t?T.accent:"transparent",border:"none",color:s.type===t?T.accentText:T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?600:400}}>
                  {t==="oneoff"?"One-off":t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            {s.type==="fixed"&&<input type="number" placeholder="Monthly amount" value={s.defaultAmount}
              onChange={e=>updateStream(s.id,"defaultAmount",e.target.value)} style={inp}/>}
          </div>
        ))}
      </div>
      <button onClick={()=>setP(v=>({...v,incomeStreams:[...v.incomeStreams,{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:"",active:true}]}))}
        style={{padding:"8px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:9,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%",marginBottom:16}}>
        + Add income stream
      </button>
      <AccentBtn onClick={()=>setStep(2)}>Continue →</AccentBtn>
      <GhostBtn onClick={()=>setStep(2)} style={{marginTop:8,width:"100%",textAlign:"center"}}>Skip for now</GhostBtn>
    </div>,

    // ── Step 2: Theme ─────────────────────────────────────────────────────────
    <div key="s2">
      <p style={{margin:"0 0 16px",fontSize:20,fontWeight:600,color:T.textPrimary}}>Choose your theme</p>
      <ThemePresetPicker
        accentColor={p.accentColor}
        bgColor={p.bgColor}
        onChange={(accent,bg)=>setP(x=>({...x,accentColor:accent,bgColor:bg}))}/>
      <AccentBtn onClick={()=>setStep(3)} style={{marginTop:20}}>Continue →</AccentBtn>
    </div>,

    // ── Step 3: Fixed Commitments ─────────────────────────────────────────────
    <div key="s3">
      <p style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:T.textPrimary}}>Fixed commitments</p>
      <p style={{margin:"0 0 12px",fontSize:13,color:T.textSecondary,lineHeight:1.6}}>
        Insurance, rent, loans — things that go out every month.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {(p.fixedCommitments||[]).map(c=>(
          <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"center"}}>
            <input placeholder="Name (e.g. Insurance)" value={c.name}
              onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,name:e.target.value}:x)}))} style={inp}/>
            <input type="number" placeholder="0" value={c.amount}
              onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,amount:e.target.value}:x)}))} style={{...inp,width:90}}/>
            <button onClick={()=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.filter(x=>x.id!==c.id)}))}
              style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
          </div>
        ))}
      </div>
      <button onClick={()=>setP(v=>({...v,fixedCommitments:[...(v.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:""}]}))}
        style={{padding:"8px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:9,color:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%",marginBottom:16}}>
        + Add commitment
      </button>
      <AccentBtn onClick={finish}>Let's go →</AccentBtn>
      <GhostBtn onClick={finish} style={{marginTop:8,width:"100%",textAlign:"center"}}>Skip for now</GhostBtn>
    </div>
  ];

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
    <div style={{width:"100%",maxWidth:420}}>
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:32}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i===step?T.accent:i<step?T.accentBorder:T.border,transition:"all .3s"}}/>
        ))}
      </div>
      {steps[step]}
    </div>
  </div>;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PART 3 — Main App + Home + Add + Review tabs               ║
// ╚══════════════════════════════════════════════════════════════╝

export default function App(){
  const [pinUnlocked,setPinUnlocked]=useState(false);
  const [pinHash,setPinHash]=useState(()=>lsLoad("pinHash"));
  const [tab,setTab]=useState("home");
  const [selectedMonth,setSelectedMonth]=useState(currentMonth());
  const [profile,setProfile]=useState(null);
  const [monthlyData,setMonthlyData]=useState({});
  const [excludeHistory,setExcludeHistory]=useState({});
  const [catExcludeHistory,setCatExcludeHistory]=useState({});
  const [archive,setArchive]=useState([]);
  const [pendingTxs,setPendingTxs]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [uploadMsg,setUploadMsg]=useState("");
  const [form,setForm]=useState({date:todayStr(),description:"",category:BUILTIN_CATEGORIES[0],amount:""});
  const [insights,setInsights]=useState({text:"",timestamp:null});
  const [loadingInsights,setLoadingInsights]=useState(false);
  const [toast,setToast]=useState("");
  const [quickAddOpen,setQuickAddOpen]=useState(false);
  const [editHintSeen,setEditHintSeen]=useState(false);
  const [catFilter,setCatFilter]=useState("All");
  const [restoreCandidate,setRestoreCandidate]=useState(null);
  const [showReset,setShowReset]=useState(false);
  const [fixedCommitmentDetected,setFixedCommitmentDetected]=useState(null);
  const [recurringDetected,setRecurringDetected]=useState(null);
  const [archiveOpen,setArchiveOpen]=useState(false);
  const fileRef=useRef();
  const restoreRef=useRef();
  const backupTimerRef=useRef(null);
  const isDesktop=useMemo(()=>window.innerWidth>=768,[]);

  // ── Load from localStorage ──────────────────────────────────────────────────
  useEffect(()=>{
    const p=lsLoad("profile"); setProfile(p||DEFAULT_PROFILE);
    const md=lsLoad("monthlyData"); if(md) setMonthlyData(md);
    const eh=lsLoad("excludeHistory"); if(eh) setExcludeHistory(eh);
    const ch=lsLoad("catExcludeHistory"); if(ch) setCatExcludeHistory(ch);
    const ins=lsLoad("insights"); if(ins) setInsights(ins);
    const ehs=lsLoad("editHintSeen"); if(ehs) setEditHintSeen(true);
    const arc=lsLoad("archive"); if(arc) setArchive(arc);
  },[]);

  // ── Enforce startMonth ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(profile?.startMonth&&selectedMonth<profile.startMonth) setSelectedMonth(profile.startMonth);
  },[profile?.startMonth]);

  // ── Auto-backup ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!profile?.onboarded) return;
    clearTimeout(backupTimerRef.current);
    backupTimerRef.current=setTimeout(()=>runAutoBackup(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive),3000);
    return()=>clearTimeout(backupTimerRef.current);
  },[profile,monthlyData,excludeHistory,catExcludeHistory,archive]);

  // ── Theme ───────────────────────────────────────────────────────────────────
  const theme=useMemo(()=>buildTheme(profile?.accentColor||"#C8FF57",profile?.bgColor||"#0C0C12"),[profile?.accentColor,profile?.bgColor]);
  const T=theme;

  // ── Derived ─────────────────────────────────────────────────────────────────
  const CATEGORIES=useMemo(()=>getAllCategories(profile?.customCategories),[profile?.customCategories]);
  const CAT_COLS=useMemo(()=>getAllCatColors(profile?.customCategories),[profile?.customCategories]);
  const fmt=useCallback(n=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; return sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2}); },[profile?.currency]);
  const {mf,cf}=useMemo(()=>habitFlags(excludeHistory,catExcludeHistory),[excludeHistory,catExcludeHistory]);
  const getMD=useCallback(m=>monthlyData[m]||{txs:[],incomeOverrides:{},fixedOverrides:null},[monthlyData]);
  const md=useMemo(()=>getMD(selectedMonth),[getMD,selectedMonth]);
  const committedTxs=useMemo(()=>[...(md.txs||[])].sort((a,b)=>b.date.localeCompare(a.date)),[md.txs]);
  const incomeStreams=profile?.incomeStreams||[];
  const monthIncomeOverrides=md.incomeOverrides||{};
  const monthFixed=useMemo(()=>(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>{
    if(c.startFrom&&selectedMonth<c.startFrom) return false;
    if(c.endMonth&&selectedMonth>c.endMonth) return false;
    return true;
  }),[md,profile,selectedMonth]);
  const monthIncomeTotal=useMemo(()=>totalIncome(incomeStreams,monthIncomeOverrides,selectedMonth),[incomeStreams,monthIncomeOverrides,selectedMonth]);
  const totalVariable=useMemo(()=>committedTxs.reduce((s,t)=>s+t.amount,0),[committedTxs]);
  const totalFixed=useMemo(()=>monthFixed.reduce((s,c)=>s+(+c.amount||0),0),[monthFixed]);
  const saved=monthIncomeTotal-totalVariable-totalFixed;
  const savingsRate=monthIncomeTotal>0?(saved/monthIncomeTotal*100):0;
  const byCategory=useMemo(()=>{ const m={}; committedTxs.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); },[committedTxs]);
  const topCat=byCategory[0];
  const hasImport=!!(monthlyData[selectedMonth]?.txs?.some(t=>t.source==="imported"));
  const pendingVars=useMemo(()=>pendingVariableStreams(incomeStreams,monthIncomeOverrides,selectedMonth),[incomeStreams,monthIncomeOverrides,selectedMonth]);
  const pm=useMemo(()=>prevMonth(selectedMonth),[selectedMonth]);
  const pmd=useMemo(()=>getMD(pm),[getMD,pm]);
  const prevIncomeOverrides=pmd.incomeOverrides||{};
  const prevTotalVariable=useMemo(()=>(pmd.txs||[]).reduce((s,t)=>s+t.amount,0),[pmd]);
  const prevFixed=(pmd.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||pm>=c.startFrom)&&(!c.endMonth||pm<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const prevIncomeTotal=useMemo(()=>totalIncome(incomeStreams,prevIncomeOverrides,pm),[incomeStreams,prevIncomeOverrides,pm]);
  const prevSaved=prevIncomeTotal-prevTotalVariable-prevFixed;
  const avgMonthlySpending=useMemo(()=>{
    const months=Object.entries(monthlyData).filter(([m])=>(!profile?.startMonth||m>=profile.startMonth)&&m!==selectedMonth);
    if(!months.length) return null;
    return months.reduce((s,[,md])=>s+(md.txs||[]).reduce((a,t)=>a+t.amount,0),0)/months.length;
  },[monthlyData,selectedMonth,profile?.startMonth]);
  const fullMonthsCount=useMemo(()=>Object.entries(monthlyData).filter(([m,md])=>{
    if(profile?.startMonth&&m<profile.startMonth) return false;
    return (md.txs||[]).length>0&&totalIncome(incomeStreams,md.incomeOverrides||{},m)>0;
  }).length,[monthlyData,incomeStreams,profile?.startMonth]);
  const checkedCount=pendingTxs.filter(t=>t.checked).length;
  const nudge=useMemo(()=>{
    if(pendingTxs.length>0) return {color:T.warning,title:`${pendingTxs.length} transactions waiting for review`,sub:"Tap to approve",tab:"review"};
    if(pendingVars.length>0) return {color:T.warning,title:"Variable income needs entry",sub:"Tap Add to enter amounts",tab:"add"};
    if(!hasImport) return {color:T.accent,title:`Import ${monthLabel(selectedMonth)} statement`,sub:"Upload your bank statement",tab:"add"};
    if(monthIncomeTotal===0) return {color:T.info,title:"Set up income streams",sub:"Needed to calculate savings rate",tab:"profile"};
    return null;
  },[pendingTxs.length,pendingVars.length,hasImport,monthIncomeTotal,selectedMonth,T]);

  // ── Persistence helpers ─────────────────────────────────────────────────────
  const saveMonthData=async(month,updates)=>{
    const updated={...monthlyData,[month]:{...(monthlyData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),...updates}};
    setMonthlyData(updated); lsSave("monthlyData",updated); return updated;
  };
  const saveProfile=p=>{ setProfile(p); lsSave("profile",p); };
  const saveArchive=arr=>{ setArchive(arr); lsSave("archive",arr); };
  const showToast=msg=>setToast(msg);

  // ── Restore / Reset ─────────────────────────────────────────────────────────
  const handleRestoreFile=e=>{
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=()=>{ try{ const snap=JSON.parse(r.result); if(!snap.version||!snap.profile) throw new Error("Invalid"); setRestoreCandidate(snap); }catch{ showToast("⚠ Invalid backup file"); } };
    r.readAsText(file); e.target.value="";
  };
  const doRestore=snap=>{
    saveProfile(snap.profile||DEFAULT_PROFILE);
    setMonthlyData(snap.monthlyData||{}); lsSave("monthlyData",snap.monthlyData||{});
    setExcludeHistory(snap.excludeHistory||{}); lsSave("excludeHistory",snap.excludeHistory||{});
    setCatExcludeHistory(snap.catExcludeHistory||{}); lsSave("catExcludeHistory",snap.catExcludeHistory||{});
    if(snap.insights){ setInsights(snap.insights); lsSave("insights",snap.insights); }
    if(snap.archive){ saveArchive(snap.archive); }
    setRestoreCandidate(null); showToast("✓ Backup restored"); setTab("home");
  };
  const doReset=()=>{ lsClear(); window.location.reload(); };

  // ── Income override ─────────────────────────────────────────────────────────
  const updateIncomeOverride=async(streamId,amount)=>{
    const updated={...monthIncomeOverrides,[streamId]:amount};
    await saveMonthData(selectedMonth,{incomeOverrides:updated});
  };

  // ── Archive helpers ─────────────────────────────────────────────────────────
  const archiveTx=id=>{
    const tx=(md.txs||[]).find(t=>t.id===id); if(!tx) return;
    saveArchive([{...tx,archivedAt:new Date().toISOString()},...archive].slice(0,500));
    saveMonthData(selectedMonth,{txs:(md.txs||[]).filter(t=>t.id!==id)});
    showToast("Moved to archive");
  };
  const restoreFromArchive=id=>{
    const tx=archive.find(t=>t.id===id); if(!tx) return;
    const{archivedAt:_,...clean}=tx;
    const month=monthKey(clean.date);
    const existing=(monthlyData[month]||{}).txs||[];
    saveMonthData(month,{txs:[clean,...existing]});
    saveArchive(archive.filter(t=>t.id!==id));
    showToast("✓ Restored");
  };

  // ── Commit transactions ─────────────────────────────────────────────────────
  const commitTransactions=async()=>{
    const checked=pendingTxs.filter(t=>t.checked);
    const unchecked=pendingTxs.filter(t=>!t.checked);
    const newEH={...excludeHistory},newCH={...catExcludeHistory};
    unchecked.forEach(t=>{ const k=t.description?.toLowerCase().trim(); newEH[k]=(newEH[k]||0)+1; newCH[t.category]=(newCH[t.category]||0)+1; });
    checked.forEach(t=>{ const k=t.description?.toLowerCase().trim(); if(newEH[k]) newEH[k]=Math.max(0,newEH[k]-1); });
    // Archive unchecked
    const toArchive=unchecked.map(({habitReason:_,checked:__,...t})=>({...t,archivedAt:new Date().toISOString()}));
    saveArchive([...toArchive,...archive].slice(0,500));
    // Commit checked by month
    const byMonth={};
    checked.forEach(t=>{ const m=monthKey(t.date); if(!byMonth[m]) byMonth[m]=[]; byMonth[m].push(t); });
    let totalAdded=0;
    const updatedData={...monthlyData};
    for(const [month,txs] of Object.entries(byMonth)){
      const existing=(updatedData[month]||{}).txs||[];
      const existKeys=new Set(existing.map(t=>`${t.date}|${t.description}|${t.amount}`));
      const fresh=txs.filter(t=>!existKeys.has(`${t.date}|${t.description}|${t.amount}`)).map(({habitReason:_,checked:__,...t})=>t);
      updatedData[month]={...(updatedData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),txs:[...fresh,...existing]};
      totalAdded+=fresh.length;
    }
    setMonthlyData(updatedData); lsSave("monthlyData",updatedData);
    setExcludeHistory(newEH); setCatExcludeHistory(newCH);
    lsSave("excludeHistory",newEH); lsSave("catExcludeHistory",newCH);
    setPendingTxs([]);
    const months=Object.keys(byMonth).sort();
    const monthStr=months.length>1?`${monthLabel(months[0])} – ${monthLabel(months[months.length-1])}`:monthLabel(months[0]||selectedMonth);
    showToast(`✓ ${totalAdded} transactions saved — ${monthStr}`);
    checkRecurring(updatedData);
    setTab("home");
  };

  // ── Recurring detection ─────────────────────────────────────────────────────
  const checkRecurring=useCallback(data=>{
    const months=Object.keys(data).filter(m=>!profile?.startMonth||m>=profile.startMonth);
    if(months.length<2) return;
    const descCount={};
    months.forEach(m=>{ (data[m]?.txs||[]).forEach(t=>{ const k=t.description?.toLowerCase().trim(); if(!descCount[k]) descCount[k]={count:0,amounts:[],description:t.description}; descCount[k].count++; descCount[k].amounts.push(Math.abs(t.amount)); }); });
    const existingNames=new Set((profile?.fixedCommitments||[]).map(c=>c.name?.toLowerCase()));
    const suggestions=Object.values(descCount)
      .filter(({count,description})=>count>=2&&!existingNames.has(description?.toLowerCase()))
      .map(({description,count,amounts})=>({description,count,amount:amounts.reduce((a,b)=>a+b,0)/amounts.length}))
      .slice(0,5);
    if(suggestions.length>0) setRecurringDetected(suggestions);
  },[profile]);

  // ── Edit/delete committed tx ────────────────────────────────────────────────
  const editTx=async draft=>{ await saveMonthData(selectedMonth,{txs:(md.txs||[]).map(t=>t.id===draft.id?draft:t)}); showToast("Updated"); };

  // ── Add manual tx ───────────────────────────────────────────────────────────
  const addManual=async()=>{
    if(!form.description.trim()||!form.amount||isNaN(+form.amount)||+form.amount<=0) return;
    const tx={id:Date.now(),date:form.date,description:form.description.trim(),category:form.category,amount:parseFloat(form.amount),source:"manual"};
    const month=monthKey(form.date);
    if(profile?.startMonth&&month<profile.startMonth){ showToast("⚠ Before your start month"); return; }
    const ex=(monthlyData[month]||{}).txs||[];
    await saveMonthData(month,{txs:[tx,...ex]});
    setForm(f=>({...f,description:"",amount:""}));
    showToast("Transaction added"); setQuickAddOpen(false);
    if(month!==selectedMonth) setSelectedMonth(month);
  };

  // ── Parse chunk helper ──────────────────────────────────────────────────────
  const parseChunk=async(content)=>{
    const prompt=`You are a bank statement parser. Extract ALL transactions without exception — every single line item. Rules:
1. If the amount has "CR" after it, set "isCredit":true. Otherwise "isCredit":false.
2. If a transaction looks like a recurring fixed commitment (insurance, loan repayment, rent, subscription service), use one of these categories: ${FIXED_COMMITMENT_CATEGORIES.map(c=>JSON.stringify(c)).join(",")}.
3. Otherwise use one of: ${CATEGORIES.map(c=>JSON.stringify(c)).join(",")}.
4. Do NOT skip, group, or summarise any transactions.
Return ONLY a valid JSON array. No markdown, no backticks. Each object must have exactly: {"date":"YYYY-MM-DD","description":"cleaned merchant name","amount":positive_number,"isCredit":boolean,"category":string}. Output ONLY the JSON array.`;
    const body=typeof content==="string"
      ?`${prompt}\n\nStatement:\n${content}`
      :[...content,{type:"text",text:prompt}];
    const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:16000,messages:[{role:"user",content:body}]})});
    if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error||`Server error ${res.status}`); }
    const data=await res.json();
    if(data.error) throw new Error(data.error);
    let raw=data.content?.map(b=>b.text||"").join("").trim().replace(/^```json|^```|```$/gm,"").trim();
    if(!raw.endsWith("]")){ const lb=raw.lastIndexOf("}"); if(lb!==-1) raw=raw.slice(0,lb+1)+"]"; }
    return JSON.parse(raw);
  };

  // ── Handle file upload ──────────────────────────────────────────────────────
  const handleFile=async e=>{
    const file=e.target.files[0]; if(!file) return;
    setUploading(true); setUploadMsg("Reading file…");
    try{
      const allExistingKeys=new Set(Object.values(monthlyData).flatMap(md=>(md.txs||[]).map(t=>`${t.date}|${t.description?.toLowerCase()}|${Math.abs(t.amount)}`)));
      let parsed=[];
      const isImage=/^image\//i.test(file.type);
      const isPDF=file.name.toLowerCase().endsWith(".pdf");
      if(isImage||isPDF){
        const base64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
        const mediaType=isImage?file.type:"application/pdf";
        setUploadMsg("Claude is parsing your statement…");
        parsed=await parseChunk([{type:"document",source:{type:"base64",media_type:mediaType,data:base64}}]);
      } else {
        const text=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); });
        const chunks=splitCSVIntoChunks(text,15000);
        for(let i=0;i<chunks.length;i++){
          setUploadMsg(`Parsing part ${i+1} of ${chunks.length}…`);
          const chunkParsed=await parseChunk(chunks[i]);
          parsed=[...parsed,...chunkParsed];
        }
      }
      if(!Array.isArray(parsed)||!parsed.length) throw new Error("No transactions found in statement");
      // Dedup within parsed results
      const seenKeys=new Set();
      parsed=parsed.filter(t=>{
        const k=`${t.date}|${(t.description||"").toLowerCase()}|${Math.abs(parseFloat(t.amount)||0)}`;
        if(seenKeys.has(k)) return false; seenKeys.add(k); return true;
      });
      const fixedDetected=[];
      const imported=parsed.map((t,i)=>{
        const isCredit=!!t.isCredit;
        const amount=isCredit?-(Math.abs(parseFloat(t.amount)||0)):(Math.abs(parseFloat(t.amount)||0));
        const validCats=[...CATEGORIES,...FIXED_COMMITMENT_CATEGORIES];
        const cat=validCats.includes(t.category)?t.category:"📦 Other";
        if(isFixedCommitmentCategory(cat)&&!isCredit){
          fixedDetected.push({id:`fd${i}`,description:t.description||"Unknown",category:cat,rawAmount:Math.abs(amount),date:t.date||todayStr()});
          return null;
        }
        const dupKey=`${t.date}|${(t.description||"").toLowerCase()}|${Math.abs(amount)}`;
        const isDuplicate=allExistingKeys.has(dupKey);
        const reason=habitReason({description:(t.description||"").toLowerCase().trim(),category:cat},mf,cf);
        return {id:Date.now()+i,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:!reason&&!isDuplicate,isDuplicate,habitReason:reason};
      }).filter(Boolean);
      setPendingTxs(imported);
      if(fixedDetected.length>0) setFixedCommitmentDetected(fixedDetected);
      const months=[...new Set(imported.map(t=>monthKey(t.date)))].sort();
      setUploadMsg(`✓ Found ${imported.length} transactions across ${months.length} month${months.length>1?"s":""}`);
      setTab("review");
    }catch(err){
      console.error(err);
      const msg=err.message||"Unknown error";
      if(msg.includes("504")||msg.includes("timeout")) setUploadMsg("⚠ Timed out. Try a smaller file.");
      else if(msg.includes("API key")) setUploadMsg("⚠ API key not configured.");
      else if(msg.includes("No transactions")) setUploadMsg("⚠ No transactions found. Check the file.");
      else setUploadMsg(`⚠ ${msg} [${err.name}]`);
    }
    finally{ setUploading(false); e.target.value=""; setTimeout(()=>setUploadMsg(""),12000); }
  };

  // ── Fixed commitment confirm ─────────────────────────────────────────────────
  const handleFixedCommitmentConfirm=confirmed=>{
    const existing=profile?.fixedCommitments||[];
    const existingNames=new Set(existing.map(c=>c.name?.toLowerCase()));
    const toAdd=confirmed.filter(c=>!existingNames.has(c.description?.toLowerCase())).map(c=>({id:`c${Date.now()}${Math.random()}`,name:c.description,amount:c.rawAmount,startFrom:"",endMonth:""}));
    if(toAdd.length>0){ saveProfile({...profile,fixedCommitments:[...existing,...toAdd]}); showToast(`✓ Added ${toAdd.length} fixed commitment${toAdd.length>1?"s":""}`); }
    setFixedCommitmentDetected(null);
  };

  // ── Recurring confirm ────────────────────────────────────────────────────────
  const handleRecurringConfirm=confirmed=>{
    const existing=profile?.fixedCommitments||[];
    const existingNames=new Set(existing.map(c=>c.name?.toLowerCase()));
    const toAdd=confirmed.filter(s=>!existingNames.has(s.description?.toLowerCase())).map(s=>({id:`c${Date.now()}${Math.random()}`,name:s.description,amount:Math.round(s.amount*100)/100,startFrom:"",endMonth:""}));
    if(toAdd.length>0){ saveProfile({...profile,fixedCommitments:[...existing,...toAdd]}); showToast(`✓ Added ${toAdd.length} recurring commitment${toAdd.length>1?"s":""}`); }
    setRecurringDetected(null);
  };

  // ── Insights ─────────────────────────────────────────────────────────────────
  const generateInsights=async()=>{
    if(fullMonthsCount<3) return;
    setLoadingInsights(true);
    try{
      const histText=Object.entries(monthlyData).filter(([m])=>!profile?.startMonth||m>=profile.startMonth).sort().map(([month,md])=>{
        const txs=md.txs||[]; const inc=totalIncome(incomeStreams,md.incomeOverrides||{},month);
        const total=txs.reduce((s,t)=>s+t.amount,0); const byCat={};
        txs.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
        return `${month} | Income: ${inc} | Spending: ${total.toFixed(2)} | Saved: ${(inc-total).toFixed(2)}\n${Object.entries(byCat).map(([c,a])=>`  ${c}: ${a.toFixed(2)}`).join("\n")}`;
      }).join("\n\n");
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:`You are a personal finance advisor for a Singapore user. Analyse this spending and income data. Give 5-6 specific, actionable insights using actual numbers. Be direct and friendly. Each insight on a separate line.\n\n${histText}`}]})});
      const d=await res.json();
      const text=d.content?.map(b=>b.text||"").join("").trim();
      const newIns={text,timestamp:new Date().toISOString()};
      setInsights(newIns); lsSave("insights",newIns);
    }catch{ setInsights({text:"Couldn't generate insights. Try again.",timestamp:null}); }
    setLoadingInsights(false);
  };

  // ── PIN / Loading screens ────────────────────────────────────────────────────
  const savedAccent=lsLoad("profile")?.accentColor||"#C8FF57";
  const savedBg=lsLoad("profile")?.bgColor||"#0C0C12";
  if((!pinHash&&!pinUnlocked)||( pinHash&&!pinUnlocked)){
    return <ThemeCtx.Provider value={buildTheme(savedAccent,savedBg)}>
      <PinScreen storedHash={pinHash||null} onUnlock={()=>setPinUnlocked(true)}
        onSetup={pin=>{ if(pin){ const h=hashPin(pin); lsSave("pinHash",h); setPinHash(h); } setPinUnlocked(true); }}/>
    </ThemeCtx.Provider>;
  }
  if(!profile){
    return <div style={{minHeight:"100vh",background:"#0C0C12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:savedAccent,fontFamily:"'DM Mono'",marginBottom:8,opacity:.8}}>Welcome back</div>
        <div style={{fontSize:24,fontWeight:600,color:"#EEEAE0",letterSpacing:-0.5}}>Show Me The Money</div>
      </div>
      <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:savedAccent,opacity:.3,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>;
  }
  if(!profile.onboarded){
    return <ThemeCtx.Provider value={buildTheme(profile.accentColor||"#C8FF57",profile.bgColor||"#0C0C12")}>
      <Onboarding onComplete={saveProfile}/>
    </ThemeCtx.Provider>;
  }

  const inpStyle={padding:"9px 12px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:9,color:T.textPrimary,fontFamily:"inherit",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"};
  const hasPending=pendingTxs.length>0;
  const TABS=[["home","🏠","Home"],["add","➕","Add"],["money","💰","Money"],...(hasPending?[["review","📋","Review"]]:[]),["profile","👤","Profile"]];
  const filteredTxs=catFilter==="All"?committedTxs:committedTxs.filter(t=>t.category===catFilter);

  const navItem=([id,icon,label])=>{
    const active=tab===id;
    if(isDesktop) return <button key={id} onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:active?T.accentMuted:"transparent",border:"none",color:active?T.accent:T.textSecondary,fontFamily:"inherit",fontSize:13,fontWeight:active?600:400,cursor:"pointer",width:"100%",textAlign:"left",transition:"all .15s"}}>
      <span style={{fontSize:16}}>{icon}</span>{label}
      {id==="review"&&pendingTxs.length>0&&<span style={{marginLeft:"auto",background:T.accent,color:T.accentText,borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 6px"}}>{pendingTxs.length}</span>}
    </button>;
    return <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 4px",background:"none",border:"none",borderTop:`2px solid ${active?T.accent:"transparent"}`,color:active?T.accent:T.textMuted,fontFamily:"inherit",fontSize:9,fontWeight:active?600:400,cursor:"pointer",position:"relative"}}>
      <span style={{fontSize:18}}>{icon}</span>{label}
      {id==="review"&&pendingTxs.length>0&&<span style={{position:"absolute",top:4,right:"50%",transform:"translateX(120%)",background:T.accent,color:T.accentText,borderRadius:20,fontSize:8,fontWeight:700,padding:"1px 4px"}}>{pendingTxs.length}</span>}
    </button>;
  };

  // ── HOME tab ─────────────────────────────────────────────────────────────────
  const HomeTab=()=><div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
    <Card>
      <p style={{margin:"0 0 4px",fontSize:13,color:T.textSecondary}}>{greeting()}, {(profile.name||"there").split(" ")[0]} 👋</p>
      <p style={{margin:"0 0 12px",fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{monthLabel(selectedMonth)}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>Spent</div>
          <div style={{fontSize:18,fontWeight:600,fontFamily:"'DM Mono'",color:T.negative}}>{fmt(totalVariable)}</div>
          {avgMonthlySpending!==null&&<div style={{fontSize:10,color:totalVariable<=avgMonthlySpending?T.positive:T.negative,fontFamily:"'DM Mono'",marginTop:2}}>
            {totalVariable<=avgMonthlySpending?"-":"+"}{ fmt(Math.abs(totalVariable-avgMonthlySpending))} vs avg
          </div>}
        </div>
        <div style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>Saved</div>
          {monthIncomeTotal===0
            ?<div style={{fontSize:11,color:T.textMuted,marginTop:4,cursor:"pointer"}} onClick={()=>setTab("profile")}>Set up income →</div>
            :<div style={{fontSize:18,fontWeight:600,fontFamily:"'DM Mono'",color:saved>=0?T.positive:T.negative}}>{fmt(saved)}</div>}
        </div>
      </div>
      {monthIncomeTotal>0&&<>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:T.textMuted}}>Savings rate</span>
            <span style={{fontSize:12,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:600}}>{savingsRate.toFixed(1)}%</span>
          </div>
          <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:5,transition:"width .6s ease"}}/>
          </div>
        </div>
        {topCat&&<p style={{margin:0,fontSize:12,color:T.textMuted}}>Top spend: <span style={{color:T.textPrimary}}>{topCat[0]}</span> · <span style={{color:T.accent,fontFamily:"'DM Mono'"}}>{fmt(topCat[1])}</span></p>}
      </>}
    </Card>
    <Card><SLabel>6-Month Overview</SLabel><SixMonthChart monthlyData={monthlyData} incomeStreams={incomeStreams} selectedMonth={selectedMonth} startMonth={profile.startMonth}/></Card>
    {profile.budgets&&Object.keys(profile.budgets).length>0&&(()=>{
      const alerts=byCategory.filter(([cat,amt])=>{ const b=profile.budgets[cat]; return b&&amt>b*0.8; });
      if(!alerts.length) return null;
      return <Card style={{border:`1px solid ${T.warning}40`,background:T.warning+"08"}}>
        <SLabel style={{color:T.warning}}>Budget Alerts</SLabel>
        {alerts.map(([cat,amt])=>{ const b=profile.budgets[cat]; const pct=amt/b*100; return <div key={cat} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.textPrimary}}>{cat}</span><span style={{fontSize:12,fontFamily:"'DM Mono'",color:pct>=100?T.negative:T.warning}}>{fmt(amt)} / {fmt(b)}</span></div>
          <div style={{height:3,background:T.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:pct>=100?T.negative:T.warning,borderRadius:3}}/></div>
        </div>; })}
      </Card>;
    })()}
    {nudge&&<div onClick={()=>setTab(nudge.tab)} style={{background:nudge.color+"12",border:`1px solid ${nudge.color}30`,borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div><div style={{fontSize:13,fontWeight:500,color:nudge.color}}>{nudge.title}</div><div style={{fontSize:12,color:nudge.color,opacity:.7,marginTop:2}}>{nudge.sub}</div></div>
      <span style={{fontSize:18,color:nudge.color,opacity:.6}}>→</span>
    </div>}
    {quickAddOpen?<Card><SLabel>Quick Add</SLabel>
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
        {committedTxs.slice(0,4).map(t=><TxRow key={t.id} tx={t} fmt={fmt} onEdit={editTx} onArchive={archiveTx} customCategories={profile.customCategories}/>)}
      </div>
      {!editHintSeen&&<div style={{marginTop:8,padding:"6px 10px",background:T.accentMuted,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:T.accent}}>Tap ✎ to edit · × to archive</span>
        <button onClick={()=>{ setEditHintSeen(true); lsSave("editHintSeen",true); }} style={{background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:.7}}>Got it ×</button>
      </div>}
    </Card>}
  </div>;

  // ── ADD tab ──────────────────────────────────────────────────────────────────
  const AddTab=()=><div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
    <VariableIncomeEntry streams={incomeStreams} monthOverrides={monthIncomeOverrides} onUpdate={updateIncomeOverride} selectedMonth={selectedMonth}/>
    {incomeStreams.filter(s=>s.active&&s.type==="fixed"&&(!s.startFrom||selectedMonth>=s.startFrom)).length>0&&<Card>
      <SLabel>Fixed Income — Auto-populated</SLabel>
      {incomeStreams.filter(s=>s.active&&s.type==="fixed"&&(!s.startFrom||selectedMonth>=s.startFrom)).map(s=>(
        <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:6,height:6,borderRadius:"50%",background:T.info}}/><span style={{fontSize:13,color:T.textPrimary}}>{s.name}</span></div>
          <EditableAmount value={monthIncomeOverrides[s.id]!==undefined?monthIncomeOverrides[s.id]:s.defaultAmount} fmt={fmt} color={T.info} onSave={v=>updateIncomeOverride(s.id,v)}/>
        </div>
      ))}
    </Card>}
    <Card>
      <SLabel>Import Statement</SLabel>
      <div onClick={()=>!uploading&&fileRef.current.click()}
        onMouseEnter={e=>{ if(!uploading) e.currentTarget.style.borderColor=T.accent+"60"; }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.borderMid; }}
        style={{border:`2px dashed ${T.borderMid}`,borderRadius:12,padding:"28px 16px",textAlign:"center",cursor:uploading?"default":"pointer",transition:"border-color .2s"}}>
        <div style={{fontSize:28,marginBottom:8}}>{uploading?"⏳":"📄"}</div>
        <p style={{margin:"0 0 4px",fontWeight:600,fontSize:14,color:T.textPrimary}}>{uploading?"Importing…":"Upload bank statement"}</p>
        <p style={{margin:"0 0 14px",color:T.textMuted,fontSize:12}}>PDF, CSV, or image · Claude extracts everything · Review before saving</p>
        <div style={{display:"inline-block",padding:"8px 20px",background:uploading?T.border:T.accent,color:uploading?T.textMuted:T.accentText,borderRadius:9,fontWeight:600,fontSize:13}}>{uploading?"Working…":"Choose File"}</div>
        {uploadMsg&&<p style={{marginTop:12,fontSize:12,color:uploadMsg.startsWith("✓")?T.positive:T.negative,margin:"12px 0 0"}}>{uploadMsg}</p>}
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,image/*" style={{display:"none"}} onChange={handleFile}/>
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
    {/* Archive */}
    <div>
      <button onClick={()=>setArchiveOpen(o=>!o)} style={{width:"100%",padding:"10px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:T.textSecondary,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>🗑 Archive ({archive.length} items)</span>
        <span style={{fontSize:11,color:T.textMuted}}>{archiveOpen?"▲":"▼"}</span>
      </button>
      {archiveOpen&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
        {archive.length===0
          ?<p style={{fontSize:13,color:T.textMuted,padding:"12px 0",margin:0}}>No archived transactions yet. Unchecked imports and deleted transactions appear here.</p>
          :archive.slice(0,50).map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,background:T.surface,borderRadius:11,padding:"10px 13px",border:`1px solid ${T.border}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:T.textSecondary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.description}</div>
                <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date} · {t.category?.split(" ")[0]}</div>
              </div>
              <div style={{fontFamily:"'DM Mono'",fontSize:12,color:T.textMuted,flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
              <button onClick={()=>restoreFromArchive(t.id)} style={{padding:"4px 10px",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,borderRadius:7,color:T.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Restore</button>
            </div>
          ))}
      </div>}
    </div>
  </div>;

  // ── REVIEW tab ───────────────────────────────────────────────────────────────
  const ReviewTab=()=>{
    if(pendingTxs.length===0) return <div style={{textAlign:"center",padding:"52px 0",marginTop:20}}><div style={{fontSize:32,marginBottom:12}}>📋</div><p style={{margin:0,fontSize:14,color:T.textSecondary}}>Nothing to review</p></div>;
    const allCats=[...CATEGORIES,...FIXED_COMMITMENT_CATEGORIES];
    const toggleCat=(id,cat)=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,category:cat}:t));
    const toggle=id=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,checked:!t.checked}:t));
    const months=[...new Set(pendingTxs.map(t=>monthKey(t.date)))].sort();
    const isMulti=months.length>1;
    const renderRow=(t,dimmed=false)=>{
      const isCredit=t.amount<0;
      return <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:10,background:T.surface,borderRadius:11,padding:"11px 13px",border:`1px solid ${isCredit?T.positive+"40":dimmed?T.border:T.borderMid}`,opacity:dimmed?0.5:1,boxShadow:T.cardShadow,marginBottom:6}}>
        <Checkbox checked={t.checked} onChange={()=>toggle(t.id)}/>
        <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:(CAT_COLS[t.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{t.category?.split(" ")[0]}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:dimmed?T.textMuted:T.textPrimary,marginBottom:4}}>
            {t.description}
            {t.source==="imported"&&<span style={{marginLeft:6,fontSize:9,color:T.accent,opacity:.5,fontFamily:"'DM Mono'"}}>AI</span>}
            {isCredit&&<span style={{marginLeft:6,fontSize:9,color:T.positive,fontFamily:"'DM Mono'",border:`1px solid ${T.positive}40`,borderRadius:4,padding:"1px 5px"}}>CR</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date}</span>
            <select value={t.category} onChange={e=>toggleCat(t.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{fontSize:11,padding:"1px 4px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:5,color:T.textSecondary,fontFamily:"inherit",cursor:"pointer"}}>{allCats.map(c=><option key={c}>{c}</option>)}</select>
            {t.habitReason&&<span style={{fontSize:10,color:T.accent,opacity:.6,fontFamily:"'DM Mono'",border:`1px solid ${T.accentBorder}`,borderRadius:4,padding:"1px 5px"}}>{t.habitReason}</span>}
            {t.isDuplicate&&<span style={{fontSize:10,color:T.warning,fontFamily:"'DM Mono'",border:`1px solid ${T.warning}40`,borderRadius:4,padding:"1px 5px"}}>possible duplicate</span>}
          </div>
        </div>
        <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:500,color:isCredit?T.positive:dimmed?T.textMuted:T.textPrimary,flexShrink:0}}>{isCredit?"-":""}{fmt(Math.abs(t.amount))}</div>
      </div>;
    };
    return <div style={{marginTop:20,paddingBottom:90}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div><span style={{fontSize:13,color:T.textSecondary}}>{checkedCount}/{pendingTxs.length} selected</span><span style={{marginLeft:10,fontSize:14,color:T.accent,fontFamily:"'DM Mono'"}}>{fmt(pendingTxs.filter(t=>t.checked).reduce((s,t)=>s+t.amount,0))}</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:true})))} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>All</button>
          <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:false})))} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>None</button>
        </div>
      </div>
      {months.map(month=>{
        const mTxs=pendingTxs.filter(t=>monthKey(t.date)===month);
        const allChecked=mTxs.every(t=>t.checked);
        const normal=mTxs.filter(t=>!t.habitReason&&!t.isDuplicate);
        const dupes=mTxs.filter(t=>t.isDuplicate);
        const flagged=mTxs.filter(t=>t.habitReason&&!t.isDuplicate);
        return <div key={month} style={{marginBottom:16}}>
          {isMulti&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <Checkbox checked={allChecked} onChange={()=>setPendingTxs(p=>p.map(t=>monthKey(t.date)===month?{...t,checked:!allChecked}:t))}/>
            <div style={{fontSize:11,fontWeight:600,color:T.accent,fontFamily:"'DM Mono'",letterSpacing:1,textTransform:"uppercase"}}>{monthLabel(month)}</div>
            <div style={{flex:1,height:"1px",background:T.border}}/>
            <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'"}}>{mTxs.filter(t=>t.checked).length}/{mTxs.length}</div>
          </div>}
          {normal.map(t=>renderRow(t))}
          {dupes.length>0&&<>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,marginTop:8}}>
              <span style={{fontSize:10,color:T.warning,fontFamily:"'DM Mono'",whiteSpace:"nowrap"}}>Possible duplicates ({dupes.length})</span>
              <div style={{flex:1,height:"1px",background:T.border}}/>
            </div>
            {dupes.map(t=>renderRow(t,true))}
          </>}
          {flagged.length>0&&<>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,marginTop:8}}>
              <span style={{fontSize:10,color:T.textMuted,fontFamily:"'DM Mono'",whiteSpace:"nowrap"}}>Usually excluded ({flagged.length})</span>
              <div style={{flex:1,height:"1px",background:T.border}}/>
            </div>
            {flagged.map(t=>renderRow(t,true))}
          </>}
        </div>;
      })}
    </div>;
  };

  const renderContent=()=><div style={{maxWidth:isDesktop?640:560,margin:"0 auto",padding:"0 20px"}}>
    {tab==="home"&&<HomeTab/>}
    {tab==="add"&&<AddTab/>}
    {tab==="review"&&<ReviewTab/>}
    {tab==="money"&&<MoneyProfileTabs tab="money" {...{profile,monthlyData,committedTxs,incomeStreams,monthIncomeOverrides,prevIncomeOverrides,monthFixed,monthIncomeTotal,totalVariable,totalFixed,saved,savingsRate,byCategory,filteredTxs,catFilter,setCatFilter,fullMonthsCount,insights,loadingInsights,generateInsights,excludeHistory,setExcludeHistory,catExcludeHistory,setCatExcludeHistory,fmt,inpStyle,editTx,archiveTx,updateIncomeOverride,pm,selectedMonth,T,CATEGORIES,CAT_COLS,saveProfile,showToast}}/>}
    {tab==="profile"&&<MoneyProfileTabs tab="profile" {...{profile,monthlyData,committedTxs,incomeStreams,monthIncomeOverrides,prevIncomeOverrides,monthFixed,monthIncomeTotal,totalVariable,totalFixed,saved,savingsRate,byCategory,filteredTxs,catFilter,setCatFilter,fullMonthsCount,insights,loadingInsights,generateInsights,excludeHistory,setExcludeHistory,catExcludeHistory,setCatExcludeHistory,fmt,inpStyle,editTx,archiveTx,updateIncomeOverride,pm,selectedMonth,T,CATEGORIES,CAT_COLS,saveProfile,showToast}}/>}
  </div>;

  return <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",display:"flex",flexDirection:isDesktop?"row":"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {restoreCandidate&&<RestoreModal backup={restoreCandidate} onConfirm={()=>doRestore(restoreCandidate)} onClose={()=>setRestoreCandidate(null)}/>}
      {showReset&&<ResetModal onConfirm={doReset} onClose={()=>setShowReset(false)} onDownloadFirst={()=>{ downloadBackup(profile,monthlyData,excludeHistory,catExcludeHistory,insights,archive); showToast("Backup downloaded"); }}/>}
      {fixedCommitmentDetected&&<FixedCommitmentModal detected={fixedCommitmentDetected} fmt={fmt} onConfirm={handleFixedCommitmentConfirm} onSkip={()=>setFixedCommitmentDetected(null)}/>}
      {recurringDetected&&<RecurringModal suggestions={recurringDetected} onConfirm={handleRecurringConfirm} onDismiss={()=>setRecurringDetected(null)}/>}
      <input ref={restoreRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestoreFile}/>
      {/* Desktop sidebar */}
      {isDesktop&&<div style={{width:SIDEBAR_WIDTH,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",padding:"24px 12px",position:"fixed",top:0,left:0,bottom:0,zIndex:50}}>
        <div style={{marginBottom:24,padding:"0 4px"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.accent,letterSpacing:-0.3,lineHeight:1.2}}>Show Me<br/>The Money</div>
          {profile.name&&<div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{profile.name}</div>}
        </div>
        <div style={{marginBottom:12,padding:"0 4px"}}>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
          {TABS.map(navItem)}
        </div>
        {profile.avatar&&<img src={profile.avatar} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",marginTop:"auto"}}/>}
      </div>}
      {/* Mobile header */}
      {!isDesktop&&<div style={{padding:"14px 20px 0",borderBottom:`1px solid ${T.border}`,background:T.bg,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {profile.avatar?<img src={profile.avatar} alt="" style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>
              :<div style={{width:30,height:30,borderRadius:"50%",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:T.accent,fontWeight:600}}>{profile.name?profile.name[0].toUpperCase():"?"}</div>}
            <div style={{fontSize:12,fontWeight:700,color:T.accent}}>Show Me The Money</div>
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
        </div>
      </div>}
      {/* Content */}
      <div style={{flex:1,marginLeft:isDesktop?SIDEBAR_WIDTH:0,paddingBottom:isDesktop?40:80,overflowY:"auto"}}>
        {renderContent()}
        {/* Review sticky footer */}
        {tab==="review"&&pendingTxs.length>0&&(()=>{
          const months=[...new Set(pendingTxs.filter(t=>t.checked).map(t=>monthKey(t.date)))].sort();
          const monthStr=months.length>1?`${months.length} months`:monthLabel(months[0]||selectedMonth);
          return <div style={{position:"fixed",bottom:isDesktop?0:60,left:isDesktop?SIDEBAR_WIDTH:0,right:0,padding:"12px 20px 24px",background:`linear-gradient(transparent,${T.bg} 40%)`,zIndex:100}}>
            <div style={{maxWidth:640,margin:"0 auto"}}><AccentBtn onClick={commitTransactions}>Save {checkedCount} transactions → {monthStr}</AccentBtn></div>
          </div>;
        })()}
      </div>
      {/* Mobile bottom nav */}
      {!isDesktop&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:50}}>
        {TABS.map(navItem)}
      </div>}
    </div>
  </ThemeCtx.Provider>;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PART 4 — Money Tab + Profile Tab                           ║
// ╚══════════════════════════════════════════════════════════════╝

function MoneyProfileTabs({tab,profile,monthlyData,committedTxs,incomeStreams,monthIncomeOverrides,prevIncomeOverrides,monthFixed,monthIncomeTotal,totalVariable,totalFixed,saved,savingsRate,byCategory,filteredTxs,catFilter,setCatFilter,fullMonthsCount,insights,loadingInsights,generateInsights,excludeHistory,setExcludeHistory,catExcludeHistory,setCatExcludeHistory,fmt,inpStyle,editTx,archiveTx,updateIncomeOverride,pm,selectedMonth,T,CATEGORIES,CAT_COLS,saveProfile,showToast}){
  if(tab==="money") return <MoneyTab {...{profile,monthlyData,committedTxs,incomeStreams,monthIncomeOverrides,prevIncomeOverrides,monthFixed,monthIncomeTotal,totalVariable,totalFixed,saved,savingsRate,byCategory,filteredTxs,catFilter,setCatFilter,fullMonthsCount,insights,loadingInsights,generateInsights,excludeHistory,setExcludeHistory,catExcludeHistory,setCatExcludeHistory,fmt,inpStyle,editTx,archiveTx,updateIncomeOverride,pm,selectedMonth,T,CATEGORIES,CAT_COLS}}/>;
  return <ProfileTabWrap {...{profile,monthlyData,fmt,inpStyle,saveProfile,showToast,T}}/>;
}

function MoneyTab({profile,monthlyData,committedTxs,incomeStreams,monthIncomeOverrides,prevIncomeOverrides,monthFixed,monthIncomeTotal,totalVariable,totalFixed,saved,savingsRate,byCategory,filteredTxs,catFilter,setCatFilter,fullMonthsCount,insights,loadingInsights,generateInsights,excludeHistory,setExcludeHistory,catExcludeHistory,setCatExcludeHistory,fmt,inpStyle,editTx,archiveTx,updateIncomeOverride,pm,selectedMonth,T,CATEGORIES,CAT_COLS}){
  const CAT_COLS_ALL=getAllCatColors(profile?.customCategories);
  return <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
    {monthIncomeTotal===0&&<div style={{background:T.info+"12",border:`1px solid ${T.info}30`,borderRadius:12,padding:"12px 14px",fontSize:13,color:T.info}}>Set up income streams in Profile to see full breakdown.</div>}
    {/* Summary card */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <SLabel style={{margin:0}}>{monthLabel(selectedMonth)}</SLabel>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>exportMonthlySummaryHTML(selectedMonth,profile,monthlyData[selectedMonth],incomeStreams)} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📄 PDF</button>
          <button onClick={()=>generateShareCard(selectedMonth,profile,monthlyData[selectedMonth],incomeStreams)} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🖼 Share</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12,marginTop:8}}>
        {[["Income",monthIncomeTotal,T.positive],["Fixed",totalFixed,T.info],["Variable",totalVariable,T.negative],["Saved",saved,saved>=0?T.positive:T.negative]].map(([label,val,color])=>(
          <div key={label} style={{background:T.bg,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>{label}</div>
            <div style={{fontSize:15,fontWeight:600,fontFamily:"'DM Mono'",color}}>{monthIncomeTotal===0&&label==="Saved"?"—":fmt(val)}</div>
          </div>
        ))}
      </div>
      {monthIncomeTotal>0&&<>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:11,color:T.textMuted}}>Savings rate</span>
          <span style={{fontSize:12,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:600}}>{savingsRate.toFixed(1)}%</span>
        </div>
        <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:5}}/>
        </div>
        <div style={{height:7,borderRadius:5,overflow:"hidden",display:"flex",gap:1,marginBottom:6}}>
          <div style={{width:`${Math.min(100,totalFixed/monthIncomeTotal*100)}%`,background:T.info,transition:"width .5s"}}/>
          <div style={{width:`${Math.min(100,Math.abs(totalVariable)/monthIncomeTotal*100)}%`,background:T.negative,transition:"width .5s"}}/>
          <div style={{flex:1,background:T.accentMuted}}/>
        </div>
        <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted}}>
          <span><span style={{color:T.info}}>■</span> Fixed</span>
          <span><span style={{color:T.negative}}>■</span> Variable</span>
          <span><span style={{color:T.accent}}>■</span> Saved</span>
        </div>
      </>}
    </Card>
    {/* Income streams */}
    <Card>
      <SLabel>Income Streams</SLabel>
      <IncomeBreakdown streams={incomeStreams} monthOverrides={monthIncomeOverrides} prevMonthOverrides={prevIncomeOverrides} fmt={fmt} selectedMonth={selectedMonth} onUpdateOverride={updateIncomeOverride}/>
    </Card>
    {/* Fixed commitments */}
    <Card>
      <SLabel>Fixed Commitments</SLabel>
      {monthFixed.length===0
        ?<p style={{fontSize:13,color:T.textMuted,margin:0}}>Add in Profile →</p>
        :<div>
          {monthFixed.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
              <div>
                <span style={{fontSize:13,color:T.textSecondary}}>{c.name}</span>
                {c.endMonth&&<span style={{fontSize:10,color:T.textMuted,marginLeft:6}}>until {monthLabelShort(c.endMonth)}</span>}
              </div>
              <EditableAmount value={+c.amount||0} fmt={fmt} color={T.info} onSave={v=>{
                const updated={...profile,fixedCommitments:profile.fixedCommitments.map(x=>x.id===c.id?{...x,amount:v}:x)};
                saveProfile(updated); showToast("Updated");
              }}/>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:4}}>
            <span style={{fontSize:12,color:T.textMuted}}>Total</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.info,fontWeight:600}}>{fmt(totalFixed)}</span>
          </div>
        </div>}
    </Card>
    {/* Variable spending */}
    <Card>
      <SLabel>Variable Spending</SLabel>
      {byCategory.length===0
        ?<p style={{fontSize:13,color:T.textMuted,margin:0}}>No transactions yet for {monthLabel(selectedMonth)}</p>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {byCategory.map(([cat,amt])=>{
            const budget=profile.budgets?.[cat];
            const pct=totalVariable!==0?(Math.abs(amt)/Math.abs(totalVariable)*100):0;
            const budgetPct=budget?amt/budget*100:null;
            return <div key={cat}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,color:T.textPrimary}}>{cat}</span>
                <div style={{textAlign:"right"}}>
                  <span style={{fontFamily:"'DM Mono'",fontSize:13,color:amt<0?T.positive:T.accent}}>{amt<0?"-":""}{fmt(Math.abs(amt))}</span>
                  {budget&&<span style={{fontSize:10,color:budgetPct>=100?T.negative:budgetPct>=80?T.warning:T.textMuted,fontFamily:"'DM Mono'",marginLeft:6}}>/ {fmt(budget)}</span>}
                </div>
              </div>
              <div style={{height:3,background:T.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:CAT_COLS_ALL[cat]||T.accent,borderRadius:3}}/>
              </div>
              {budget&&<div style={{height:2,background:T.border,borderRadius:2,overflow:"hidden",marginTop:1}}>
                <div style={{height:"100%",width:`${Math.min(100,budgetPct||0)}%`,background:budgetPct>=100?T.negative:budgetPct>=80?T.warning:T.info,borderRadius:2}}/>
              </div>}
            </div>;
          })}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${T.border}`}}>
            <span style={{fontSize:12,color:T.textMuted}}>Net variable</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:13,color:totalVariable<0?T.positive:T.negative,fontWeight:600}}>{fmt(totalVariable)}</span>
          </div>
        </div>}
    </Card>
    {/* Goals */}
    {profile.goals?.length>0&&<Card>
      <SLabel>Goals</SLabel>
      {profile.goals.map(g=>{
        const appSaved=Object.values(monthlyData).reduce((s,md)=>{
          const inc=totalIncome(incomeStreams,md.incomeOverrides||{},selectedMonth);
          const spent=(md.txs||[]).reduce((a,t)=>a+t.amount,0);
          const fix=(md.fixedOverrides||profile.fixedCommitments||[]).reduce((a,c)=>a+(+c.amount||0),0);
          return s+Math.max(0,inc-spent-fix);
        },0);
        const totalSaved=appSaved+(g.startingBalance||0);
        const pct=g.target>0?Math.min(100,totalSaved/g.target*100):0;
        const daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/(1000*60*60*24)):null;
        return <div key={g.id} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:13,fontWeight:500,color:T.textPrimary}}>{g.name}</span>
            <span style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{fmt(totalSaved)} / {fmt(g.target)}</span>
          </div>
          <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden",marginBottom:4}}>
            <div style={{height:"100%",width:`${pct}%`,background:T.accent,borderRadius:5}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted}}>
            <span>{pct.toFixed(1)}%{g.startingBalance?` (incl. ${fmt(g.startingBalance)} existing)`:""}</span>
            {daysLeft!=null&&<span style={{color:daysLeft<30?T.warning:T.textMuted}}>{daysLeft>0?`${daysLeft} days left`:"Past due"}</span>}
          </div>
        </div>;
      })}
    </Card>}
    {/* All transactions */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel style={{margin:0}}>Transactions ({filteredTxs.length})</SLabel>
        {committedTxs.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto"}}>
          {["All",...Object.keys(Object.fromEntries(byCategory))].map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)} style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${catFilter===c?T.accent:T.borderMid}`,background:catFilter===c?T.accentMuted:"transparent",color:catFilter===c?T.accent:T.textMuted,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>
              {c==="All"?"All":c.split(" ")[0]}
            </button>
          ))}
        </div>}
      </div>
      {filteredTxs.length===0
        ?<p style={{fontSize:13,color:T.textMuted,margin:0}}>No transactions for {monthLabel(selectedMonth)}</p>
        :<div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filteredTxs.map(t=><TxRow key={t.id} tx={t} onArchive={archiveTx} onEdit={editTx} fmt={fmt} customCategories={profile.customCategories}/>)}
        </div>}
    </Card>
    {/* Insights */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <SLabel>Claude Insights</SLabel>
          <p style={{margin:"4px 0 0",fontSize:11,color:fullMonthsCount>=3?T.positive:T.textMuted}}>
            {fullMonthsCount}/3 full months {fullMonthsCount>=3?"✓":"— unlock after 3 months with income + transactions"}
          </p>
          {insights.timestamp&&<p style={{margin:"4px 0 0",fontSize:11,color:T.textMuted}}>Last: {new Date(insights.timestamp).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>}
        </div>
        <button onClick={generateInsights} disabled={loadingInsights||fullMonthsCount<3}
          style={{padding:"7px 14px",background:"transparent",border:`1px solid ${fullMonthsCount>=3?T.accentBorder:T.border}`,borderRadius:9,color:fullMonthsCount>=3?T.accent:T.textMuted,fontSize:12,fontFamily:"inherit",cursor:fullMonthsCount<3?"default":"pointer",flexShrink:0}}>
          {loadingInsights?"Analysing…":insights.text?"Regenerate":"Generate"}
        </button>
      </div>
      {insights.text?<InsightCards text={insights.text}/>:<p style={{fontSize:13,color:T.textMuted,margin:0}}>{fullMonthsCount<3?"Keep tracking — insights unlock after 3 full months.":"Tap Generate to analyse your patterns."}</p>}
    </Card>
    {/* Habit memory */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <SLabel style={{margin:0}}>Habit Memory</SLabel>
        {(Object.keys(habitFlags(excludeHistory,catExcludeHistory).mf).length>0||Object.keys(habitFlags(excludeHistory,catExcludeHistory).cf).length>0)&&
          <button onClick={()=>{ setExcludeHistory({}); setCatExcludeHistory({}); lsSave("excludeHistory",{}); lsSave("catExcludeHistory",{}); showToast("Habits cleared"); }}
            style={{padding:"3px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.negative,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Clear all</button>}
      </div>
      {Object.keys(habitFlags(excludeHistory,catExcludeHistory).mf).length===0&&Object.keys(habitFlags(excludeHistory,catExcludeHistory).cf).length===0
        ?<p style={{fontSize:13,color:T.textMuted,margin:0}}>No patterns learned yet. Review a few imports and the app will start pre-flagging what you always exclude.</p>
        :<>
          {Object.entries(habitFlags(excludeHistory,catExcludeHistory).mf).map(([desc,count])=>(
            <div key={desc} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
              <div>
                <div style={{fontSize:12,color:T.textPrimary,textTransform:"capitalize"}}>{desc}</div>
                <div style={{fontSize:10,color:T.textMuted}}>excluded {count}× by description</div>
              </div>
              <button onClick={()=>{ const n={...excludeHistory}; delete n[desc]; setExcludeHistory(n); lsSave("excludeHistory",n); }}
                style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
            </div>
          ))}
          {Object.entries(habitFlags(excludeHistory,catExcludeHistory).cf).map(([cat,count])=>(
            <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
              <div>
                <div style={{fontSize:12,color:T.textPrimary}}>{cat}</div>
                <div style={{fontSize:10,color:T.textMuted}}>category excluded {count}×</div>
              </div>
              <button onClick={()=>{ const n={...catExcludeHistory}; delete n[cat]; setCatExcludeHistory(n); lsSave("catExcludeHistory",n); }}
                style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
            </div>
          ))}
        </>}
    </Card>
  </div>;
}

// ── Profile Tab Wrapper ───────────────────────────────────────────────────────
function ProfileTabWrap({profile,monthlyData,fmt,inpStyle,saveProfile,showToast,T}){
  const [showReset,setShowReset]=useState(false);
  const restoreRef=useRef();
  const [restoreCandidate,setRestoreCandidate]=useState(null);
  const handleRestoreFile=e=>{ const file=e.target.files[0];if(!file)return; const r=new FileReader(); r.onload=()=>{try{const snap=JSON.parse(r.result);if(!snap.version||!snap.profile)throw new Error("Invalid");setRestoreCandidate(snap);}catch{showToast("⚠ Invalid backup file");}};r.readAsText(file);e.target.value="";};
  const doRestore=snap=>{ saveProfile(snap.profile||DEFAULT_PROFILE); lsSave("monthlyData",snap.monthlyData||{}); lsSave("excludeHistory",snap.excludeHistory||{}); lsSave("catExcludeHistory",snap.catExcludeHistory||{}); if(snap.insights)lsSave("insights",snap.insights); setRestoreCandidate(null); showToast("✓ Backup restored"); window.location.reload(); };
  return <>
    {restoreCandidate&&<RestoreModal backup={restoreCandidate} onConfirm={()=>doRestore(restoreCandidate)} onClose={()=>setRestoreCandidate(null)}/>}
    {showReset&&<ResetModal onConfirm={()=>{ lsClear(); window.location.reload(); }} onClose={()=>setShowReset(false)} onDownloadFirst={()=>{ downloadBackup(profile,monthlyData,{},{},{text:""},[]); showToast("Backup downloaded"); }}/>}
    <input ref={restoreRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestoreFile}/>
    <ProfileTabInner profile={profile} monthlyData={monthlyData} fmt={fmt} inpStyle={inpStyle} saveProfile={saveProfile} showToast={showToast} T={T} onRestoreFile={()=>restoreRef.current.click()} onReset={()=>setShowReset(true)}/>
  </>;
}

function ProfileTabInner({profile,monthlyData,fmt,inpStyle,saveProfile,showToast,T,onRestoreFile,onReset}){
  const [p,setP]=useState(profile);
  const [btnLabel,setBtnLabel]=useState("Save Profile");
  const avatarRef=useRef();
  useEffect(()=>setP(profile),[profile.name]);

  const handleAvatar=e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement("canvas"); c.width=200; c.height=200; const ctx=c.getContext("2d"); const size=Math.min(img.width,img.height); ctx.drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,200,200); setP(v=>({...v,avatar:c.toDataURL("image/jpeg",0.85)})); }; img.src=ev.target.result; };
    reader.readAsDataURL(f);
  };

  const updateStream=(id,f,v)=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.map(s=>s.id===id?{...s,[f]:v}:s)}));
  const addStream=()=>setP(prev=>({...prev,incomeStreams:[...(prev.incomeStreams||[]),{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true,startFrom:""}]}));
  const removeStream=id=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.filter(s=>s.id!==id)}));
  const updateFixed=(id,f,v)=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const addFixed=()=>setP(prev=>({...prev,fixedCommitments:[...(prev.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:0,startFrom:"",endMonth:""}]}));
  const removeFixed=id=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.filter(c=>c.id!==id)}));
  const updateGoal=(id,f,v)=>setP(prev=>({...prev,goals:prev.goals.map(g=>g.id===id?{...g,[f]:v}:g)}));
  const addGoal=()=>setP(prev=>({...prev,goals:[...(prev.goals||[]),{id:`g${Date.now()}`,name:"",target:0,date:""}]}));
  const removeGoal=id=>setP(prev=>({...prev,goals:prev.goals.filter(g=>g.id!==id)}));
  const addCustomCat=()=>setP(prev=>({...prev,customCategories:[...(prev.customCategories||[]),{id:`cc${Date.now()}`,name:"",emoji:"🏷️",color:"#868E96"}]}));
  const updateCustomCat=(id,f,v)=>setP(prev=>({...prev,customCategories:prev.customCategories.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const removeCustomCat=id=>setP(prev=>({...prev,customCategories:prev.customCategories.filter(c=>c.id!==id)}));
  const CATS=getAllCategories(p.customCategories);
  const handleSave=()=>{ saveProfile({...p,onboarded:true}); setBtnLabel("Saved ✓"); setTimeout(()=>setBtnLabel("Save Profile"),2000); };
  const txCount=countAllTx(monthlyData);
  const moCount=Object.keys(monthlyData).length;
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
        <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Tracking from</div><input type="month" value={p.startMonth||""} onChange={e=>setP(v=>({...v,startMonth:e.target.value}))} style={inpStyle}/></div>
      </div>
    </Card>
    {/* Theme */}
    <Card><ThemePresetPicker accentColor={p.accentColor||"#C8FF57"} bgColor={p.bgColor||"#0C0C12"} onChange={(accent,bg)=>setP(x=>({...x,accentColor:accent,bgColor:bg}))}/></Card>
    {/* Income streams */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Income Streams</SLabel>
        <button onClick={addStream} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      <DraggableList items={p.incomeStreams||[]} onReorder={list=>setP(prev=>({...prev,incomeStreams:list}))} renderItem={s=>(
        <div style={{background:T.surface2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`,marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
            <span style={{color:T.textMuted,cursor:"grab",fontSize:14,userSelect:"none"}}>⠿</span>
            <input type="text" placeholder="Stream name" value={s.name} onChange={e=>updateStream(s.id,"name",e.target.value)} style={inpStyle}/>
            <button onClick={()=>removeStream(s.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:6}}>
            {["fixed","variable","oneoff"].map(t=>(
              <button key={t} onClick={()=>updateStream(s.id,"type",t)} style={{flex:1,padding:"5px 4px",background:s.type===t?typeColor(t):"transparent",border:"none",color:s.type===t?"#fff":T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?600:400}}>
                {t==="oneoff"?"One-off":t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          {s.type==="fixed"&&<input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>updateStream(s.id,"defaultAmount",parseFloat(e.target.value)||0)} style={{...inpStyle,marginBottom:6}}/>}
          {s.type!=="oneoff"
            ?<div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>Active from (blank = app start month)</div><input type="month" value={s.startFrom||""} onChange={e=>updateStream(s.id,"startFrom",e.target.value)} style={inpStyle}/></div>
            :<div><div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>For which month?</div><input type="month" value={s.startFrom||""} onChange={e=>updateStream(s.id,"startFrom",e.target.value)} style={inpStyle}/></div>}
        </div>
      )}/>
      {!(p.incomeStreams||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No income streams yet</p>}
    </Card>
    {/* Fixed commitments */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Fixed Commitments</SLabel>
        <button onClick={addFixed} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      <DraggableList items={p.fixedCommitments||[]} onReorder={list=>setP(prev=>({...prev,fixedCommitments:list}))} renderItem={c=>(
        <div style={{background:T.surface2,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`,marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:7,marginBottom:7,alignItems:"center"}}>
            <span style={{color:T.textMuted,cursor:"grab",fontSize:14,userSelect:"none"}}>⠿</span>
            <input type="text" placeholder="Name (e.g. Insurance)" value={c.name} onChange={e=>updateFixed(c.id,"name",e.target.value)} style={inpStyle}/>
            <input type="number" placeholder="0" value={c.amount||""} onChange={e=>updateFixed(c.id,"amount",parseFloat(e.target.value)||0)} style={{...inpStyle,width:90}}/>
            <button onClick={()=>removeFixed(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            <div><div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>Start from</div><input type="month" value={c.startFrom||""} onChange={e=>updateFixed(c.id,"startFrom",e.target.value)} style={inpStyle}/></div>
            <div><div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>End month (optional)</div><input type="month" value={c.endMonth||""} onChange={e=>updateFixed(c.id,"endMonth",e.target.value)} style={inpStyle}/></div>
          </div>
        </div>
      )}/>
      {!(p.fixedCommitments||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No fixed commitments yet</p>}
    </Card>
    {/* Custom categories */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Custom Categories</SLabel>
        <button onClick={addCustomCat} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      {(p.customCategories||[]).map(c=>(
        <div key={c.id} style={{display:"grid",gridTemplateColumns:"auto auto 1fr auto",gap:7,marginBottom:7,alignItems:"center"}}>
          <input value={c.emoji} onChange={e=>updateCustomCat(c.id,"emoji",e.target.value)} style={{...inpStyle,width:44,textAlign:"center",padding:"9px 4px"}} maxLength={2}/>
          <input type="color" value={c.color||"#868E96"} onChange={e=>updateCustomCat(c.id,"color",e.target.value)} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",background:"transparent",padding:0}}/>
          <input type="text" placeholder="Category name" value={c.name} onChange={e=>updateCustomCat(c.id,"name",e.target.value)} style={inpStyle}/>
          <button onClick={()=>removeCustomCat(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
        </div>
      ))}
      {!(p.customCategories||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No custom categories yet</p>}
    </Card>
    {/* Budgets */}
    <Card>
      <SLabel>Monthly Budgets</SLabel>
      <p style={{margin:"0 0 10px",fontSize:12,color:T.textMuted}}>Optional spending limits per category. Alerts show on Home when you're over 80%.</p>
      {BUILTIN_CATEGORIES.concat((p.customCategories||[]).map(c=>`${c.emoji} ${c.name}`)).map(cat=>(
        <div key={cat} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
          <span style={{fontSize:13,color:T.textSecondary,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat}</span>
          <input type="number" placeholder="No limit" value={p.budgets?.[cat]||""} onChange={e=>setP(v=>({...v,budgets:{...v.budgets,[cat]:parseFloat(e.target.value)||0}}))} style={{...inpStyle,width:110,textAlign:"right"}}/>
        </div>
      ))}
    </Card>
    {/* Goals */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SLabel>Financial Goals</SLabel>
        <button onClick={addGoal} style={{padding:"4px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
      </div>
      {(p.goals||[]).map(g=>(
        <div key={g.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,marginBottom:7,alignItems:"center"}}>
            <input type="text" placeholder="Goal name" value={g.name} onChange={e=>updateGoal(g.id,"name",e.target.value)} style={inpStyle}/>
            <button onClick={()=>removeGoal(g.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
            <input type="number" placeholder="Target amount" value={g.target||""} onChange={e=>updateGoal(g.id,"target",parseFloat(e.target.value)||0)} style={inpStyle}/>
            <input type="date" value={g.date||""} onChange={e=>updateGoal(g.id,"date",e.target.value)} style={inpStyle}/>
          </div>
          <input type="number" placeholder="Starting balance (savings you already have)" value={g.startingBalance||""} onChange={e=>updateGoal(g.id,"startingBalance",parseFloat(e.target.value)||0)} style={inpStyle}/>
          <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>Savings before using this app — counts toward this goal</div>
        </div>
      ))}
      {!(p.goals||[]).length&&<p style={{fontSize:13,color:T.textMuted,margin:0}}>No goals set yet</p>}
    </Card>
    {/* Data & Backup */}
    <Card>
      <SLabel>Data & Backup</SLabel>
      <p style={{margin:"0 0 10px",fontSize:13,color:T.textSecondary}}>{txCount>0?`${txCount} transactions across ${moCount} month${moCount!==1?"s":""}.`:"No data yet."}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button onClick={()=>txCount>0&&exportCSV(monthlyData)} style={{padding:"10px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:txCount>0?T.textSecondary:T.textMuted,fontFamily:"inherit",fontSize:13,cursor:txCount>0?"pointer":"default",textAlign:"left",opacity:txCount>0?1:0.5}}>⬇ Export transactions as CSV</button>
        <button onClick={()=>downloadBackup(profile,monthlyData,{},{},{text:""},[])} style={{padding:"10px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontFamily:"inherit",fontSize:13,cursor:"pointer",textAlign:"left"}}>⬇ Download full backup (JSON)</button>
        <button onClick={onRestoreFile} style={{padding:"10px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontFamily:"inherit",fontSize:13,cursor:"pointer",textAlign:"left"}}>↑ Restore from backup</button>
        <button onClick={()=>{ lsSave("pinHash",null); window.location.reload(); }} style={{padding:"10px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontFamily:"inherit",fontSize:13,cursor:"pointer",textAlign:"left"}}>🔐 Change / Remove PIN</button>
        {(()=>{ const ab=lsLoad("autoBackups")||[]; return ab.length>0&&<div style={{padding:"8px 12px",background:T.surface2,borderRadius:9,fontSize:11,color:T.textMuted}}>Auto-backup: {ab.length} snapshot{ab.length!==1?"s":""} · Last: {new Date(ab[0]?.createdAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>; })()}
      </div>
    </Card>
    <button onClick={handleSave} style={{padding:"13px",background:btnLabel.includes("✓")?T.positive:T.accent,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:600,fontSize:14,color:btnLabel.includes("✓")?"#fff":T.accentText,cursor:"pointer",width:"100%",transition:"background .3s"}}>{btnLabel}</button>
    <div style={{marginBottom:20}}>
      <button onClick={onReset} style={{padding:"12px",background:"transparent",border:`1px solid ${T.negative}40`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:T.negative,cursor:"pointer",width:"100%"}}>Reset Everything & Start Again</button>
    </div>
  </div>;
}
