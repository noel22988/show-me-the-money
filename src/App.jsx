import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { PrivacyModal } from "./Landing.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = ["🍔 Food & Dining","🛒 Groceries","🚗 Transport","🎬 Entertainment","🏥 Health","👕 Shopping","💡 Utilities","✈️ Travel","📦 Other"];
const FIXED_CATS = ["🏠 Rent/Mortgage","💳 Insurance","🏦 Loan Repayment","📱 Subscription","🔒 Investment","💰 Savings Transfer"];
const CAT_COLORS = {"🍔 Food & Dining":"#FF6B6B","🛒 Groceries":"#51CF66","🚗 Transport":"#339AF0","🎬 Entertainment":"#CC5DE8","🏥 Health":"#FF922B","👕 Shopping":"#F06595","💡 Utilities":"#FAB005","✈️ Travel":"#20C997","📦 Other":"#868E96","🏠 Rent/Mortgage":"#60AAFF","💳 Insurance":"#FF6B6B","🏦 Loan Repayment":"#FAB005","📱 Subscription":"#CC5DE8","🔒 Investment":"#51CF66","💰 Savings Transfer":"#20C997"};
const CURRENCIES = ["SGD","USD","MYR","AUD","GBP","EUR","JPY","HKD","THB","IDR"];
const CURRENCY_SYMBOLS = {"SGD":"S$","USD":"$","MYR":"RM","AUD":"A$","GBP":"£","EUR":"€","JPY":"¥","HKD":"HK$","THB":"฿","IDR":"Rp"};

const MAX_AUTO_BACKUPS = 7;
const APP_VERSION = "3.1";
const SIDEBAR_W = 260;
const DARK_PRESETS = [{name:"Midnight",accent:"#C8FF57",bg:"#0C0C12"},{name:"Ocean",accent:"#60AAFF",bg:"#0A1628"},{name:"Noir",accent:"#FF6B9D",bg:"#1A0812"}];
const LIGHT_PRESETS = [{name:"Slate",accent:"#5C5FEF",bg:"#F0F2F5"},{name:"Sage",accent:"#2D7D4F",bg:"#F2F5F0"},{name:"Sand",accent:"#C45E00",bg:"#FAF5EE"}];

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const monthKey = d => d.slice(0,7);
const currentMonth = () => monthKey(todayStr());
const monthLabel = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"long",year:"numeric"}); } catch { return m; }};
const monthLabelShort = m => { try { const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("en-SG",{month:"short",year:"2-digit"}); } catch { return m; }};
const prevMonth = m => { const [y,mo]=m.split("-"); const d=new Date(+y,+mo-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const greeting = () => { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };
const monthsBetween = (a,b) => { const [ay,am]=a.split("-").map(Number); const [by,bm]=b.split("-").map(Number); return (by-ay)*12+(bm-am); };

const DEFAULT_PROFILE = {
  name:"",occupation:"",currency:"SGD",avatar:"",
  incomeStreams:[],fixedCommitments:[],goals:[],
  customCategories:[],budgets:{},
  onboarded:false,accentColor:"#C8FF57",bgColor:"#0C0C12",
  startMonth:currentMonth()
};

// ── Storage ───────────────────────────────────────────────────────────────────
function lsLoad(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } }
function lsSave(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ console.error(e); } }
function lsClear(){ ["profile","monthlyData","excludeHistory","catExcludeHistory","insights","autoBackups","editHintSeen","archive","pinHash"].forEach(k=>{ try{localStorage.removeItem(k);}catch(e){} }); }
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
  const bg=bgRaw||"#0C0C12"; const {hex:accent}=ensureContrast(accentRaw||"#C8FF57",bg); const light=isLight(bg);
  const surface=light?mixHex(bg,"#000000",0.07):mixHex(bg,"#ffffff",0.07);
  const surface2=light?mixHex(bg,"#000000",0.04):mixHex(bg,"#ffffff",0.04);
  const border=light?mixHex(bg,"#000000",0.14):mixHex(bg,"#ffffff",0.1);
  const borderMid=light?mixHex(bg,"#000000",0.22):mixHex(bg,"#ffffff",0.16);
  const textPrimary=light?"#111118":"#EEEAE0"; const textSecondary=light?"#4A4A5A":"#888898"; const textMuted=light?"#8A8A9A":"#555568";
  const accentText=isLight(accent)?"#0C0C12":"#FFFFFF";
  const positive=light?"#1A7A40":"#51CF66"; const negative=light?"#C0202A":"#FF6B6B";
  const warning=light?"#A06800":"#FAB005"; const info=light?"#1060B0":"#60AAFF";
  const cardShadow=light?"0 2px 10px rgba(0,0,0,0.08)":"0 2px 10px rgba(0,0,0,0.3)";
  return {bg,surface,surface2,border,borderMid,accent,accentText,accentMuted:accent+"22",accentBorder:accent+"44",positive,negative,warning,info,textPrimary,textSecondary,textMuted,bgLight:light,cardShadow};
}
const ThemeCtx = createContext(buildTheme("#C8FF57","#0C0C12"));
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
  return getMonthStreams(streams,ov,month).reduce((s,{amount})=>s+(amount||0),0)+((ov||{}).__extra__||0);
}
function pendingVarStreams(streams,ov,month){
  return getMonthStreams(streams,ov,month).filter(({stream,amount})=>(stream.type==="variable"||stream.type==="oneoff")&&amount===null);
}

// ── Habit helpers ─────────────────────────────────────────────────────────────
const HABIT_THRESHOLD = 1; // show in habit memory after being unchecked just once
function habitFlags(eh,ch){
  const mf={},cf={};
  for(const [k,v] of Object.entries(eh||{})){
    const count=typeof v==="object"?v.count:v; // handle old format
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
function exportMonthHTML(month,profile,md,streams){
  const txs=md?.txs||[]; const inc=totalIncome(streams,md?.incomeOverrides||{},month);
  const spent=txs.reduce((s,t)=>s+t.amount,0);
  const fixed=(md?.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||month>=c.startFrom)&&(!c.endMonth||month<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const saved=inc-spent-fixed; const rate=inc>0?(saved/inc*100):0;
  const byCat={}; txs.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; const f=n=>sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2});
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Summary – ${monthLabel(month)}</title><style>*{box-sizing:border-box;}body{font-family:'Helvetica Neue',Helvetica,sans-serif;max-width:700px;margin:48px auto;padding:24px 32px;color:#111;line-height:1.5;}h1{font-size:28px;font-weight:700;margin:0 0 4px;}p.sub{color:#888;font-size:15px;margin:0 0 36px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;}.card{border:1px solid #e5e5e5;border-radius:14px;padding:20px;}.lbl{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}.val{font-size:28px;font-weight:700;font-family:monospace;}.green{color:#1A7A40;}.red{color:#C0202A;}.blue{color:#1060B0;}.bar-wrap{background:#f0f0f0;border-radius:6px;height:8px;margin-top:10px;overflow:hidden;}.bar{height:100%;border-radius:6px;}table{width:100%;border-collapse:collapse;margin-top:24px;}th{font-size:11px;color:#999;text-align:left;padding:10px 0;border-bottom:2px solid #eee;letter-spacing:1px;}td{padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:14px;}.footer{margin-top:48px;font-size:12px;color:#ccc;text-align:center;}@media print{body{margin:0;}.footer button{display:none;}}</style></head><body>
<h1>${monthLabel(month)}</h1><p class="sub">Financial Summary · ${profile?.name||""}</p>
<div class="grid"><div class="card"><div class="lbl">Income</div><div class="val green">${f(inc)}</div></div><div class="card"><div class="lbl">Fixed Commitments</div><div class="val blue">${f(fixed)}</div></div><div class="card"><div class="lbl">Variable Spending</div><div class="val red">${f(spent)}</div></div><div class="card"><div class="lbl">Saved</div><div class="val ${saved>=0?"green":"red"}">${f(saved)}</div></div></div>
<div class="card"><div class="lbl">Savings Rate</div><div class="val ${rate>=20?"green":rate>=10?"":"red"}">${rate.toFixed(1)}%</div><div class="bar-wrap"><div class="bar" style="width:${Math.min(100,Math.max(0,rate))}%;background:${rate>=20?"#1A7A40":rate>=10?"#A06800":"#C0202A"}"></div></div></div>
<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>${top.map(([cat,amt])=>`<tr><td>${cat}</td><td style="text-align:right;font-family:monospace">${f(amt)}</td></tr>`).join("")}</tbody></table>
<div class="footer">Generated by $how Me The Money · ${new Date().toLocaleDateString("en-SG")}</div>
<script>window.onload=()=>window.print();</script></body></html>`;
  const blob=new Blob([html],{type:"text/html"}); const url=URL.createObjectURL(blob); window.open(url,"_blank"); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function makeShareCard(month,profile,md,streams){
  const txs=md?.txs||[]; const inc=totalIncome(streams,md?.incomeOverrides||{},month);
  const spent=txs.reduce((s,t)=>s+t.amount,0);
  const fixed=(md?.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||month>=c.startFrom)&&(!c.endMonth||month<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const saved=inc-spent-fixed; const rate=inc>0?(saved/inc*100):0;
  const byCat={}; txs.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; const f=n=>sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2});
  const accent=profile?.accentColor||"#C8FF57"; const bg=profile?.bgColor||"#0C0C12"; const tc=isLight(bg)?"#111118":"#EEEAE0";
  const canvas=document.createElement("canvas"); canvas.width=960; canvas.height=520; const ctx=canvas.getContext("2d");
  ctx.fillStyle=bg; ctx.fillRect(0,0,960,520);
  ctx.fillStyle=accent+"18"; ctx.fillRect(0,0,960,520);
  ctx.fillStyle=accent; ctx.fillRect(0,0,8,520);
  ctx.fillStyle=accent; ctx.font="bold 15px Helvetica"; ctx.fillText("SHOW ME THE MONEY",40,46);
  ctx.fillStyle=tc; ctx.font="bold 34px Helvetica"; ctx.fillText(monthLabel(month),40,94);
  if(profile?.name){ctx.fillStyle=tc+"70"; ctx.font="15px Helvetica"; ctx.fillText(profile.name,40,118);}
  const boxes=[["Spent",f(spent),"#FF6B6B"],["Saved",f(saved),saved>=0?"#51CF66":"#FF6B6B"],["Rate",rate.toFixed(1)+"%",rate>=20?"#51CF66":rate>=10?"#FAB005":"#FF6B6B"]];
  boxes.forEach(([label,val,col],i)=>{
    const x=40+i*298,y=156;
    ctx.fillStyle=tc+"0E";
    try{ ctx.beginPath(); ctx.roundRect(x,y,278,126,14); ctx.fill(); }catch(e){ ctx.fillRect(x,y,278,126); }
    ctx.fillStyle=tc+"60"; ctx.font="11px Helvetica"; ctx.fillText(label.toUpperCase(),x+18,y+27);
    ctx.fillStyle=col; ctx.font="bold 30px Helvetica"; ctx.fillText(val,x+18,y+76);
  });
  const bY=330,bW=880;
  ctx.fillStyle=tc+"14";
  try{ ctx.beginPath(); ctx.roundRect(40,bY,bW,12,6); ctx.fill(); }catch(e){ ctx.fillRect(40,bY,bW,12); }
  const fw=Math.min(bW,Math.max(0,(rate/100)*bW));
  ctx.fillStyle=rate>=20?"#51CF66":rate>=10?"#FAB005":"#FF6B6B";
  try{ ctx.beginPath(); ctx.roundRect(40,bY,fw,12,6); ctx.fill(); }catch(e){ ctx.fillRect(40,bY,fw,12); }
  ctx.fillStyle=tc+"80"; ctx.font="14px Helvetica"; ctx.fillText(`Savings rate: ${rate.toFixed(1)}%`,40,364);
  if(topCat){ctx.fillStyle=tc+"55"; ctx.fillText(`Top spend: ${topCat[0]} · ${f(topCat[1])}`,40,388);}
  ctx.fillStyle=accent+"55"; ctx.font="12px Helvetica"; ctx.fillText("showmethemoney.app",40,470);
  canvas.toBlob(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`smtm-${month}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);},"image/png");
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function useInp(){ const T=useTheme(); return {padding:"11px 14px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}; }
function Card({children,style}){ const T=useTheme(); return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"22px",boxShadow:T.cardShadow,...style}}>{children}</div>; }
function SLabel({children,style}){ const T=useTheme(); return <p style={{margin:"0 0 10px",fontSize:11,letterSpacing:2,color:T.textMuted,textTransform:"uppercase",fontFamily:"'DM Mono'",...style}}>{children}</p>; }
function Btn({children,onClick,disabled,variant="accent",size="md",style}){
  const T=useTheme();
  const bg=variant==="accent"?(disabled?T.border:T.accent):variant==="ghost"?"transparent":variant==="danger"?T.negative:T.surface;
  const col=variant==="accent"?(disabled?T.textMuted:T.accentText):variant==="ghost"?T.textSecondary:variant==="danger"?"#fff":T.textSecondary;
  const border=variant==="ghost"?`1px solid ${T.border}`:variant==="soft"?`1px solid ${T.border}`:"none";
  const pad=size==="sm"?"8px 14px":"12px 20px";
  return <button onClick={onClick} disabled={disabled} style={{padding:pad,background:bg,border,borderRadius:11,fontFamily:"inherit",fontWeight:600,fontSize:size==="sm"?13:14,color:col,cursor:disabled?"default":"pointer",width:"100%",...style}}>{children}</button>;
}
function Check({checked,onChange}){ const T=useTheme(); return <div onClick={onChange} style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${checked?T.accent:T.borderMid}`,background:checked?T.accentMuted:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>{checked&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>; }
function Toast({msg,onDone}){ const T=useTheme(); useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:96,left:"50%",transform:"translateX(-50%)",background:T.accent,color:T.accentText,borderRadius:24,padding:"10px 26px",fontSize:14,fontWeight:600,zIndex:2999,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 4px 24px rgba(0,0,0,0.25)"}}>{msg}</div>; }

// ── LogoAnimation — typewriter logo ↔ "you've saved X since we started" ───────
function LogoAnimation({allTimeSaved,fmt,compact}){
  const T=useTheme();
  // phases: "typing-show" → "typing-money" → "hold-logo" → "fade-out-logo" → "counting" → "hold-number" → "fade-out-number" → repeat
  const LOGO_LINE1="$how Me";
  const LOGO_LINE2=compact?"The Money":" The Money";
  const FULL_LOGO=compact?"$how Me The Money":null;
  const hasData=allTimeSaved>0;
  const [phase,setPhase]=useState("typing");
  const [typed,setTyped]=useState("");
  const [countVal,setCountVal]=useState(0);
  const [opacity,setOpacity]=useState(1);
  const rafRef=useRef(null); const timerRef=useRef(null);

  const fullText=compact?FULL_LOGO:(LOGO_LINE1+"||"+LOGO_LINE2);

  const runTypewriter=useCallback((text,onDone,speed=38)=>{
    let i=0;
    const tick=()=>{ i++; setTyped(text.slice(0,i)); if(i<text.length) timerRef.current=setTimeout(tick,speed); else onDone(); };
    timerRef.current=setTimeout(tick,speed);
  },[]);

  const runCountUp=(target,onDone,duration=800)=>{
    const start=performance.now();
    const tick=now=>{
      const p=Math.min((now-start)/duration,1);
      const eased=1-Math.pow(1-p,3);
      setCountVal(target*eased);
      if(p<1) rafRef.current=requestAnimationFrame(tick); else{ setCountVal(target); onDone(); }
    };
    rafRef.current=requestAnimationFrame(tick);
  };

  useEffect(()=>{
    let cancelled=false;
    const cleanup=()=>{ cancelled=true; clearTimeout(timerRef.current); cancelAnimationFrame(rafRef.current); };

    const cycle=()=>{
      if(cancelled) return;
      // Phase 1: type logo
      setPhase("logo"); setTyped(""); setOpacity(1);
      runTypewriter(fullText,()=>{
        if(cancelled) return;
        // Phase 2: hold logo
        timerRef.current=setTimeout(()=>{
          if(cancelled) return;
          if(!hasData){
            // no data — just fade and retype
            setOpacity(0);
            timerRef.current=setTimeout(()=>{ if(!cancelled) cycle(); },400);
            return;
          }
          // Phase 3: fade out logo
          setOpacity(0);
          timerRef.current=setTimeout(()=>{
            if(cancelled) return;
            // Phase 4: count up number
            setPhase("number"); setOpacity(1); setCountVal(0);
            runCountUp(allTimeSaved,()=>{
              if(cancelled) return;
              // Phase 5: hold number
              timerRef.current=setTimeout(()=>{
                if(cancelled) return;
                // Phase 6: fade out number
                setOpacity(0);
                timerRef.current=setTimeout(()=>{ if(!cancelled) cycle(); },400);
              },2200);
            });
          },350);
        },2000);
      });
    };
    cycle();
    return cleanup;
  },[allTimeSaved,hasData,fullText]);

  const sym=CURRENCY_SYMBOLS[T.bgLight?"SGD":"SGD"];

  if(phase==="logo"){
    const parts=typed.split("||");
    return <div style={{opacity,transition:"opacity 0.35s ease",minHeight:compact?20:38}}>
      {compact
        ?<div style={{fontSize:14,fontWeight:800,color:T.accent,letterSpacing:-0.3,fontFamily:"inherit"}}>{typed}<span style={{opacity:0.4,animation:"blink .7s step-end infinite"}}>|</span></div>
        :<>
          <div style={{fontSize:15,fontWeight:800,color:T.accent,letterSpacing:-0.3,lineHeight:1.2}}>{parts[0]||""}</div>
          <div style={{fontSize:15,fontWeight:800,color:T.accent,letterSpacing:-0.3,lineHeight:1.2}}>{parts[1]||""}<span style={{opacity:0.4,animation:"blink .7s step-end infinite"}}>|</span></div>
        </>}
      <style>{`@keyframes blink{0%,100%{opacity:.4}50%{opacity:0}}`}</style>
    </div>;
  }

  // number phase
  const absVal=Math.abs(countVal);
  const formatted=CURRENCY_SYMBOLS["SGD"]+absVal.toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2});
  return <div style={{opacity,transition:"opacity 0.35s ease",minHeight:compact?20:38}}>
    <div style={{fontSize:compact?12:13,color:T.textSecondary,lineHeight:1.5,fontFamily:"inherit",fontWeight:400}}>
      you've saved <span style={{color:T.accent,fontWeight:700,fontFamily:"'DM Mono'"}}>{formatted}</span><br/>since we started
    </div>
  </div>;
}

// ── CountUp — animates a number from 0 to target on mount/change ──────────────
function CountUp({value,format,duration=900}){
  const [display,setDisplay]=useState(0);
  const prev=useRef(0); const raf=useRef(null);
  useEffect(()=>{
    const start=prev.current; const end=value; const startTime=performance.now();
    const tick=now=>{
      const elapsed=now-startTime; const progress=Math.min(elapsed/duration,1);
      // ease-out cubic
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
  if(ed) return <input type="number" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus style={{width:110,padding:"5px 10px",background:T.surface2,border:`1px solid ${T.accent}`,borderRadius:8,color:T.textPrimary,fontFamily:"'DM Mono'",fontSize:14,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter"){onSave(parseFloat(draft)||0);setEd(false);}if(e.key==="Escape")setEd(false);}} onBlur={()=>{onSave(parseFloat(draft)||0);setEd(false);}}/>;
  return <div onClick={()=>{setDraft(Math.abs(value).toString());setEd(true);}} style={{fontFamily:"'DM Mono'",fontSize:14,color:color||T.textPrimary,cursor:"pointer",borderBottom:`1px dashed ${T.borderMid}`,paddingBottom:1,fontWeight:600}}>{fmt(value)}</div>;
}

// ── Theme preset picker ───────────────────────────────────────────────────────
function ThemePresets({accentColor,bgColor,onChange}){
  const T=useTheme();
  const rp=p=>{ const active=p.accent===accentColor&&p.bg===bgColor; return <div key={p.name} onClick={()=>onChange(p.accent,p.bg)} style={{borderRadius:12,overflow:"hidden",border:`2px solid ${active?T.accent:T.border}`,cursor:"pointer",transition:"border-color .15s"}}>
    <div style={{background:p.bg,padding:"14px"}}><div style={{width:18,height:18,borderRadius:"50%",background:p.accent,marginBottom:7}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.5,marginBottom:3}}/><div style={{height:2,background:p.accent,borderRadius:2,opacity:.2,width:"55%"}}/></div>
    <div style={{background:isLight(p.bg)?mixHex(p.bg,"#000000",0.05):mixHex(p.bg,"#ffffff",0.05),padding:"6px 10px",fontSize:11,color:isLight(p.bg)?"#555":"#aaa",fontFamily:"'DM Mono'"}}>{p.name}</div>
  </div>; };
  return <div><SLabel>Theme</SLabel>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:8,fontFamily:"'DM Mono'",letterSpacing:1}}>DARK</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>{DARK_PRESETS.map(rp)}</div>
    <div style={{fontSize:11,color:T.textMuted,marginBottom:8,fontFamily:"'DM Mono'",letterSpacing:1}}>LIGHT</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{LIGHT_PRESETS.map(rp)}</div>
  </div>;
}

// ── DragList ──────────────────────────────────────────────────────────────────
function DragList({items,onReorder,renderItem}){
  const T=useTheme();
  const move=(i,dir)=>{ const a=[...items]; const j=i+dir; if(j<0||j>=a.length) return; [a[i],a[j]]=[a[j],a[i]]; onReorder(a); };
  return <div>{(items||[]).map((item,i)=>{
    const isFirst=i===0; const isLast=i===items.length-1;
    const stepper=items.length>1&&<div style={{display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden",flexShrink:0}}>
      <button onClick={()=>move(i,-1)} style={{background:"none",border:"none",cursor:isFirst?"default":"pointer",color:isFirst?T.border:T.textMuted,width:22,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,borderBottom:`1px solid ${T.border}`,padding:0,lineHeight:1}}>⌃</button>
      <button onClick={()=>move(i,1)} style={{background:"none",border:"none",cursor:isLast?"default":"pointer",color:isLast?T.border:T.textMuted,width:22,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,padding:0,lineHeight:1}}>⌄</button>
    </div>;
    return <div key={item.id||i}>{renderItem(item,i,stepper)}</div>;
  })}</div>;
}

// ── MonthPicker — positions relative to its own button ────────────────────────
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
  return <div style={{position:"relative",display:"inline-block"}}>
    <button ref={btnRef} onClick={()=>setOpen(o=>!o)} style={{padding:"9px 16px",background:T.surface,border:`1px solid ${T.borderMid}`,borderRadius:10,color:T.accent,fontFamily:"'DM Mono'",fontSize:13,cursor:"pointer",whiteSpace:"nowrap",fontWeight:600}}>{monthLabel(value)} ▾</button>
    {open&&<><div style={{position:"fixed",inset:0,zIndex:299}} onClick={()=>setOpen(false)}/>
      <div ref={dropRef} style={{position:"fixed",top:pos.top,left:pos.left,right:pos.right,background:T.surface,border:`1px solid ${T.borderMid}`,borderRadius:14,zIndex:300,maxHeight:300,overflowY:"auto",minWidth:240,boxShadow:"0 16px 48px rgba(0,0,0,0.35)"}}>
        <div style={{padding:"10px"}}><input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&/^\d{4}-\d{2}$/.test(typed)&&(!startMonth||typed>=startMonth)){onChange(typed);setOpen(false);}}} placeholder="YYYY-MM" style={{...inp,fontSize:13,padding:"9px 12px"}}/></div>
        {months.map(m=><div key={m} onClick={()=>{onChange(m);setOpen(false);}} style={{padding:"10px 18px",fontSize:13,color:m===value?T.accent:T.textSecondary,cursor:"pointer",fontFamily:"'DM Mono'",background:m===value?T.accentMuted:"transparent"}}>{monthLabel(m)}</div>)}
      </div></>}
  </div>;
}

function SixMonthChart({monthlyData,incomeStreams,selectedMonth,startMonth,fixedCommitments}){
  const T=useTheme();
  const months=useMemo(()=>{ const r=[]; let m=selectedMonth; for(let i=0;i<6;i++){if(startMonth&&m<startMonth)break;r.unshift(m);m=prevMonth(m);} return r; },[selectedMonth,startMonth]);
  const data=useMemo(()=>months.map(m=>{
    const md=monthlyData[m]||{}; const txs=md.txs||[];
    const inc=totalIncome(incomeStreams,md.incomeOverrides||{},m);
    const fixed=(md.fixedOverrides||fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
    const variable=Math.abs(txs.reduce((s,t)=>s+t.amount,0));
    const saved=Math.max(0,inc-fixed-variable);
    return {m,inc,fixed,variable,saved,hasIncome:inc>0};
  }),[months,monthlyData,incomeStreams,fixedCommitments]);
  const maxVal=useMemo(()=>Math.max(...data.map(d=>d.fixed+d.variable+d.saved),1),[data]);
  const barH=100;
  return <div>
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:barH,marginBottom:8}}>
      {data.map(({m,inc,fixed,variable,saved})=>{
        const isCur=m===selectedMonth;
        const scale=(barH-14)/maxVal;
        const fixH=Math.max(fixed>0?1:0,fixed*scale);
        const varH=Math.max(variable>0?1:0,variable*scale);
        const savH=Math.max(saved>0?1:0,saved*scale);
        return <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:barH-14,gap:0,overflow:"hidden",outline:isCur?`1.5px solid ${T.accent}40`:"none"}}>
            {saved>0&&<div style={{background:T.positive,height:savH,transition:"height .5s ease",flexShrink:0}}/>}
            {variable>0&&<div style={{background:T.negative,height:varH,transition:"height .5s ease",flexShrink:0}}/>}
            {fixed>0&&<div style={{background:T.info,height:fixH,transition:"height .5s ease",flexShrink:0}}/>}
          </div>
          <div style={{fontSize:9,color:isCur?T.accent:T.textMuted,fontFamily:"'DM Mono'",fontWeight:isCur?700:400,whiteSpace:"nowrap"}}>{monthLabelShort(m)}</div>
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:12,fontSize:11,color:T.textMuted,flexWrap:"wrap"}}>
      <span><span style={{color:T.info}}>■</span> Fixed</span>
      <span><span style={{color:T.negative}}>■</span> Variable</span>
      <span><span style={{color:T.positive}}>■</span> Saved</span>
    </div>
  </div>;
}

// ── InsightCards ──────────────────────────────────────────────────────────────
// ── CompactTxRow — simple editable row matching archive style ─────────────────
function CompactTxRow({tx,onArchive,onEdit,fmt,customCategories}){
  const T=useTheme(); const inp=useInp();
  const CATS=getAllCats(customCategories); const COLS=getAllCatCols(customCategories);
  const [editing,setEditing]=useState(false); const [draft,setDraft]=useState(tx);
  useEffect(()=>setDraft(tx),[tx.id]);
  const isCredit=tx.amount<0;
  if(editing) return <div style={{background:T.surface,borderRadius:12,padding:"12px",border:`1px solid ${T.accent}60`,marginBottom:2}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <input value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} style={{...inp,gridColumn:"1/-1",padding:"8px 12px",fontSize:13}} placeholder="Description"/>
      <input type="number" value={Math.abs(draft.amount)} onChange={e=>setDraft(d=>({...d,amount:isCredit?-(parseFloat(e.target.value)||0):(parseFloat(e.target.value)||0)}))} style={{...inp,padding:"8px 12px",fontSize:13}} placeholder="Amount"/>
      <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={{...inp,padding:"8px 12px",fontSize:13}}/>
      <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))} style={{...inp,gridColumn:"1/-1",padding:"8px 12px",fontSize:13}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
    </div>
    <div style={{display:"flex",gap:8}}><Btn onClick={()=>{onEdit(draft);setEditing(false);}} style={{padding:"8px",fontSize:12}}>Save</Btn><Btn variant="ghost" onClick={()=>setEditing(false)} style={{padding:"8px",fontSize:12,flex:1}}>Cancel</Btn></div>
  </div>;
  return <div style={{display:"flex",alignItems:"center",gap:10,background:T.surface,borderRadius:12,padding:"10px 14px",border:`1px solid ${isCredit?T.positive+"40":T.border}`}}>
    <span style={{fontSize:16,flexShrink:0}}>{tx.category?.split(" ")[0]}</span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:T.textPrimary}}>{tx.description}{isCredit&&<span style={{marginLeft:6,fontSize:10,color:T.positive,fontFamily:"'DM Mono'",border:`1px solid ${T.positive}40`,borderRadius:4,padding:"1px 5px"}}>CR</span>}</div>
      <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",marginTop:1}}>{tx.date}</div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:13,fontWeight:600,color:isCredit?T.positive:T.textPrimary,flexShrink:0}}>{isCredit?"-":""}{fmt(Math.abs(tx.amount))}</div>
    {onEdit&&<button onClick={()=>setEditing(true)} style={{background:"none",border:`1px solid ${T.borderMid}`,borderRadius:7,color:T.textSecondary,cursor:"pointer",fontSize:12,padding:"3px 8px",flexShrink:0}}>✎</button>}
    {onArchive&&<button onClick={()=>onArchive(tx.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:18,padding:"0 2px",flexShrink:0,lineHeight:1}}>×</button>}
  </div>;
}

function ManualAddForm({onAdd,categories,defaultDate}){
  const T=useTheme(); const inp=useInp();
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [cat,setCat]=useState(categories[0]||"📦 Other");
  const [date,setDate]=useState(defaultDate||todayStr());
  const submit=()=>{
    if(!desc.trim()||!amount||isNaN(+amount)||+amount<=0) return;
    onAdd({description:desc.trim(),amount:parseFloat(amount),category:cat,date});
    setDesc(""); setAmount("");
  };
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
    <input type="text" placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={inp}/>
    <input type="number" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={inp}/>
    <select value={cat} onChange={e=>setCat(e.target.value)} style={{...inp,gridColumn:"1/-1"}}>{categories.map(c=><option key={c}>{c}</option>)}</select>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp}/>
    <Btn onClick={submit} style={{padding:"11px",fontSize:14}}>+ Add</Btn>
  </div>;
}

function InsightCards({text}){
  const T=useTheme(); if(!text) return null;
  const items=text.split(/\n+/).filter(l=>l.trim()).map(l=>l.replace(/^\d+[\.\)]\s*/,"").replace(/^[-•]\s*/,"").trim()).filter(Boolean);
  return <div style={{display:"flex",flexDirection:"column",gap:10}}>
    {items.map((item,i)=><div key={i} style={{background:T.surface2,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.border}`,display:"flex",gap:12}}>
      <span style={{fontSize:11,color:T.accent,fontFamily:"'DM Mono'",fontWeight:700,flexShrink:0,marginTop:2}}>{String(i+1).padStart(2,"0")}</span>
      <span style={{fontSize:14,color:T.textSecondary,lineHeight:1.65}}>{item}</span>
    </div>)}
  </div>;
}

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({tx,onArchive,onEdit,fmt,customCategories}){
  const T=useTheme(); const inp=useInp();
  const CATS=getAllCats(customCategories); const COLS=getAllCatCols(customCategories);
  const [editing,setEditing]=useState(false); const [draft,setDraft]=useState(tx);
  useEffect(()=>setDraft(tx),[tx.id]);
  const isCredit=tx.amount<0;
  if(editing) return <div style={{background:T.surface,borderRadius:14,padding:"16px",border:`1px solid ${T.accent}60`,marginBottom:2}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <input value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} style={{...inp,gridColumn:"1/-1"}} placeholder="Description"/>
      <input type="number" value={Math.abs(draft.amount)} onChange={e=>setDraft(d=>({...d,amount:isCredit?-(parseFloat(e.target.value)||0):(parseFloat(e.target.value)||0)}))} style={inp} placeholder="Amount"/>
      <input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} style={inp}/>
      <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))} style={{...inp,gridColumn:"1/-1"}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
    </div>
    <div style={{display:"flex",gap:10}}><Btn onClick={()=>{onEdit(draft);setEditing(false);}} style={{padding:"10px",fontSize:13}}>Save</Btn><Btn variant="ghost" onClick={()=>setEditing(false)} style={{padding:"10px",fontSize:13,flex:1}}>Cancel</Btn></div>
  </div>;
  return <div style={{display:"flex",alignItems:"center",gap:14,background:T.surface,borderRadius:14,padding:"15px 18px",border:`1px solid ${isCredit?T.positive+"55":T.border}`,boxShadow:T.cardShadow}}>
    <div style={{width:40,height:40,borderRadius:12,flexShrink:0,background:(COLS[tx.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{tx.category?.split(" ")[0]}</div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:14,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:T.textPrimary,marginBottom:4}}>
        {tx.description}{tx.source==="imported"&&<span style={{marginLeft:7,fontSize:10,color:T.accent,opacity:.5,fontFamily:"'DM Mono'"}}>AI</span>}
        {isCredit&&<span style={{marginLeft:7,fontSize:10,color:T.positive,fontFamily:"'DM Mono'",border:`1px solid ${T.positive}40`,borderRadius:5,padding:"1px 7px"}}>CR</span>}

      </div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{tx.date}</span>
        <span style={{fontSize:12,color:T.textMuted}}>{tx.category?.split(" ").slice(1).join(" ")}</span>
      </div>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:15,fontWeight:700,color:isCredit?T.positive:T.textPrimary,flexShrink:0}}>{isCredit?"-":""}{fmt(Math.abs(tx.amount))}</div>
    {onEdit&&<button onClick={()=>setEditing(true)} style={{background:"none",border:`1px solid ${T.borderMid}`,borderRadius:8,color:T.textSecondary,cursor:"pointer",fontSize:13,padding:"5px 10px",flexShrink:0,marginLeft:4}}>✎</button>}
    {onArchive&&<button onClick={()=>onArchive(tx.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:22,padding:"0 4px",flexShrink:0,lineHeight:1,marginLeft:2}}>×</button>}
  </div>;
}

// ── VariableIncomeEntry ───────────────────────────────────────────────────────
function VarIncomeEntry({streams,ov,onUpdate,month}){
  const T=useTheme(); const inp=useInp();
  const pending=pendingVarStreams(streams,ov,month);
  if(pending.length===0) return null;
  return <Card style={{border:`1px solid ${T.warning}50`,background:T.warning+"08"}}>
    <SLabel style={{color:T.warning}}>Income — {pending.length} stream{pending.length>1?"s":""} need amounts</SLabel>
    {pending.map(({stream:s})=><div key={s.id} style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
      <div style={{flex:1}}><div style={{fontSize:13,color:T.textSecondary,marginBottom:4}}>{s.name} <span style={{fontSize:11,color:T.textMuted}}>({s.type})</span></div>
        <input type="number" placeholder="Enter amount" style={inp} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=0)onUpdate(s.id,v);}} onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(e.target.value);if(!isNaN(v)&&v>=0){onUpdate(s.id,v);e.target.value="";}}}}/></div>
      <div style={{width:8,height:8,borderRadius:"50%",background:T.warning,flexShrink:0,marginTop:18}}/>
    </div>)}
  </Card>;
}

// ── IncomeBreakdown ───────────────────────────────────────────────────────────
function IncomeBreakdown({streams,ov,prevOv,fmt,month,onUpdateOv}){
  const T=useTheme();
  const rows=getMonthStreams(streams,ov,month);
  const prevRows=getMonthStreams(streams,prevOv||{},prevMonth(month));
  const extra=(ov||{}).__extra__||0;
  const total=rows.reduce((s,{amount})=>s+(amount||0),0)+extra;
  const typeCol=t=>t==="fixed"?T.info:t==="variable"?T.warning:T.positive;
  const typeLbl=t=>t==="fixed"?"Fixed":t==="variable"?"Variable":"One-off";
  return <div>
    {rows.map(({stream:s,amount})=>{ const prev=prevRows.find(r=>r.stream.id===s.id); const pa=prev?.amount||0;
      return <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:typeCol(s.type),flexShrink:0}}/>
        <div style={{flex:1}}><div style={{fontSize:14,color:T.textPrimary,fontWeight:500}}>{s.name}</div><div style={{fontSize:11,color:typeCol(s.type),fontFamily:"'DM Mono'"}}>{typeLbl(s.type)}</div></div>
        <div style={{textAlign:"right"}}>
          {amount===null?<span style={{fontSize:14,color:T.textMuted}}>—</span>:<EditableAmt value={amount} fmt={fmt} color={T.textPrimary} onSave={v=>onUpdateOv(s.id,v)}/>}
          {pa>0&&amount!==null&&<div style={{fontSize:11,color:amount>=pa?T.positive:T.negative,fontFamily:"'DM Mono'",marginTop:2}}>{amount>=pa?"+":""}{fmt(amount-pa)}</div>}
        </div>
      </div>;})}
    {extra>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14,color:T.textPrimary}}>Extra income</span><span style={{fontFamily:"'DM Mono'",fontSize:14,color:T.positive,fontWeight:600}}>{fmt(extra)}</span></div>}
    <div style={{display:"flex",justifyContent:"space-between",paddingTop:10}}><span style={{fontSize:13,color:T.textMuted}}>Total income</span><span style={{fontFamily:"'DM Mono'",fontSize:15,color:T.positive,fontWeight:700}}>{fmt(total)}</span></div>
  </div>;
}

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
      <div style={{fontSize:14,fontWeight:700,color:T.accent,marginBottom:6,letterSpacing:.5}}>$how Me The Money</div>
      <div style={{fontSize:18,color:T.textPrimary,fontWeight:600}}>{setting?(confirm?"Confirm your PIN":"Set a PIN (6 digits)"):"Enter your PIN"}</div>
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

// ── Modals ────────────────────────────────────────────────────────────────────
function Overlay({children,onClose,zIndex=700}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()}>{children}</div>
  </div>;
}
function ModalCard({children,maxWidth=360}){ const T=useTheme(); return <div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth,boxShadow:"0 24px 80px rgba(0,0,0,0.4)"}}>{children}</div>; }

function RestoreModal({backup,onConfirm,onClose}){
  const T=useTheme(); const txCount=countAllTx(backup.monthlyData||{}); const moCount=Object.keys(backup.monthlyData||{}).length;
  return <Overlay onClose={onClose}><ModalCard><p style={{margin:"0 0 6px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Restore backup?</p>
    <p style={{margin:"0 0 14px",fontSize:13,color:T.textSecondary}}>{new Date(backup.createdAt).toLocaleString("en-SG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
    <div style={{background:T.surface2,borderRadius:10,padding:"12px 14px",marginBottom:12,fontSize:13,color:T.textSecondary}}>{txCount} transactions · {moCount} months · {backup.profile?.name||"Unknown"}</div>
    <div style={{padding:"12px 14px",background:T.negative+"18",borderRadius:10,fontSize:13,color:T.negative,marginBottom:20}}>⚠ This replaces ALL current data and cannot be undone.</div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onClose} style={{padding:"11px",fontSize:13}}>Cancel</Btn><Btn variant="danger" onClick={onConfirm} style={{padding:"11px",fontSize:13}}>Restore</Btn></div>
  </ModalCard></Overlay>;
}

// ── AvatarCropModal ───────────────────────────────────────────────────────────
function AvatarCropModal({src,onSave,onClose}){
  const T=useTheme();
  const SIZE=280;
  // scale is a multiplier relative to the "fill" scale (1.0 = exactly fills frame)
  // so minimum is always 1.0 (image covers frame), max is 3× that
  const [fillScale,setFillScale]=useState(1); // scale that fills the frame
  const [zoom,setZoom]=useState(1);           // 1.0 = fill, >1 = zoomed in
  const [offset,setOffset]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const [lastPos,setLastPos]=useState({x:0,y:0});
  const [lastPinchDist,setLastPinchDist]=useState(null);
  const [imgNatural,setImgNatural]=useState({w:1,h:1});
  const imgRef=useRef();
  const MAX_ZOOM=4;

  // When image loads: compute the fill scale, set zoom=1, center offset
  const onImgLoad=()=>{
    const {naturalWidth:w,naturalHeight:h}=imgRef.current;
    setImgNatural({w,h});
    const fs=Math.max(SIZE/w,SIZE/h);
    setFillScale(fs);
    setZoom(1);
    setOffset({x:0,y:0});
  };

  // Current pixel size of image
  const scale=fillScale*zoom;
  const iw=imgNatural.w*scale;
  const ih=imgNatural.h*scale;

  // Clamp offset: image must always cover the frame completely
  const clamp=(ox,oy,sc)=>{
    const w=imgNatural.w*sc; const h=imgNatural.h*sc;
    // half-extents of how far image centre can move from frame centre
    const hx=Math.max(0,(w-SIZE)/2); const hy=Math.max(0,(h-SIZE)/2);
    return {x:Math.min(hx,Math.max(-hx,ox)), y:Math.min(hy,Math.max(-hy,oy))};
  };

  const applyZoom=nz=>{
    const clamped=Math.min(MAX_ZOOM,Math.max(1,nz));
    setZoom(clamped);
    setOffset(o=>clamp(o.x,o.y,fillScale*clamped));
  };

  // ── Mouse drag ──────────────────────────────────────────────────────────────
  const onMouseDown=e=>{ e.preventDefault(); setDragging(true); setLastPos({x:e.clientX,y:e.clientY}); };
  const onMouseMove=e=>{
    if(!dragging) return;
    const dx=e.clientX-lastPos.x; const dy=e.clientY-lastPos.y;
    setOffset(o=>clamp(o.x+dx,o.y+dy,scale));
    setLastPos({x:e.clientX,y:e.clientY});
  };
  const onMouseUp=()=>setDragging(false);

  // ── Touch drag + pinch ──────────────────────────────────────────────────────
  const onTouchStart=e=>{
    if(e.touches.length===1){ setDragging(true); setLastPos({x:e.touches[0].clientX,y:e.touches[0].clientY}); }
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      setLastPinchDist(Math.hypot(dx,dy));
    }
  };
  const onTouchMove=e=>{
    e.preventDefault();
    if(e.touches.length===1&&dragging){
      const dx=e.touches[0].clientX-lastPos.x; const dy=e.touches[0].clientY-lastPos.y;
      setOffset(o=>clamp(o.x+dx,o.y+dy,scale));
      setLastPos({x:e.touches[0].clientX,y:e.touches[0].clientY});
    }
    if(e.touches.length===2&&lastPinchDist!==null){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.hypot(dx,dy);
      applyZoom(zoom*(dist/lastPinchDist));
      setLastPinchDist(dist);
    }
  };
  const onTouchEnd=()=>{ setDragging(false); setLastPinchDist(null); };

  // ── Scroll to zoom ──────────────────────────────────────────────────────────
  const onWheel=e=>{ e.preventDefault(); applyZoom(zoom*(1-e.deltaY*0.002)); };

  // ── Export ──────────────────────────────────────────────────────────────────
  const saveCrop=()=>{
    const OUT=400;
    const canvas=document.createElement("canvas"); canvas.width=OUT; canvas.height=OUT;
    const ctx=canvas.getContext("2d");
    // In frame coords, image top-left is at:
    const imgLeft=(SIZE/2)-(iw/2)+offset.x;
    const imgTop=(SIZE/2)-(ih/2)+offset.y;
    // Source region in natural image pixels that maps to the SIZE×SIZE frame:
    const sx=-imgLeft/scale; const sy=-imgTop/scale;
    const sw=SIZE/scale; const sh=SIZE/scale;
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUT, OUT);
    onSave(canvas.toDataURL("image/jpeg",0.92));
  };

  const sliderPct=Math.round((zoom-1)/(MAX_ZOOM-1)*100);

  return <Overlay onClose={onClose} zIndex={900}>
    <div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:360,boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
      <p style={{margin:"0 0 4px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Crop your photo</p>
      <p style={{margin:"0 0 16px",fontSize:13,color:T.textMuted}}>Drag to reposition · Scroll or pinch to zoom</p>
      {/* Crop preview — circle clips the image */}
      <div style={{width:SIZE,height:SIZE,borderRadius:"50%",overflow:"hidden",margin:"0 auto 16px",cursor:dragging?"grabbing":"grab",position:"relative",boxShadow:`0 0 0 9999px ${T.bg}99, 0 0 0 3px ${T.accent}`,userSelect:"none",touchAction:"none"}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onWheel={onWheel}>
        <img ref={imgRef} src={src} alt="" onLoad={onImgLoad}
          style={{position:"absolute",width:iw,height:ih,left:(SIZE/2)-(iw/2)+offset.x,top:(SIZE/2)-(ih/2)+offset.y,pointerEvents:"none",userSelect:"none",display:"block"}}/>
      </div>
      {/* Zoom slider — 0% = fill, 100% = max zoom */}
      <div style={{marginBottom:18,padding:"0 4px"}}>
        <input type="range" min={0} max={100} value={sliderPct}
          onChange={e=>applyZoom(1+(parseInt(e.target.value)/100)*(MAX_ZOOM-1))}
          style={{width:"100%",accentColor:T.accent}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginTop:4}}>
          <span>Fill</span>
          <span style={{color:T.accent,fontFamily:"'DM Mono'",fontWeight:600}}>{zoom.toFixed(2)}×</span>
          <span>4× zoom</span>
        </div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{padding:"11px",fontSize:14}}>Cancel</Btn>
        <Btn onClick={saveCrop} style={{padding:"11px",fontSize:14}}>Use Photo</Btn>
      </div>
    </div>
  </Overlay>;
}

function ResetModal({onConfirm,onClose,onDownloadFirst}){
  const T=useTheme();
  return <Overlay onClose={onClose} zIndex={800}><ModalCard>
    <p style={{margin:"0 0 6px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Reset everything?</p>
    <p style={{margin:"0 0 14px",fontSize:14,color:T.textSecondary}}>Deletes your profile, all transactions, and all history. You'll start fresh from onboarding.</p>
    <div style={{padding:"12px 14px",background:T.negative+"18",borderRadius:10,fontSize:13,color:T.negative,marginBottom:16}}>⚠ This cannot be undone.</div>
    <button onClick={onDownloadFirst} style={{width:"100%",padding:"12px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer",marginBottom:10,textAlign:"left"}}>⬇ Download backup first (recommended)</button>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onClose} style={{padding:"11px",fontSize:13}}>Cancel</Btn><Btn variant="danger" onClick={onConfirm} style={{padding:"11px",fontSize:13}}>Reset</Btn></div>
  </ModalCard></Overlay>;
}

function FixedCommitModal({detected,fmt,onConfirm,onSkip}){
  const T=useTheme(); const [sel,setSel]=useState(detected.map((_,i)=>i)); const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Overlay onClose={onSkip}><ModalCard maxWidth={420}>
    <p style={{margin:"0 0 4px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Bills detected</p>
    <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary}}>These look like recurring fixed payments. Add them to your Bills?</p>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      {detected.map((t,i)=><div key={i} onClick={()=>tog(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:sel.includes(i)?T.accentMuted:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:12,cursor:"pointer"}}>
        <Check checked={sel.includes(i)} onChange={()=>tog(i)}/>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.textPrimary}}>{t.description}</div><div style={{fontSize:12,color:T.textMuted}}>{t.category}</div></div>
        <div style={{fontFamily:"'DM Mono'",fontSize:14,color:T.accent,fontWeight:600}}>{fmt(t.rawAmount)}</div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onSkip} style={{padding:"11px",fontSize:13}}>Skip</Btn><Btn onClick={()=>onConfirm(sel.map(i=>detected[i]))} style={{padding:"11px",fontSize:13}}>Add Selected</Btn></div>
  </ModalCard></Overlay>;
}

function RecurringModal({suggestions,onConfirm,onDismiss}){
  const T=useTheme(); const [sel,setSel]=useState(suggestions.map((_,i)=>i)); const tog=i=>setSel(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]);
  return <Overlay onClose={onDismiss}><ModalCard maxWidth={420}>
    <p style={{margin:"0 0 4px",fontSize:18,fontWeight:700,color:T.textPrimary}}>Recurring transactions detected</p>
    <p style={{margin:"0 0 16px",fontSize:13,color:T.textSecondary}}>These appear every month at a similar amount. Add to Bills?</p>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      {suggestions.map((s,i)=><div key={i} onClick={()=>tog(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:sel.includes(i)?T.accentMuted:T.surface2,border:`1px solid ${sel.includes(i)?T.accentBorder:T.border}`,borderRadius:12,cursor:"pointer"}}>
        <Check checked={sel.includes(i)} onChange={()=>tog(i)}/>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.textPrimary}}>{s.description}</div><div style={{fontSize:12,color:T.textMuted}}>~{s.amount.toFixed(2)} · appears {s.count} months</div></div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:10}}><Btn variant="ghost" onClick={onDismiss} style={{padding:"11px",fontSize:13}}>Not now</Btn><Btn onClick={()=>onConfirm(sel.map(i=>suggestions[i]))} style={{padding:"11px",fontSize:13}}>Add Selected</Btn></div>
  </ModalCard></Overlay>;
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const T=useTheme(); const inp=useInp(); const [step,setStep]=useState(0);
  const [p,setP]=useState({name:"",currency:"SGD",occupation:"",accentColor:"#C8FF57",bgColor:"#0C0C12",incomeStreams:[],fixedCommitments:[],startMonth:currentMonth()});
  const avatarRef=useRef();
  const [cropSrc,setCropSrc]=useState(null);
  const handleAvatar=e=>{
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>setCropSrc(ev.target.result);
    reader.readAsDataURL(f);
  };
  const finish=()=>onComplete({...DEFAULT_PROFILE,...p,incomeStreams:(p.incomeStreams||[]).map(s=>({...s,defaultAmount:parseFloat(s.defaultAmount)||0})),fixedCommitments:(p.fixedCommitments||[]).map(c=>({...c,amount:parseFloat(c.amount)||0,startFrom:c.startFrom||"",endMonth:c.endMonth||""})),onboarded:true});
  const updStream=(id,field,val)=>setP(v=>({...v,incomeStreams:v.incomeStreams.map(x=>x.id===id?{...x,[field]:val}:x)}));
  const steps=[
    // Step 0 — identity
    <div key="s0">
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:28,marginBottom:12}}>👋</div>
        <div style={{fontSize:28,fontWeight:800,color:T.textPrimary,letterSpacing:-0.5,lineHeight:1.2,marginBottom:10}}>Welcome to<br/><span style={{color:T.accent}}>$how Me The Money</span></div>
        <div style={{fontSize:14,color:T.textSecondary,lineHeight:1.7,maxWidth:340,margin:"0 auto"}}>Upload your bank statement, Claude reads every transaction, you see exactly where your money goes. All on your device — nothing stored anywhere.</div>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div style={{position:"relative",width:80,height:80}}>
          <div onClick={()=>avatarRef.current.click()} style={{width:80,height:80,borderRadius:"50%",background:T.accentMuted,border:`2px dashed ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
            {p.avatar?<img src={p.avatar} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:"50%",display:"block"}}/>:<span style={{fontSize:32,color:T.accent,opacity:.7}}>+</span>}
          </div>
          <div style={{position:"absolute",bottom:-2,right:-2,width:22,height:22,borderRadius:"50%",background:T.accent,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.accentText,cursor:"pointer"}} onClick={()=>avatarRef.current.click()}>✎</div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <input placeholder="Your name *" value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))} style={inp}/>
        <input placeholder="Occupation (optional)" value={p.occupation||""} onChange={e=>setP(v=>({...v,occupation:e.target.value}))} style={inp}/>
        <select value={p.currency} onChange={e=>setP(v=>({...v,currency:e.target.value}))} style={inp}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
        <div>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:6}}>Tracking from — your fresh start month</div>
          <input type="month" value={p.startMonth} onChange={e=>setP(v=>({...v,startMonth:e.target.value}))} style={inp}/>
          <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>Only months from here will appear in your dashboard.</div>
        </div>
      </div>
      <Btn onClick={()=>p.name.trim()&&setStep(1)} disabled={!p.name.trim()} style={{marginTop:24,padding:"14px"}}>Continue →</Btn>
    </div>,

    // Step 1 — income
    <div key="s1">
      <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.textPrimary}}>Income sources</p>
      <p style={{margin:"0 0 18px",fontSize:14,color:T.textSecondary,lineHeight:1.65}}>Tell us how you earn so we can calculate how much you're saving each month.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:4}}>
        {p.incomeStreams.map((s,i)=><div key={s.id} style={{background:T.surface2,borderRadius:12,padding:"14px",border:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:10,alignItems:"center"}}>
            <input placeholder="Name (e.g. Salary, Freelance)" value={s.name} onChange={e=>updStream(s.id,"name",e.target.value)} style={inp}/>
            {i>0&&<button onClick={()=>setP(v=>({...v,incomeStreams:v.incomeStreams.filter(x=>x.id!==s.id)}))} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"4px 6px",minHeight:44}}>×</button>}
          </div>
          <div style={{display:"flex",borderRadius:9,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:10}}>
            {[["fixed","Fixed","Same amount every month"],["variable","Variable","Changes — you enter it monthly"],["oneoff","One-off","Single payment, one month"]].map(([t,label,hint])=><button key={t} onClick={()=>updStream(s.id,"type",t)} title={hint} style={{flex:1,padding:"9px 4px",background:s.type===t?T.accent:"transparent",border:"none",color:s.type===t?T.accentText:T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?700:400}}>{label}</button>)}
          </div>
          {s.type==="fixed"&&<>
            <input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>updStream(s.id,"defaultAmount",e.target.value)} style={{...inp,marginBottom:10}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Active from</div><input type="month" value={s.startFrom||""} onChange={e=>updStream(s.id,"startFrom",e.target.value)} style={inp}/></div>
              <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Ends (optional)</div><input type="month" value={s.endMonth||""} onChange={e=>updStream(s.id,"endMonth",e.target.value)} style={inp}/></div>
            </div>
          </>}
          {s.type==="oneoff"&&<div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>For which month?</div><input type="month" value={s.startFrom||""} onChange={e=>updStream(s.id,"startFrom",e.target.value)} style={inp}/></div>}
        </div>)}
      </div>
      <button onClick={()=>setP(v=>({...v,incomeStreams:[...v.incomeStreams,{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:"",active:true,startFrom:"",endMonth:""}]}))} style={{padding:"12px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer",width:"100%",marginBottom:18,marginTop:10}}>+ Add income source</button>
      <Btn onClick={()=>setStep(2)} style={{padding:"14px"}}>Continue →</Btn>
      <Btn variant="ghost" onClick={()=>setStep(2)} style={{marginTop:10,padding:"14px"}}>Skip for now</Btn>
    </div>,

    // Step 2 — theme
    <div key="s2">
      <p style={{margin:"0 0 6px",fontSize:22,fontWeight:800,color:T.textPrimary}}>Make it yours</p>
      <p style={{margin:"0 0 18px",fontSize:14,color:T.textSecondary,lineHeight:1.6}}>Pick a theme. You can always change this later in Profile.</p>
      <ThemePresets accentColor={p.accentColor} bgColor={p.bgColor} onChange={(ac,bg)=>setP(x=>({...x,accentColor:ac,bgColor:bg}))}/>
      <Btn onClick={()=>setStep(3)} style={{marginTop:24,padding:"14px"}}>Continue →</Btn>
    </div>,

    // Step 3 — bills
    <div key="s3">
      <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.textPrimary}}>Monthly bills</p>
      <p style={{margin:"0 0 14px",fontSize:14,color:T.textSecondary,lineHeight:1.65}}>Insurance, rent, loans — things that go out every month regardless of what you spend. Leave dates blank if they're ongoing.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
        {(p.fixedCommitments||[]).map(c=><div key={c.id} style={{background:T.surface2,borderRadius:12,padding:"12px",border:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 80px auto",gap:8,marginBottom:8,alignItems:"center"}}>
            <input placeholder="Bill name (e.g. Rent, Insurance)" value={c.name} onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,name:e.target.value}:x)}))} style={inp}/>
            <input type="number" placeholder="Amt" value={c.amount||""} onChange={e=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.map(x=>x.id===c.id?{...x,amount:e.target.value}:x)}))} style={{...inp,textAlign:"right"}}/>
            <button onClick={()=>setP(v=>({...v,fixedCommitments:v.fixedCommitments.filter(x=>x.id!==c.id)}))} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"4px 6px",minHeight:44}}>×</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div><div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>Start from (blank = always)</div><input type="month" value={c.startFrom||""} onChange={e=>setP(x=>({...x,fixedCommitments:x.fixedCommitments.map(f=>f.id===c.id?{...f,startFrom:e.target.value}:f)}))} style={inp}/></div>
            <div><div style={{fontSize:11,color:T.textMuted,marginBottom:3}}>End month (blank = ongoing)</div><input type="month" value={c.endMonth||""} onChange={e=>setP(x=>({...x,fixedCommitments:x.fixedCommitments.map(f=>f.id===c.id?{...f,endMonth:e.target.value}:f)}))} style={inp}/></div>
          </div>
        </div>)}
      </div>
      <button onClick={()=>setP(v=>({...v,fixedCommitments:[...(v.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:"",startFrom:"",endMonth:""}]}))} style={{padding:"12px",background:"transparent",border:`1px dashed ${T.borderMid}`,borderRadius:10,color:T.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer",width:"100%",marginBottom:18}}>+ Add bill</button>
      {/* What happens next */}
      <div style={{background:T.accentMuted,border:`1px solid ${T.accentBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,color:T.accent,marginBottom:6}}>What happens next</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {["Go to Add → upload your first bank statement","Review what Claude extracted — approve or skip","See your full breakdown in Money"].map((s,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12,color:T.textSecondary}}><span style={{color:T.accent,flexShrink:0}}>{i+1}.</span>{s}</div>)}
        </div>
      </div>
      <Btn onClick={finish} style={{padding:"14px"}}>Let's go →</Btn>
      <Btn variant="ghost" onClick={finish} style={{marginTop:10,padding:"14px"}}>Skip for now</Btn>
    </div>
  ];

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
    {cropSrc&&<AvatarCropModal src={cropSrc} onSave={data=>{setP(v=>({...v,avatar:data}));setCropSrc(null);}} onClose={()=>setCropSrc(null)}/>}
    <div style={{width:"100%",maxWidth:460}}>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:36}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:i===step?24:7,height:7,borderRadius:4,background:i===step?T.accent:i<step?T.accentBorder:T.border,transition:"all .3s"}}/>)}
      </div>
      {steps[step]}
    </div>
  </div>;
}
// ── Main App ──────────────────────────────────────────────────────────────────
export default function App(){
  const [pinUnlocked,setPinUnlocked]=useState(false);
  const [pinSkipped,setPinSkipped]=useState(false);
  const [pinHash,setPinHash]=useState(()=>lsLoad("pinHash"));
  const [tab,setTab]=useState("home");
  const [selectedMonth,setSelectedMonth]=useState(currentMonth());
  const [profile,setProfile]=useState(null);
  const [monthlyData,setMonthlyData]=useState({});
  const [eh,setEh]=useState({});
  const [ch,setCh]=useState({});
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
  const [tutorialDismissed,setTutorialDismissed]=useState(false);
  const [catFilter,setCatFilter]=useState("All");
  // Collapsible section states — lifted to App level so they don't reset on re-render
  const [moneyShowIncome,setMoneyShowIncome]=useState(false);
  const [moneyShowBills,setMoneyShowBills]=useState(false);
  const [moneyShowGoals,setMoneyShowGoals]=useState(false);
  const [moneyShowTxs,setMoneyShowTxs]=useState(false);
  const [reviewArchiveOpen,setReviewArchiveOpen]=useState(false);
  const [reviewSkippedOpen,setReviewSkippedOpen]=useState(false);
  const [restoreCandidate,setRestoreCandidate]=useState(null);
  const [showReset,setShowReset]=useState(false);
  const [showPrivacy,setShowPrivacy]=useState(false);
  const [fixedCommitDetected,setFixedCommitDetected]=useState(null);
  const [recurringDetected,setRecurringDetected]=useState(null);
  const fileRef=useRef(); const restoreRef=useRef(); const backupTimer=useRef(null);
  const isDesktop=useMemo(()=>window.innerWidth>=768,[]);

  useEffect(()=>{
    const p=lsLoad("profile"); setProfile(p||DEFAULT_PROFILE);
    const md=lsLoad("monthlyData"); if(md) setMonthlyData(md);
    const e=lsLoad("excludeHistory"); if(e) setEh(e);
    const c=lsLoad("catExcludeHistory"); if(c) setCh(c);
    const ins=lsLoad("insights"); if(ins) setInsights(ins);
    const ehs=lsLoad("editHintSeen"); if(ehs) setEditHintSeen(true);
    const td=lsLoad("tutorialDismissed"); if(td) setTutorialDismissed(true);
    const arc=lsLoad("archive"); if(arc) setArchive(arc);
  },[]);

  useEffect(()=>{ if(profile?.startMonth&&selectedMonth<profile.startMonth) setSelectedMonth(profile.startMonth); },[profile?.startMonth]);
  useEffect(()=>{
    if(!profile?.onboarded) return;
    clearTimeout(backupTimer.current);
    backupTimer.current=setTimeout(()=>autoBackup(profile,monthlyData,eh,ch,insights,archive),3000);
    return()=>clearTimeout(backupTimer.current);
  },[profile,monthlyData,eh,ch,archive]);

  const theme=useMemo(()=>buildTheme(profile?.accentColor||"#C8FF57",profile?.bgColor||"#0C0C12"),[profile?.accentColor,profile?.bgColor]);
  const T=theme;
  const CATS=useMemo(()=>getAllCats(profile?.customCategories),[profile?.customCategories]);
  const CCOLS=useMemo(()=>getAllCatCols(profile?.customCategories),[profile?.customCategories]);
  const fmt=useCallback(n=>{ const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"]; return sym+Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2}); },[profile?.currency]);
  const {mf,cf}=useMemo(()=>habitFlags(eh,ch),[eh,ch]);
  const getMD=useCallback(m=>monthlyData[m]||{txs:[],incomeOverrides:{},fixedOverrides:null},[monthlyData]);
  const md=useMemo(()=>getMD(selectedMonth),[getMD,selectedMonth]);
  const streams=profile?.incomeStreams||[];
  const ov=md.incomeOverrides||{};
  const monthFixed=useMemo(()=>(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||selectedMonth>=c.startFrom)&&(!c.endMonth||selectedMonth<=c.endMonth)),[md,profile,selectedMonth]);
  const committedTxs=useMemo(()=>[...(md.txs||[])].sort((a,b)=>b.date.localeCompare(a.date)),[md.txs]);
  const incTotal=useMemo(()=>totalIncome(streams,ov,selectedMonth),[streams,ov,selectedMonth]);
  const varTotal=useMemo(()=>committedTxs.reduce((s,t)=>s+t.amount,0),[committedTxs]);
  const fixedTotal=useMemo(()=>monthFixed.reduce((s,c)=>s+(+c.amount||0),0),[monthFixed]);
  const saved=incTotal-varTotal-fixedTotal;
  const savingsRate=incTotal>0?(saved/incTotal*100):0;
  const byCat=useMemo(()=>{ const m={}; committedTxs.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]); },[committedTxs]);
  const topCat=byCat[0];
  const hasImport=!!(monthlyData[selectedMonth]?.txs?.some(t=>t.source==="imported"));
  const pendingVars=useMemo(()=>pendingVarStreams(streams,ov,selectedMonth),[streams,ov,selectedMonth]);
  const pm=useMemo(()=>prevMonth(selectedMonth),[selectedMonth]);
  const pmd=useMemo(()=>getMD(pm),[getMD,pm]);
  const prevOv=pmd.incomeOverrides||{};
  const prevVarTotal=useMemo(()=>(pmd.txs||[]).reduce((s,t)=>s+t.amount,0),[pmd]);
  const prevFixed=(pmd.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||pm>=c.startFrom)&&(!c.endMonth||pm<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
  const prevIncTotal=useMemo(()=>totalIncome(streams,prevOv,pm),[streams,prevOv,pm]);
  const prevSaved=prevIncTotal-prevVarTotal-prevFixed;
  const avgSpend=useMemo(()=>{ const months=Object.entries(monthlyData).filter(([m])=>(!profile?.startMonth||m>=profile.startMonth)&&m!==selectedMonth); if(!months.length) return null; return months.reduce((s,[,md])=>s+(md.txs||[]).reduce((a,t)=>a+t.amount,0),0)/months.length; },[monthlyData,selectedMonth,profile?.startMonth]);
  const fullMonths=useMemo(()=>Object.entries(monthlyData).filter(([m,md])=>{ if(profile?.startMonth&&m<profile.startMonth) return false; return (md.txs||[]).length>0&&totalIncome(streams,md.incomeOverrides||{},m)>0; }).length,[monthlyData,streams,profile?.startMonth]);
  const checkedCount=pendingTxs.filter(t=>t.checked).length;
  const allTimeSaved=useMemo(()=>Object.entries(monthlyData).filter(([m])=>!profile?.startMonth||m>=profile.startMonth).reduce((total,[m,md])=>{
    const inc=totalIncome(streams,md.incomeOverrides||{},m);
    const spent=(md.txs||[]).reduce((s,t)=>s+t.amount,0);
    const fix=(md.fixedOverrides||profile?.fixedCommitments||[]).filter(c=>(!c.startFrom||m>=c.startFrom)&&(!c.endMonth||m<=c.endMonth)).reduce((s,c)=>s+(+c.amount||0),0);
    return total+(inc-spent-fix);
  },0),[monthlyData,streams,profile]);
  const nudge=useMemo(()=>{
    if(pendingTxs.length>0) return {color:T.warning,title:`${pendingTxs.length} transactions waiting for review`,sub:"Tap to approve",tab:"review"};
    if(pendingVars.length>0) return {color:T.warning,title:"Variable income needs entry",sub:"Tap Add to enter amounts",tab:"add"};
    if(!hasImport) return {color:T.accent,title:`Import ${monthLabel(selectedMonth)} statement`,sub:"Upload your bank statement",tab:"add"};
    if(incTotal===0) return {color:T.info,title:"Set up income sources",sub:"Needed to calculate savings rate",tab:"profile"};
    return null;
  },[pendingTxs.length,pendingVars.length,hasImport,incTotal,selectedMonth,T]);

  const saveMD=async(month,updates)=>{ const updated={...monthlyData,[month]:{...(monthlyData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),...updates}}; setMonthlyData(updated); lsSave("monthlyData",updated); return updated; };
  const saveProfile=p=>{ setProfile(p); lsSave("profile",p); };
  const saveArchive=arr=>{ setArchive(arr); lsSave("archive",arr); };
  const showToast=msg=>setToast(msg);

  const handleRestoreFile=e=>{ const file=e.target.files[0];if(!file)return; const r=new FileReader(); r.onload=()=>{try{const snap=JSON.parse(r.result);if(!snap.version||!snap.profile)throw new Error("Invalid");setRestoreCandidate(snap);}catch{showToast("⚠ Invalid backup file");}};r.readAsText(file);e.target.value=""; };
  const doRestore=snap=>{ saveProfile(snap.profile||DEFAULT_PROFILE); lsSave("monthlyData",snap.monthlyData||{}); setMonthlyData(snap.monthlyData||{}); lsSave("excludeHistory",snap.excludeHistory||{}); setEh(snap.excludeHistory||{}); lsSave("catExcludeHistory",snap.catExcludeHistory||{}); setCh(snap.catExcludeHistory||{}); if(snap.insights){setInsights(snap.insights);lsSave("insights",snap.insights);} if(snap.archive){saveArchive(snap.archive);} setRestoreCandidate(null); showToast("✓ Backup restored"); setTab("home"); window.location.reload(); };
  const doReset=()=>{ lsClear(); window.location.reload(); };

  const updateOv=async(streamId,amount)=>{ const updated={...ov,[streamId]:amount}; await saveMD(selectedMonth,{incomeOverrides:updated}); };

  const archiveTx=id=>{ const tx=(md.txs||[]).find(t=>t.id===id); if(!tx) return; saveArchive([{...tx,archivedAt:new Date().toISOString()},...archive].slice(0,500)); saveMD(selectedMonth,{txs:(md.txs||[]).filter(t=>t.id!==id)}); showToast("Moved to archive"); };
  const restoreToReview=id=>{ const tx=archive.find(t=>t.id===id); if(!tx) return; const{archivedAt:_,...clean}=tx; setPendingTxs(p=>[{...clean,checked:true,source:clean.source||"manual"},...p]); saveArchive(archive.filter(t=>t.id!==id)); showToast("✓ Moved to Review"); setTab("review"); };

  const commitTransactions=async()=>{
    const checked=pendingTxs.filter(t=>t.checked); const unchecked=pendingTxs.filter(t=>!t.checked);
    const newEh={...eh},newCh={...ch};
    unchecked.forEach(t=>{
      const k=t.description?.toLowerCase().trim();
      const existing=newEh[k]; const prevCount=typeof existing==="object"?existing.count:(existing||0);
      newEh[k]={count:prevCount+1,lastTx:{id:t.id,date:t.date,description:t.description,amount:t.amount,category:t.category}};
      newCh[t.category]=(newCh[t.category]||0)+1;
    });
    checked.forEach(t=>{
      const k=t.description?.toLowerCase().trim();
      if(newEh[k]){
        const prevCount=typeof newEh[k]==="object"?newEh[k].count:newEh[k];
        const lastTx=typeof newEh[k]==="object"?newEh[k].lastTx:null;
        const newCount=Math.max(0,prevCount-1);
        if(newCount===0) delete newEh[k]; else newEh[k]={count:newCount,lastTx};
      }
    });
    saveArchive([...unchecked.map(({habitReason:_,checked:__,...t})=>({...t,archivedAt:new Date().toISOString()})),...archive].slice(0,500));
    const byMonth={};
    checked.forEach(t=>{ const m=monthKey(t.date); if(!byMonth[m]) byMonth[m]=[]; byMonth[m].push(t); });
    let added=0; const updatedData={...monthlyData};
    for(const [month,txs] of Object.entries(byMonth)){
      const existing=(updatedData[month]||{}).txs||[];
      const existKeys=new Set(existing.map(t=>`${t.date}|${t.description}|${t.amount}`));
      const fresh=txs.filter(t=>!existKeys.has(`${t.date}|${t.description}|${t.amount}`)).map(({habitReason:_,checked:__,...t})=>t);
      updatedData[month]={...(updatedData[month]||{txs:[],incomeOverrides:{},fixedOverrides:null}),txs:[...fresh,...existing]};
      added+=fresh.length;
    }
    setMonthlyData(updatedData); lsSave("monthlyData",updatedData);
    setEh(newEh); setCh(newCh); lsSave("excludeHistory",newEh); lsSave("catExcludeHistory",newCh);
    setPendingTxs([]);
    const months=Object.keys(byMonth).sort();
    showToast(`✓ ${added} transactions saved — ${months.length>1?`${monthLabel(months[0])} – ${monthLabel(months[months.length-1])}`:monthLabel(months[0]||selectedMonth)}`);
    checkRecurring(updatedData);
    setTab("home");
  };

  const checkRecurring=useCallback(data=>{
    const months=Object.keys(data).filter(m=>!profile?.startMonth||m>=profile.startMonth);
    if(months.length<2) return;
    const desc={};
    months.forEach(m=>{(data[m]?.txs||[]).forEach(t=>{ const k=t.description?.toLowerCase().trim(); if(!desc[k]) desc[k]={count:0,amounts:[],description:t.description}; desc[k].count++; desc[k].amounts.push(Math.abs(t.amount)); });});
    const existing=new Set((profile?.fixedCommitments||[]).map(c=>c.name?.toLowerCase()));
    const suggestions=Object.values(desc).filter(({count,description})=>count>=2&&!existing.has(description?.toLowerCase())).map(({description,count,amounts})=>({description,count,amount:amounts.reduce((a,b)=>a+b,0)/amounts.length})).slice(0,5);
    if(suggestions.length>0) setRecurringDetected(suggestions);
  },[profile]);

  const editTx=async draft=>{ await saveMD(selectedMonth,{txs:(md.txs||[]).map(t=>t.id===draft.id?draft:t)}); showToast("Updated"); };

  const addManual=async({description,amount,category,date}={})=>{
    const d=description||form.description; const a=amount||form.amount;
    const c=category||form.category; const dt=date||form.date;
    if(!d||!d.trim()||!a||isNaN(+a)||+a<=0) return;
    const tx={id:Date.now(),date:dt,description:d.trim(),category:c,amount:parseFloat(a),source:"manual"};
    const month=monthKey(dt);
    if(profile?.startMonth&&month<profile.startMonth){ showToast("⚠ Before your start month"); return; }
    const ex=(monthlyData[month]||{}).txs||[];
    await saveMD(month,{txs:[tx,...ex]});
    showToast("Transaction added");
    if(month!==selectedMonth) setSelectedMonth(month);
  };

  const parseChunk=async(content)=>{
    const prompt=`You are a bank statement parser. Extract ALL transactions without exception — every single line item. Rules:
1. If amount has "CR" after it set "isCredit":true, otherwise false.
2. For recurring fixed payments (insurance, loan, rent, subscription) use one of: ${FIXED_CATS.map(c=>JSON.stringify(c)).join(",")}.
3. Otherwise use one of: ${CATS.map(c=>JSON.stringify(c)).join(",")}.
4. Do NOT skip, group, or summarise. Extract every row.
Return ONLY a valid JSON array. Each object: {"date":"YYYY-MM-DD","description":"cleaned merchant name","amount":positive_number,"isCredit":boolean,"category":string}. Output ONLY the JSON array.`;
    const body=typeof content==="string"?`${prompt}\n\nStatement:\n${content}`:[...content,{type:"text",text:prompt}];
    const controller=new AbortController();
    // Vercel Pro plan allows up to 300s. Set client timeout slightly shorter so we get a graceful error.
    const timeoutId=setTimeout(()=>controller.abort(),290000);
    let res;
    try{ res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:16000,messages:[{role:"user",content:body}]}),signal:controller.signal}); }
    finally{ clearTimeout(timeoutId); }
    if(!res.ok){ let msg=`Server error ${res.status}`; try{const e=await res.json();msg=e.error||e.detail||msg;}catch(e){} throw new Error(msg); }
    // Read SSE stream — server sends chunks then a final {done:true,content:[...]} event
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
    setUploading(true); setUploadMsg("Reading file…");
    try{
      // duplicate detection removed
      let parsed=[];
      const isImage=/^image\//i.test(file.type); const isPDF=file.name.toLowerCase().endsWith(".pdf");
      if(isImage||isPDF){
        const base64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
        setUploadMsg("Claude is parsing your statement…");
        parsed=await parseChunk([{type:"document",source:{type:"base64",media_type:isImage?file.type:"application/pdf",data:base64}}]);
      } else {
        const text=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); });
        const chunks=splitCSV(text,15000);
        for(let i=0;i<chunks.length;i++){ setUploadMsg(`Parsing part ${i+1} of ${chunks.length}…`); parsed=[...parsed,...await parseChunk(chunks[i])]; }
      }
      if(!Array.isArray(parsed)||!parsed.length) throw new Error("No transactions found in statement");
      const seen=new Set(); parsed=parsed.filter(t=>{ const k=`${t.date}|${(t.description||"").toLowerCase()}|${Math.abs(parseFloat(t.amount)||0)}`; if(seen.has(k)) return false; seen.add(k); return true; });
      const fixedDetected=[];
      const imported=parsed.map((t,i)=>{
        const isCredit=!!t.isCredit;
        const amount=isCredit?-(Math.abs(parseFloat(t.amount)||0)):Math.abs(parseFloat(t.amount)||0);
        const validCats=[...CATS,...FIXED_CATS];
        const cat=validCats.includes(t.category)?t.category:"📦 Other";
        if(isFixedCat(cat)&&!isCredit){
          fixedDetected.push({
            id:`fd${Date.now()}${i}`,
            description:t.description||"Unknown",
            category:cat,
            rawAmount:Math.abs(amount),
            date:t.date||todayStr(),
            // keep full tx so we can put it back if user skips
            fullTx:{id:Date.now()+i+10000,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:false,habitReason:null}
          });
          return null;
        }
        const reason=habitReason({description:(t.description||"").toLowerCase().trim(),category:cat},mf,cf);
        return {id:Date.now()+i,date:t.date||todayStr(),description:t.description||"Unknown",amount,category:cat,source:"imported",checked:!reason,habitReason:reason};
      }).filter(Boolean);
      // Unchecked recurring transactions stay in pending (not removed)
      setPendingTxs(imported);
      if(fixedDetected.length>0) setFixedCommitDetected(fixedDetected);
      const months=[...new Set(imported.map(t=>monthKey(t.date)))].sort();
      setUploadMsg(`✓ Found ${imported.length} transactions across ${months.length} month${months.length>1?"s":""}`);
      setTab("review");
    }catch(err){
      console.error(err); const msg=err.message||"Unknown error";
      if(msg.includes("504")||msg.includes("timeout")) setUploadMsg("⚠ Timed out. Try a smaller file.");
      else if(msg.includes("API key")) setUploadMsg("⚠ API key not configured.");
      else if(msg.includes("No transactions")) setUploadMsg("⚠ No transactions found. Check the file.");
      else setUploadMsg(`⚠ ${msg} [${err.name}]`);
    }
    finally{ setUploading(false); e.target.value=""; setTimeout(()=>setUploadMsg(""),12000); }
  };

  const handleFixedCommitConfirm=confirmed=>{
    const existing=profile?.fixedCommitments||[];
    const existNames=new Set(existing.map(c=>c.name?.toLowerCase()));
    const toAdd=confirmed.filter(c=>!existNames.has(c.description?.toLowerCase())).map(c=>({id:`c${Date.now()}${Math.random()}`,name:c.description,amount:c.rawAmount,startFrom:"",endMonth:""}));
    if(toAdd.length>0){saveProfile({...profile,fixedCommitments:[...existing,...toAdd]});showToast(`✓ Added ${toAdd.length} fixed commitment${toAdd.length>1?"s":""}`);}
    // Items NOT confirmed go back into review as unchecked transactions
    const allDetected=fixedCommitDetected||[];
    const confirmedDescs=new Set(confirmed.map(c=>c.description));
    const toReview=allDetected.filter(c=>!confirmedDescs.has(c.description)&&c.fullTx).map(c=>c.fullTx);
    if(toReview.length>0) setPendingTxs(p=>[...p,...toReview]);
    setFixedCommitDetected(null);
  };
  const handleRecurringConfirm=confirmed=>{ const existing=profile?.fixedCommitments||[]; const existNames=new Set(existing.map(c=>c.name?.toLowerCase())); const toAdd=confirmed.filter(s=>!existNames.has(s.description?.toLowerCase())).map(s=>({id:`c${Date.now()}${Math.random()}`,name:s.description,amount:Math.round(s.amount*100)/100,startFrom:"",endMonth:""})); if(toAdd.length>0){saveProfile({...profile,fixedCommitments:[...existing,...toAdd]});showToast(`✓ Added ${toAdd.length} recurring commitment${toAdd.length>1?"s":""}`);}setRecurringDetected(null); };

  const generateInsights=async()=>{
    if(fullMonths<3) return; setLoadingInsights(true);
    try{
      const hist=Object.entries(monthlyData).filter(([m])=>!profile?.startMonth||m>=profile.startMonth).sort().map(([month,md])=>{ const txs=md.txs||[]; const inc=totalIncome(streams,md.incomeOverrides||{},month); const total=txs.reduce((s,t)=>s+t.amount,0); const byCat={}; txs.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;}); return `${month} | Income: ${inc} | Spending: ${total.toFixed(2)} | Saved: ${(inc-total).toFixed(2)}\n${Object.entries(byCat).map(([c,a])=>`  ${c}: ${a.toFixed(2)}`).join("\n")}`; }).join("\n\n");
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:`You are a personal finance advisor for a Singapore user. Analyse this spending and income data. Give 5-6 specific, actionable insights using actual numbers. Be direct and friendly. Each insight on a separate line.\n\n${hist}`}]})});
      if(!res.ok) throw new Error(`Server error ${res.status}`);
      const reader=res.body.getReader(); const dec=new TextDecoder(); let finalData=null;
      while(true){ const {done,value}=await reader.read(); if(done) break; const text=dec.decode(value,{stream:true}); for(const line of text.split("\n")){ if(!line.startsWith("data: ")) continue; const d=line.slice(6).trim(); if(!d) continue; try{ const p=JSON.parse(d); if(p.done&&p.content) finalData=p; }catch(e){} } }
      const insText=finalData?.content?.map(b=>b.text||"").join("").trim()||"";
      const newIns={text:insText,timestamp:new Date().toISOString()}; setInsights(newIns); lsSave("insights",newIns);
    }catch{ setInsights({text:"Couldn't generate insights. Try again.",timestamp:null}); }
    setLoadingInsights(false);
  };

  // ── PIN / loading gate ──────────────────────────────────────────────────────
  const savedAccent=lsLoad("profile")?.accentColor||"#C8FF57"; const savedBg=lsLoad("profile")?.bgColor||"#0C0C12";
  if(!pinUnlocked&&!pinSkipped){
    return <ThemeCtx.Provider value={buildTheme(savedAccent,savedBg)}>
      <PinScreen storedHash={pinHash||null} onUnlock={()=>setPinUnlocked(true)}
        onSetup={pin=>{ if(pin){ const h=hashPin(pin); lsSave("pinHash",h); setPinHash(h); } setPinUnlocked(true); }}
        onSkip={()=>setPinSkipped(true)}/>
    </ThemeCtx.Provider>;
  }
  if(!profile){ return <div style={{minHeight:"100vh",background:"#0C0C12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{textAlign:"center"}}><div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:savedAccent,fontFamily:"'DM Mono'",marginBottom:8,opacity:.8}}>Welcome back</div><div style={{fontSize:24,fontWeight:700,color:"#EEEAE0"}}>$how Me The Money</div></div><div style={{display:"flex",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:savedAccent,opacity:.3,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div><style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style></div>; }
  if(!profile.onboarded) return <ThemeCtx.Provider value={buildTheme(profile.accentColor||"#C8FF57",profile.bgColor||"#0C0C12")}><Onboarding onComplete={saveProfile}/></ThemeCtx.Provider>;

  const inp={padding:"11px 14px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"};
  const TABS=[["home","🏠","Home"],["add","➕","Add"],["review","📋","Review"],["money","💰","Money"],["profile","👤","Profile"]];
  const filteredTxs=catFilter==="All"?committedTxs:committedTxs.filter(t=>t.category===catFilter);

  // ── Nav item ────────────────────────────────────────────────────────────────
  const navItem=([id,icon,label])=>{
    const active=tab===id;
    if(isDesktop) return <button key={id} onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderRadius:12,background:active?T.accentMuted:"transparent",border:"none",color:active?T.accent:T.textSecondary,fontFamily:"inherit",fontSize:15,fontWeight:active?600:400,cursor:"pointer",width:"100%",textAlign:"left",transition:"all .15s",marginBottom:2}}>
      <span style={{fontSize:18,width:24,textAlign:"center"}}>{icon}</span>{label}
      {id==="review"&&pendingTxs.length>0&&<span style={{marginLeft:"auto",background:T.accent,color:T.accentText,borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 8px"}}>{pendingTxs.length}</span>}
    </button>;
    return <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"9px 4px",background:"none",border:"none",borderTop:`2.5px solid ${active?T.accent:"transparent"}`,color:active?T.accent:T.textMuted,fontFamily:"inherit",fontSize:9,fontWeight:active?600:400,cursor:"pointer",position:"relative",transition:"color .15s"}}>
      <span style={{fontSize:20}}>{icon}</span>{label}
      {id==="review"&&pendingTxs.length>0&&<span style={{position:"absolute",top:5,right:"50%",transform:"translateX(130%)",background:T.accent,color:T.accentText,borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{pendingTxs.length}</span>}
    </button>;
  };

  // ── HOME ─────────────────────────────────────────────────────────────────────
  const HomeContent=()=>{
    const CountUpBox=({label,val,color,sub,delay=0})=>{
      const sym=CURRENCY_SYMBOLS[profile?.currency||"SGD"];
      const fmtN=n=>`${n<0?"-":""}${sym}${Math.abs(n).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      return <div style={{background:T.bg,borderRadius:14,padding:isDesktop?"18px 20px":"14px 16px",border:`1px solid ${T.border}`}}>
        <div style={{fontSize:11,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>{label}</div>
        <div style={{fontSize:isDesktop?24:18,fontWeight:700,fontFamily:"'DM Mono'",color,lineHeight:1.1}}>
          <CountUp value={val} format={fmtN} duration={700+delay}/>
        </div>
        {sub&&<div style={{fontSize:10,color:sub.col,fontFamily:"'DM Mono'",marginTop:5}}>{sub.text}</div>}
      </div>;
    };
    return <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Getting Started */}
      {!tutorialDismissed&&<Card style={{border:`1px solid ${T.accentBorder}`,background:T.accentMuted}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:700,color:T.accent}}>👋 Getting Started</div>
          <button onClick={()=>{setTutorialDismissed(true);lsSave("tutorialDismissed",true);}} style={{background:"none",border:"none",color:T.accent,fontSize:18,cursor:"pointer",padding:"4px 6px",opacity:.6,lineHeight:1,minHeight:36}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {icon:"👤",label:"Set up your profile",desc:"Add your income sources and monthly bills",tab:"profile",done:incTotal>0},
            {icon:"➕",label:"Upload your first statement",desc:"Go to Add — drop in a PDF or CSV from your bank",tab:"add",done:countAllTx(monthlyData)>0},
            {icon:"📋",label:"Review what Claude found",desc:"Approve, skip, or edit each transaction",tab:"review",done:countAllTx(monthlyData)>0&&pendingTxs.length===0},
            {icon:"💰",label:"See where your money went",desc:"Check your spending breakdown in Money",tab:"money",done:countAllTx(monthlyData)>0},
          ].map(({icon,label,desc,tab:t,done})=><div key={label} onClick={()=>!done&&setTab(t)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px",background:done?T.accentMuted:T.surface,borderRadius:10,border:`1px solid ${done?T.accentBorder:T.border}`,cursor:done?"default":"pointer",opacity:done?0.6:1,minHeight:44}}>
            <span style={{fontSize:20,flexShrink:0}}>{done?"✅":icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:done?T.textMuted:T.textPrimary}}>{label}</div>
              <div style={{fontSize:12,color:T.textMuted,marginTop:2,lineHeight:1.4}}>{desc}</div>
            </div>
            {!done&&<span style={{fontSize:16,color:T.accent,opacity:.6,flexShrink:0}}>→</span>}
          </div>)}
        </div>
        {[incTotal>0,countAllTx(monthlyData)>0].every(Boolean)&&<button onClick={()=>{setTutorialDismissed(true);lsSave("tutorialDismissed",true);}} style={{marginTop:12,width:"100%",padding:"12px",background:T.accent,border:"none",borderRadius:10,fontFamily:"inherit",fontSize:13,fontWeight:600,color:T.accentText,cursor:"pointer",minHeight:44}}>All done — hide this ✓</button>}
      </Card>}
      {/* Hero */}
      <Card>
        <div style={{marginBottom:16}}>
          <p style={{margin:"0 0 2px",fontSize:16,color:T.textSecondary,fontWeight:500}}>{greeting()}, {(profile.name||"there").split(" ")[0]} 👋</p>
          <p style={{margin:0,fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{monthLabel(selectedMonth)}</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"repeat(2,1fr)",gap:isDesktop?12:8,marginBottom:16}}>
          <CountUpBox label="Income" val={incTotal} color={T.positive} delay={0} sub={prevIncTotal>0?{col:incTotal>=prevIncTotal?T.positive:T.negative,text:`${incTotal>=prevIncTotal?"+":"-"}${fmt(Math.abs(incTotal-prevIncTotal))} vs last mo`}:null}/>
          <CountUpBox label="Fixed" val={fixedTotal} color={T.info} delay={100} sub={prevFixed>0?{col:fixedTotal<=prevFixed?T.positive:T.negative,text:`${fixedTotal<=prevFixed?"-":"+"}${fmt(Math.abs(fixedTotal-prevFixed))} vs last mo`}:null}/>
          <CountUpBox label="Spent" val={varTotal} color={T.negative} delay={200} sub={prevVarTotal>0?{col:varTotal<=prevVarTotal?T.positive:T.negative,text:`${varTotal<=prevVarTotal?"-":"+"}${fmt(Math.abs(varTotal-prevVarTotal))} vs last mo`}:null}/>
          {incTotal===0
            ?<div style={{background:T.bg,borderRadius:14,padding:isDesktop?"18px 20px":"14px 16px",border:`1px solid ${T.border}`,display:"flex",alignItems:"center"}}><span style={{fontSize:12,color:T.textMuted,cursor:"pointer"}} onClick={()=>setTab("profile")}>Set up income sources →</span></div>
            :<CountUpBox label="Saved" val={saved} color={saved>=0?T.positive:T.negative} delay={300} sub={prevSaved!==0?{col:saved>=prevSaved?T.positive:T.negative,text:`${saved>=prevSaved?"+":"-"}${fmt(Math.abs(saved-prevSaved))} vs last mo`}:null}/>}
        </div>
        {incTotal>0&&<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:T.textMuted}}>Savings rate</span><span style={{fontSize:14,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:700}}>{savingsRate.toFixed(1)}%</span></div>
          <div style={{height:6,background:T.border,borderRadius:6,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:6,transition:"width .6s ease"}}/></div>
          {topCat&&<p style={{margin:0,fontSize:13,color:T.textMuted}}>Top spend: <span style={{color:T.textPrimary,fontWeight:500}}>{topCat[0]}</span> · <span style={{color:T.accent,fontFamily:"'DM Mono'",fontWeight:600}}>{fmt(topCat[1])}</span></p>}
        </>}
      </Card>
      {/* Chart */}
      <Card><SLabel>6-Month Overview</SLabel><SixMonthChart monthlyData={monthlyData} incomeStreams={streams} selectedMonth={selectedMonth} startMonth={profile.startMonth} fixedCommitments={profile.fixedCommitments}/></Card>
      {/* Insights */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:insights.text?14:0}}>
          <div><SLabel style={{margin:"0 0 4px"}}>Claude Insights</SLabel><p style={{margin:0,fontSize:12,color:fullMonths>=3?T.positive:T.textMuted}}>{fullMonths}/3 months {fullMonths>=3?"✓":"— unlocks after 3 full months"}</p>{insights.timestamp&&<p style={{margin:"4px 0 0",fontSize:11,color:T.textMuted}}>Last: {new Date(insights.timestamp).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>}</div>
          <button onClick={generateInsights} disabled={loadingInsights||fullMonths<3} style={{padding:"7px 14px",background:fullMonths>=3?T.accentMuted:"transparent",border:`1px solid ${fullMonths>=3?T.accentBorder:T.border}`,borderRadius:10,color:fullMonths>=3?T.accent:T.textMuted,fontSize:12,fontFamily:"inherit",cursor:fullMonths<3?"default":"pointer",fontWeight:600,flexShrink:0}}>{loadingInsights?"Analysing…":insights.text?"↻ Refresh":"Generate"}</button>
        </div>
        {insights.text?<InsightCards text={insights.text}/>:fullMonths>=3&&<p style={{fontSize:13,color:T.textMuted,margin:"10px 0 0"}}>Tap Generate to analyse your patterns.</p>}
      </Card>
      {/* Budget alerts */}
      {profile.budgets&&Object.keys(profile.budgets).length>0&&(()=>{ const alerts=byCat.filter(([cat,amt])=>{ const b=profile.budgets[cat]; return b&&b>0&&amt>b*0.8; }); if(!alerts.length) return null; return <Card style={{border:`1px solid ${T.warning}50`,background:T.warning+"08"}}><SLabel style={{color:T.warning}}>Budget Alerts</SLabel>{alerts.map(([cat,amt])=>{ const b=profile.budgets[cat]; const pct=amt/b*100; return <div key={cat} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:14,color:T.textPrimary}}>{cat}</span><span style={{fontSize:13,fontFamily:"'DM Mono'",color:pct>=100?T.negative:T.warning,fontWeight:600}}>{fmt(amt)} / {fmt(b)}</span></div><div style={{height:4,background:T.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:pct>=100?T.negative:T.warning,borderRadius:4}}/></div></div>; })}</Card>; })()}
      {/* Nudge */}
      {nudge&&<div onClick={()=>setTab(nudge.tab)} style={{background:nudge.color+"12",border:`1px solid ${nudge.color}35`,borderRadius:16,padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:15,fontWeight:600,color:nudge.color}}>{nudge.title}</div><div style={{fontSize:13,color:nudge.color,opacity:.7,marginTop:3}}>{nudge.sub}</div></div>
        <span style={{fontSize:22,color:nudge.color,opacity:.5}}>→</span>
      </div>}
      {/* Quick add */}
      {quickAddOpen?<Card><SLabel>Quick Add</SLabel>
        <ManualAddForm categories={CATS} defaultDate={todayStr()} onAdd={({description,amount,category,date})=>{
          addManual({description,amount,category,date});
          setQuickAddOpen(false);
        }}/>
        <Btn variant="ghost" onClick={()=>setQuickAddOpen(false)} style={{padding:"10px",fontSize:13,marginTop:8}}>Cancel</Btn>
      </Card>:<button onClick={()=>setQuickAddOpen(true)} style={{padding:"14px",background:"transparent",border:`1.5px dashed ${T.borderMid}`,borderRadius:14,color:T.textMuted,fontFamily:"inherit",fontSize:14,cursor:"pointer",width:"100%"}}>+ Quick add transaction</button>}
    </div>;
  };

  // ── ADD ───────────────────────────────────────────────────────────────────────
  const AddContent=()=><div style={{display:"flex",flexDirection:"column",gap:16}}>
    {/* Import — hero, full width */}
    <Card>
      <div onClick={()=>!uploading&&fileRef.current.click()} onMouseEnter={e=>{if(!uploading)e.currentTarget.style.borderColor=T.accent+"70";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.borderMid;}} style={{border:`2px dashed ${T.borderMid}`,borderRadius:14,padding:"36px 20px",textAlign:"center",cursor:uploading?"default":"pointer",transition:"border-color .2s"}}>
        <div style={{fontSize:44,marginBottom:12}}>{uploading?"⏳":"📄"}</div>
        <p style={{margin:"0 0 6px",fontWeight:700,fontSize:18,color:T.textPrimary}}>{uploading?"Importing…":"Upload your bank statement"}</p>
        <p style={{margin:"0 0 12px",color:T.textMuted,fontSize:14,lineHeight:1.6}}>PDF, CSV, or image · Any bank · Claude extracts everything · You review before saving</p>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.warning+"18",border:`1px solid ${T.warning}40`,borderRadius:8,padding:"8px 14px",marginBottom:18}}><span style={{fontSize:14}}>📶</span><span style={{fontSize:13,color:T.warning,fontWeight:500}}>Use WiFi for best results</span></div>
        <div><div style={{display:"inline-block",padding:"13px 32px",background:uploading?T.border:T.accent,color:uploading?T.textMuted:T.accentText,borderRadius:12,fontWeight:700,fontSize:15}}>{uploading?"Working…":"Choose File"}</div></div>
        {uploadMsg&&<p style={{marginTop:14,fontSize:13,color:uploadMsg.startsWith("✓")?T.positive:T.negative,margin:"14px 0 0"}}>{uploadMsg}</p>}
      </div>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf,text/csv,.csv,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style={{display:"none"}} onChange={handleFile}/>
    </Card>
    {/* Manual add */}
    <Card>
      <SLabel>Add manually</SLabel>
      <ManualAddForm categories={CATS} defaultDate={todayStr()} onAdd={addManual}/>
    </Card>
  </div>;

  // ── REVIEW ────────────────────────────────────────────────────────────────────
  const ReviewContent=()=>{
    const archiveOpen=reviewArchiveOpen; const setArchiveOpen=setReviewArchiveOpen;
    const skippedOpen=reviewSkippedOpen; const setSkippedOpen=setReviewSkippedOpen;
    const allCats=[...CATS,...FIXED_CATS];
    const toggleCat=(id,cat)=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,category:cat}:t));
    const toggle=id=>setPendingTxs(p=>p.map(t=>t.id===id?{...t,checked:!t.checked}:t));
    const months=[...new Set(pendingTxs.map(t=>monthKey(t.date)))].sort(); const isMulti=months.length>1;
    const renderRow=(t,dimmed=false)=>{ const isCredit=t.amount<0; return <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:12,background:T.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${isCredit?T.positive+"50":dimmed?T.border:T.borderMid}`,opacity:dimmed?0.55:1,boxShadow:T.cardShadow,marginBottom:8}}>
      <Check checked={t.checked} onChange={()=>toggle(t.id)}/>
      <div style={{width:38,height:38,borderRadius:11,flexShrink:0,background:(CCOLS[t.category]||"#868E96")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{t.category?.split(" ")[0]}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:dimmed?T.textMuted:T.textPrimary,marginBottom:5}}>
          {t.description}{t.source==="imported"&&<span style={{marginLeft:7,fontSize:10,color:T.accent,opacity:.5,fontFamily:"'DM Mono'"}}>AI</span>}
          {isCredit&&<span style={{marginLeft:7,fontSize:10,color:T.positive,fontFamily:"'DM Mono'",border:`1px solid ${T.positive}40`,borderRadius:5,padding:"1px 7px"}}>CR</span>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{t.date}</span>
          <select value={t.category} onChange={e=>toggleCat(t.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{fontSize:12,padding:"2px 6px",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:6,color:T.textSecondary,fontFamily:"inherit",cursor:"pointer"}}>{allCats.map(c=><option key={c}>{c}</option>)}</select>
          {t.habitReason&&<span style={{fontSize:11,color:T.accent,opacity:.6,fontFamily:"'DM Mono'",border:`1px solid ${T.accentBorder}`,borderRadius:5,padding:"1px 7px"}}>{t.habitReason}</span>}
        </div>
      </div>
      <div style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:700,color:isCredit?T.positive:dimmed?T.textMuted:T.textPrimary,flexShrink:0}}>{isCredit?"-":""}{fmt(Math.abs(t.amount))}</div>
    </div>; };

    return <div style={{paddingBottom:90}}>
      {/* Pending imports */}
      {pendingTxs.length===0
        ?<Card style={{textAlign:"center",padding:"48px 20px"}}>
            <div style={{fontSize:44,marginBottom:14}}>📋</div>
            <p style={{margin:"0 0 8px",fontSize:16,fontWeight:600,color:T.textSecondary}}>Nothing to review</p>
            <p style={{margin:"0 0 20px",fontSize:14,color:T.textMuted,lineHeight:1.6}}>Import a bank statement from the Add tab and your transactions will appear here to check before saving.</p>
            <button onClick={()=>setTab("add")} style={{padding:"12px 28px",background:T.accent,border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:14,color:T.accentText,cursor:"pointer"}}>Go to Add →</button>
          </Card>
        :<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div><span style={{fontSize:14,color:T.textSecondary}}>{checkedCount}/{pendingTxs.length} selected</span><span style={{marginLeft:12,fontSize:16,color:T.accent,fontFamily:"'DM Mono'",fontWeight:700}}>{fmt(pendingTxs.filter(t=>t.checked).reduce((s,t)=>s+t.amount,0))}</span></div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:true})))} style={{padding:"10px 16px",borderRadius:9,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>All</button>
              <button onClick={()=>setPendingTxs(p=>p.map(t=>({...t,checked:false})))} style={{padding:"10px 16px",borderRadius:9,border:`1px solid ${T.borderMid}`,background:"transparent",color:T.textSecondary,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>None</button>
            </div>
          </div>
          {months.map(month=>{ const mTxs=pendingTxs.filter(t=>monthKey(t.date)===month); const allChk=mTxs.every(t=>t.checked); const normal=mTxs.filter(t=>!t.habitReason); const flagged=mTxs.filter(t=>t.habitReason);
            return <div key={month} style={{marginBottom:20}}>
              {isMulti&&<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <Check checked={allChk} onChange={()=>setPendingTxs(p=>p.map(t=>monthKey(t.date)===month?{...t,checked:!allChk}:t))}/>
                <div style={{fontSize:12,fontWeight:700,color:T.accent,fontFamily:"'DM Mono'",letterSpacing:1.5,textTransform:"uppercase"}}>{monthLabel(month)}</div>
                <div style={{flex:1,height:"1px",background:T.border}}/>
                <div style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'"}}>{mTxs.filter(t=>t.checked).length}/{mTxs.length}</div>
              </div>}
              {normal.map(t=>renderRow(t))}
              {flagged.length>0&&<><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,marginTop:10}}><span style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",whiteSpace:"nowrap",letterSpacing:.5}}>USUALLY EXCLUDED ({flagged.length})</span><div style={{flex:1,height:"1px",background:T.border}}/></div>{flagged.map(t=>renderRow(t,true))}</>}
            </div>; })}
        </div>}

      {/* Skipped transactions (archive) */}
      <div style={{marginTop:16}}>
        <button onClick={()=>setArchiveOpen(o=>!o)} style={{width:"100%",padding:"14px 18px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:14,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:44}}>
          <span style={{fontWeight:500}}>🗑 Skipped transactions <span style={{color:T.textMuted,fontWeight:400}}>({archive.length})</span></span>
          <span style={{fontSize:13,color:T.textMuted}}>{archiveOpen?"▲":"▼"}</span>
        </button>
        {archiveOpen&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
          {archive.length===0
            ?<p style={{fontSize:14,color:T.textMuted,padding:"14px 0",margin:0}}>Transactions you uncheck during review appear here. You can restore them anytime.</p>
            :archive.slice(0,60).map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:T.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.border}`,minHeight:44}}>
              <span style={{fontSize:18,flexShrink:0}}>{t.category?.split(" ")[0]||"📦"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:T.textSecondary,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.description}</div>
                <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",marginTop:2}}>{t.date} · {t.category}</div>
              </div>
              <div style={{fontFamily:"'DM Mono'",fontSize:13,color:T.textMuted,flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
              <button onClick={()=>restoreToReview(t.id)} style={{padding:"8px 16px",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0,fontWeight:600,minHeight:36}}>Restore</button>
            </div>)}
        </div>}
      </div>

      {/* Auto-skipped (habit memory) */}
      <div style={{marginTop:10}}>
        <button onClick={()=>setSkippedOpen(o=>!o)} style={{width:"100%",padding:"14px 18px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:14,fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:44}}>
          <span style={{fontWeight:500}}>🧠 Auto-skipped <span style={{color:T.textMuted,fontWeight:400}}>({Object.keys(mf).length})</span></span>
          <span style={{fontSize:13,color:T.textMuted}}>{skippedOpen?"▲":"▼"}</span>
        </button>
        {skippedOpen&&<div style={{marginTop:10}}>
          {Object.keys(mf).length===0
            ?<p style={{fontSize:14,color:T.textMuted,padding:"14px 0",margin:0}}>Transactions you skip repeatedly will be auto-unchecked on future imports. None yet.</p>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <p style={{margin:0,fontSize:13,color:T.textMuted}}>These are auto-unchecked when imported. Tap × to remove from memory.</p>
                <button onClick={()=>{setEh({});setCh({});lsSave("excludeHistory",{});lsSave("catExcludeHistory",{});showToast("Auto-skipped cleared");}} style={{padding:"6px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.negative,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0,marginLeft:10}}>Clear all</button>
              </div>
              {Object.entries(mf).map(([desc,val])=>{
                const tx=typeof val==="object"?val.lastTx:null;
                const count=typeof val==="object"?val.count:val;
                return <div key={desc} style={{display:"flex",alignItems:"center",gap:12,background:T.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.border}`,minHeight:44}}>
                  <span style={{fontSize:18,flexShrink:0}}>{tx?.category?.split(" ")[0]||"📦"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:T.textSecondary,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tx?.description||desc}</div>
                    <div style={{fontSize:11,color:T.textMuted,fontFamily:"'DM Mono'",marginTop:2}}>
                      {tx?.date||""}{tx?.category?` · ${tx.category}`:""}
                      <span style={{marginLeft:8,color:T.warning,fontSize:10}}>skipped {count}×</span>
                    </div>
                  </div>
                  {tx&&<div style={{fontFamily:"'DM Mono'",fontSize:13,color:T.textMuted,flexShrink:0}}>{fmt(Math.abs(tx.amount))}</div>}
                  <button onClick={()=>{const n={...eh};delete n[desc];setEh(n);lsSave("excludeHistory",n);}} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:22,padding:"8px",flexShrink:0,lineHeight:1,minHeight:44,display:"flex",alignItems:"center"}}>×</button>
                </div>;
              })}
            </div>}
        </div>}
      </div>
    </div>;
  };

  // ── MONEY ─────────────────────────────────────────────────────────────────────
  const MoneyContent=()=>{
    const showIncome=moneyShowIncome; const setShowIncome=setMoneyShowIncome;
    const showBills=moneyShowBills; const setShowBills=setMoneyShowBills;
    const showGoals=moneyShowGoals; const setShowGoals=setMoneyShowGoals;
    const showTxs=moneyShowTxs; const setShowTxs=setMoneyShowTxs;
    const Section=({label,count,total,color,open,onToggle,children})=><div style={{marginBottom:4}}>
      <button onClick={onToggle} style={{width:"100%",padding:"14px 18px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:open?`14px 14px 0 0`:"14px",fontFamily:"inherit",fontSize:14,color:T.textSecondary,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:44}}>
        <span style={{fontWeight:500}}>{label}{count!==undefined&&<span style={{color:T.textMuted,fontWeight:400}}> ({count})</span>}</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {total!==undefined&&<span style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:700,color:color||T.textPrimary}}>{fmt(total)}</span>}
          <span style={{fontSize:13,color:T.textMuted}}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:"none",borderRadius:`0 0 14px 14px`,padding:"14px 18px"}}>{children}</div>}
    </div>;

    return <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {incTotal===0&&<div style={{background:T.info+"12",border:`1px solid ${T.info}30`,borderRadius:14,padding:"14px 18px",fontSize:14,color:T.info}}>Set up income sources in Profile to see your full breakdown.</div>}

      {/* Stat cards — always visible */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <SLabel style={{margin:0}}>{monthLabel(selectedMonth)}</SLabel>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>exportMonthHTML(selectedMonth,profile,md,streams)} style={{padding:"8px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500,minHeight:36}}>📄 PDF</button>
            <button onClick={()=>makeShareCard(selectedMonth,profile,md,streams)} style={{padding:"8px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500,minHeight:36}}>🖼 Share</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"repeat(2,1fr)",gap:12,marginBottom:16}}>
          {[["Income",incTotal,T.positive],["Bills",fixedTotal,T.info],["Spending",varTotal,T.negative],["Saved",saved,saved>=0?T.positive:T.negative]].map(([label,val,color])=><div key={label} style={{background:T.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>{label}</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:"'DM Mono'",color}}>{incTotal===0&&label==="Saved"?"—":fmt(val)}</div>
          </div>)}
        </div>
        {incTotal>0&&<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:T.textMuted}}>Savings rate</span><span style={{fontSize:14,fontFamily:"'DM Mono'",color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontWeight:700}}>{savingsRate.toFixed(1)}%</span></div>
          <div style={{height:6,background:T.border,borderRadius:6,overflow:"hidden",marginBottom:10}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:6}}/></div>
        </>}
      </Card>

      {/* Spending — always expanded */}
      <Card>
        <SLabel>Spending</SLabel>
        {byCat.length===0?<p style={{fontSize:14,color:T.textMuted,margin:0}}>No transactions yet for {monthLabel(selectedMonth)}</p>:<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {byCat.map(([cat,amt])=>{ const budget=profile.budgets?.[cat]; const pct=varTotal!==0?(Math.abs(amt)/Math.abs(varTotal)*100):0; const bPct=budget&&budget>0?amt/budget*100:null;
            return <div key={cat}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:14,color:T.textPrimary}}>{cat}</span><div style={{textAlign:"right"}}><span style={{fontFamily:"'DM Mono'",fontSize:14,color:amt<0?T.positive:T.accent,fontWeight:600}}>{amt<0?"-":""}{fmt(Math.abs(amt))}</span>{budget&&budget>0&&<span style={{fontSize:11,color:bPct>=100?T.negative:bPct>=80?T.warning:T.textMuted,fontFamily:"'DM Mono'",marginLeft:8}}>/ {fmt(budget)}</span>}</div></div>
              <div style={{height:4,background:T.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:CCOLS[cat]||T.accent,borderRadius:4}}/></div>
              {budget&&budget>0&&<div style={{height:3,background:T.border,borderRadius:3,overflow:"hidden",marginTop:2}}><div style={{height:"100%",width:`${Math.min(100,bPct||0)}%`,background:bPct>=100?T.negative:bPct>=80?T.warning:T.info,borderRadius:3}}/></div>}
            </div>; })}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.textMuted}}>Total spending</span><span style={{fontFamily:"'DM Mono'",fontSize:15,color:varTotal<0?T.positive:T.negative,fontWeight:700}}>{fmt(varTotal)}</span></div>
        </div>}
      </Card>

      {/* Income sources — collapsible */}
      <Section label="Income sources" total={incTotal} color={T.positive} open={showIncome} onToggle={()=>setShowIncome(o=>!o)}>
        <IncomeBreakdown streams={streams} ov={ov} prevOv={prevOv} fmt={fmt} month={selectedMonth} onUpdateOv={updateOv}/>
      </Section>

      {/* Bills — collapsible */}
      <Section label="Bills" total={fixedTotal} color={T.info} open={showBills} onToggle={()=>setShowBills(o=>!o)}>
        {monthFixed.length===0?<p style={{fontSize:14,color:T.textMuted,margin:0}}>No bills set up. Add them in Profile →</p>:<div>
          {monthFixed.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <div><span style={{fontSize:14,color:T.textSecondary}}>{c.name}</span>{c.endMonth&&<span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>until {monthLabelShort(c.endMonth)}</span>}</div>
            <EditableAmt value={+c.amount||0} fmt={fmt} color={T.info} onSave={v=>{saveProfile({...profile,fixedCommitments:profile.fixedCommitments.map(x=>x.id===c.id?{...x,amount:v}:x)});showToast("Updated");}}/>
          </div>)}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8}}><span style={{fontSize:13,color:T.textMuted}}>Total</span><span style={{fontFamily:"'DM Mono'",fontSize:15,color:T.info,fontWeight:700}}>{fmt(fixedTotal)}</span></div>
        </div>}
      </Section>

      {/* Goals — collapsible */}
      {profile.goals?.length>0&&<Section label="Goals" count={profile.goals.length} open={showGoals} onToggle={()=>setShowGoals(o=>!o)}>
        {profile.goals.map(g=>{ const appSaved=Object.values(monthlyData).reduce((s,md)=>{ const inc=totalIncome(streams,md.incomeOverrides||{},selectedMonth); const spent=(md.txs||[]).reduce((a,t)=>a+t.amount,0); const fix=(md.fixedOverrides||profile.fixedCommitments||[]).reduce((a,c)=>a+(+c.amount||0),0); return s+Math.max(0,inc-spent-fix); },0); const ts=appSaved+(g.startingBalance||0); const pct=g.target>0?Math.min(100,ts/g.target*100):0; const daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/(1000*60*60*24)):null;
          return <div key={g.id} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:14,fontWeight:500,color:T.textPrimary}}>{g.name}</span><span style={{fontSize:13,color:T.textMuted,fontFamily:"'DM Mono'"}}>{fmt(ts)} / {fmt(g.target)}</span></div><div style={{height:6,background:T.border,borderRadius:6,overflow:"hidden",marginBottom:5}}><div style={{height:"100%",width:`${pct}%`,background:T.accent,borderRadius:6}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textMuted}}><span>{pct.toFixed(1)}%{g.startingBalance?` (incl. ${fmt(g.startingBalance)} existing)`:""}</span>{daysLeft!=null&&<span style={{color:daysLeft<30?T.warning:T.textMuted}}>{daysLeft>0?`${daysLeft} days left`:"Past due"}</span>}</div></div>; })}
      </Section>}

      {/* Transactions — collapsible */}
      <Section label="Transactions" count={filteredTxs.length} open={showTxs} onToggle={()=>setShowTxs(o=>!o)}>
        {committedTxs.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,paddingBottom:4}}>
          {["All",...Object.keys(Object.fromEntries(byCat))].map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${catFilter===c?T.accent:T.borderMid}`,background:catFilter===c?T.accentMuted:"transparent",color:catFilter===c?T.accent:T.textMuted,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0,fontWeight:catFilter===c?600:400,minHeight:36}}>{c==="All"?"All":c.split(" ")[0]}</button>)}
        </div>}
        {filteredTxs.length===0?<p style={{fontSize:14,color:T.textMuted,margin:0}}>No transactions for {monthLabel(selectedMonth)}</p>:<div style={{display:"flex",flexDirection:"column",gap:6}}>{filteredTxs.map(t=><CompactTxRow key={t.id} tx={t} onArchive={archiveTx} onEdit={editTx} fmt={fmt} customCategories={profile.customCategories}/>)}</div>}
      </Section>
    </div>;
  };

  // ── PROFILE ───────────────────────────────────────────────────────────────────
// ╔══════════════════════════════════════════════════════════════╗
// ║  PART 2A — Profile Tab (inner component only)               ║
// ║  Paste this INSIDE the App() function, replacing            ║
// ║  the ProfileContent const                                    ║
// ╚══════════════════════════════════════════════════════════════╝

  const ProfileContent=()=>{
    const [p,setP]=useState(profile);
    const [btnLbl,setBtnLbl]=useState("Save Profile");
    const [showRst,setShowRst]=useState(false);
    const [restCand,setRestCand]=useState(null);
    const avatarRef=useRef();
    const restRef=useRef();
    useEffect(()=>setP(profile),[profile.name,profile.avatar]);

    const [cropSrc,setCropSrc]=useState(null);
    const handleAv=e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader();
      r.onload=ev=>setCropSrc(ev.target.result);
      r.readAsDataURL(f);
    };

    const updS=(id,field,val)=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.map(s=>s.id===id?{...s,[field]:val}:s)}));
    const addS=()=>setP(prev=>({...prev,incomeStreams:[...(prev.incomeStreams||[]),{id:`s${Date.now()}`,name:"",type:"fixed",defaultAmount:0,active:true,startFrom:""}]}));
    const rmS=id=>setP(prev=>({...prev,incomeStreams:prev.incomeStreams.filter(s=>s.id!==id)}));

    const updF=(id,field,val)=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.map(c=>c.id===id?{...c,[field]:val}:c)}));
    const addF=()=>setP(prev=>({...prev,fixedCommitments:[...(prev.fixedCommitments||[]),{id:`c${Date.now()}`,name:"",amount:0,startFrom:"",endMonth:""}]}));
    const rmF=id=>setP(prev=>({...prev,fixedCommitments:prev.fixedCommitments.filter(c=>c.id!==id)}));

    const updG=(id,field,val)=>setP(prev=>({...prev,goals:(prev.goals||[]).map(g=>g.id===id?{...g,[field]:val}:g)}));
    const addG=()=>setP(prev=>({...prev,goals:[...(prev.goals||[]),{id:`g${Date.now()}`,name:"",target:0,date:"",startingBalance:0}]}));
    const rmG=id=>setP(prev=>({...prev,goals:(prev.goals||[]).filter(g=>g.id!==id)}));

    const addCC=()=>setP(prev=>({...prev,customCategories:[...(prev.customCategories||[]),{id:`cc${Date.now()}`,name:"",emoji:"🏷️",color:"#868E96"}]}));
    const updCC=(id,field,val)=>setP(prev=>({...prev,customCategories:(prev.customCategories||[]).map(c=>c.id===id?{...c,[field]:val}:c)}));
    const rmCC=id=>setP(prev=>({...prev,customCategories:(prev.customCategories||[]).filter(c=>c.id!==id)}));

    const typeCol=t=>t==="fixed"?T.info:t==="variable"?T.warning:T.positive;
    const txCount=countAllTx(monthlyData);
    const moCount=Object.keys(monthlyData).length;

    const handleRestFile=e=>{
      const file=e.target.files[0]; if(!file) return;
      const r=new FileReader();
      r.onload=()=>{
        try{
          const snap=JSON.parse(r.result);
          if(!snap.version||!snap.profile) throw new Error("Invalid");
          setRestCand(snap);
        }catch{ showToast("⚠ Invalid backup file"); }
      };
      r.readAsText(file); e.target.value="";
    };

    const doRest=snap=>{
      saveProfile(snap.profile||DEFAULT_PROFILE);
      lsSave("monthlyData",snap.monthlyData||{}); setMonthlyData(snap.monthlyData||{});
      lsSave("excludeHistory",snap.excludeHistory||{}); setEh(snap.excludeHistory||{});
      lsSave("catExcludeHistory",snap.catExcludeHistory||{}); setCh(snap.catExcludeHistory||{});
      if(snap.insights){setInsights(snap.insights);lsSave("insights",snap.insights);}
      if(snap.archive){saveArchive(snap.archive);}
      setRestCand(null); showToast("✓ Backup restored"); window.location.reload();
    };

    const doSave=()=>{
      saveProfile({...p,onboarded:true});
      setBtnLbl("Saved ✓"); setTimeout(()=>setBtnLbl("Save Profile"),2000);
    };

    const PCATS=getAllCats(p.customCategories);
    const inp2={padding:"11px 14px",background:T.surface2,border:`1px solid ${T.borderMid}`,borderRadius:10,color:T.textPrimary,fontFamily:"inherit",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"};
    const sectionHead=(label,onAdd)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <SLabel style={{margin:0}}>{label}</SLabel>
      {onAdd&&<button onClick={onAdd} style={{padding:"6px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,color:T.textSecondary,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ Add</button>}
    </div>;

    return <div style={{display:"flex",flexDirection:"column",gap:16,paddingBottom:40}}>
      {cropSrc&&<AvatarCropModal src={cropSrc} onSave={data=>{setP(v=>({...v,avatar:data}));setCropSrc(null);}} onClose={()=>setCropSrc(null)}/>}
      {restCand&&<RestoreModal backup={restCand} onConfirm={()=>doRest(restCand)} onClose={()=>setRestCand(null)}/>}
      {showRst&&<ResetModal onConfirm={doReset} onClose={()=>setShowRst(false)} onDownloadFirst={()=>{dlBackup(profile,monthlyData,eh,ch,insights,archive);showToast("Backup downloaded");}}/>}
      <input ref={restRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestFile}/>

      {/* ── Identity ── */}
      <Card>
        <SLabel>Identity</SLabel>
        <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:18}}>
          <div style={{position:"relative",flexShrink:0,width:72,height:72}}>
            <div onClick={()=>avatarRef.current.click()} style={{width:72,height:72,borderRadius:"50%",background:T.accentMuted,border:`2px dashed ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
              {p.avatar
                ?<img src={p.avatar} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:"50%",display:"block"}}/>
                :<span style={{fontSize:28,color:T.accent}}>{p.name?p.name[0].toUpperCase():"+"}</span>}
            </div>
            <div onClick={()=>avatarRef.current.click()} style={{position:"absolute",bottom:-2,right:-2,width:24,height:24,borderRadius:"50%",background:T.accent,border:`2px solid ${T.surface}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.accentText,cursor:"pointer",zIndex:1}}>✎</div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAv}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
            <input type="text" placeholder="Your name" value={p.name} onChange={e=>setP(v=>({...v,name:e.target.value}))} style={inp2}/>
            <input type="text" placeholder="Occupation" value={p.occupation||""} onChange={e=>setP(v=>({...v,occupation:e.target.value}))} style={inp2}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:5}}>Currency</div>
            <select value={p.currency} onChange={e=>setP(v=>({...v,currency:e.target.value}))} style={inp2}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:5}}>Tracking from</div>
            <input type="month" value={p.startMonth||""} onChange={e=>setP(v=>({...v,startMonth:e.target.value}))} style={inp2}/>
          </div>
        </div>
      </Card>

      {/* ── Theme ── */}
      <Card><ThemePresets accentColor={p.accentColor||"#C8FF57"} bgColor={p.bgColor||"#0C0C12"} onChange={(ac,bg)=>setP(x=>({...x,accentColor:ac,bgColor:bg}))}/></Card>

      {/* ── Income Sources ── */}
      <Card>
        {sectionHead("Income sources",addS)}
        <DragList
          items={p.incomeStreams||[]}
          onReorder={list=>setP(prev=>({...prev,incomeStreams:list}))}
          renderItem={(s,_idx,stepper)=><div style={{background:T.surface2,borderRadius:12,padding:"14px",border:`1px solid ${T.border}`,marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,marginBottom:10,alignItems:"center"}}>
              <input type="text" placeholder="Stream name" value={s.name} onChange={e=>updS(s.id,"name",e.target.value)} style={inp2}/>
              {stepper}
              <button onClick={()=>rmS(s.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1}}>×</button>
            </div>
            <div style={{display:"flex",borderRadius:9,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:10}}>
              {["fixed","variable","oneoff"].map(t=><button key={t} onClick={()=>updS(s.id,"type",t)} style={{flex:1,padding:"8px 4px",background:s.type===t?typeCol(t):"transparent",border:"none",color:s.type===t?"#fff":T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:s.type===t?700:400,transition:"background .15s"}}>
                {t==="oneoff"?"One-off":t.charAt(0).toUpperCase()+t.slice(1)}
              </button>)}
            </div>
            {s.type==="fixed"&&<input type="number" placeholder="Monthly amount" value={s.defaultAmount||""} onChange={e=>updS(s.id,"defaultAmount",parseFloat(e.target.value)||0)} style={{...inp2,marginBottom:10}}/>}
            {s.type!=="variable"&&<div>
              <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>
                {s.type==="oneoff"?"For which month (one-off income)?":"Active from (leave blank = app start month)"}
              </div>
              <input type="month" value={s.startFrom||""} onChange={e=>updS(s.id,"startFrom",e.target.value)} style={inp2}/>
            </div>}
          </div>}
        />
        {!(p.incomeStreams||[]).length&&<p style={{fontSize:14,color:T.textMuted,margin:0}}>No income streams yet</p>}
      </Card>

      {/* ── Fixed Commitments ── */}
      <Card>
        {sectionHead("Bills",addF)}
        <DragList
          items={p.fixedCommitments||[]}
          onReorder={list=>setP(prev=>({...prev,fixedCommitments:list}))}
          renderItem={(c,_idx,stepper)=><div style={{background:T.surface2,borderRadius:12,padding:"14px",border:`1px solid ${T.border}`,marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px auto auto",gap:8,marginBottom:12,alignItems:"center"}}>
              <input type="text" placeholder="Name (e.g. Insurance)" value={c.name} onChange={e=>updF(c.id,"name",e.target.value)} style={inp2}/>
              <input type="number" placeholder="0" value={c.amount||""} onChange={e=>updF(c.id,"amount",parseFloat(e.target.value)||0)} style={{...inp2,textAlign:"right"}}/>
              {stepper}
              <button onClick={()=>rmF(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1,minHeight:44}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>Start from (blank = always)</div>
                <input type="month" value={c.startFrom||""} onChange={e=>updF(c.id,"startFrom",e.target.value)} style={inp2}/>
              </div>
              <div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>End month (blank = ongoing)</div>
                <input type="month" value={c.endMonth||""} onChange={e=>updF(c.id,"endMonth",e.target.value)} style={inp2}/>
              </div>
            </div>
          </div>}
        />
        {!(p.fixedCommitments||[]).length&&<p style={{fontSize:14,color:T.textMuted,margin:0}}>No fixed commitments yet</p>}
      </Card>

      {/* ── Custom Categories ── */}
      <Card>
        {sectionHead("Custom Categories",addCC)}
        {(p.customCategories||[]).map(c=><div key={c.id} style={{display:"grid",gridTemplateColumns:"auto auto 1fr auto",gap:10,marginBottom:10,alignItems:"center"}}>
          <input value={c.emoji} onChange={e=>updCC(c.id,"emoji",e.target.value)} style={{...inp2,width:52,textAlign:"center",padding:"11px 4px",fontSize:18}} maxLength={2}/>
          <input type="color" value={c.color||"#868E96"} onChange={e=>updCC(c.id,"color",e.target.value)} style={{width:44,height:44,border:`1px solid ${T.border}`,borderRadius:10,cursor:"pointer",background:"transparent",padding:2}}/>
          <input type="text" placeholder="Category name" value={c.name} onChange={e=>updCC(c.id,"name",e.target.value)} style={inp2}/>
          <button onClick={()=>rmCC(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1}}>×</button>
        </div>)}
        {!(p.customCategories||[]).length&&<p style={{fontSize:14,color:T.textMuted,margin:0}}>No custom categories yet</p>}
      </Card>

      {/* ── Monthly Budgets ── */}
      <Card>
        <SLabel>Monthly Budgets</SLabel>
        <p style={{margin:"0 0 14px",fontSize:13,color:T.textMuted,lineHeight:1.6}}>Optional limits per category. Budget alerts appear on Home when you're over 80%.</p>
        {BUILTIN_CATEGORIES.concat((p.customCategories||[]).map(c=>`${c.emoji} ${c.name}`)).map(cat=>{
          const val=p.budgets?.[cat]||"";
          return <div key={cat} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <span style={{fontSize:14,color:T.textSecondary,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat}</span>
            <input type="number" placeholder="No limit" value={val} onChange={e=>setP(v=>({...v,budgets:{...v.budgets,[cat]:parseFloat(e.target.value)||0}}))} style={{...inp2,width:130,textAlign:"right"}}/>
          </div>;
        })}
      </Card>

      {/* ── Financial Goals ── */}
      <Card>
        {sectionHead("Financial Goals",addG)}
        {(p.goals||[]).map(g=><div key={g.id} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:10,alignItems:"center"}}>
            <input type="text" placeholder="Goal name (e.g. Emergency Fund)" value={g.name} onChange={e=>updG(g.id,"name",e.target.value)} style={inp2}/>
            <button onClick={()=>rmG(g.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>Target amount</div>
              <input type="number" placeholder="0" value={g.target||""} onChange={e=>updG(g.id,"target",parseFloat(e.target.value)||0)} style={inp2}/>
            </div>
            <div>
              <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>Target date</div>
              <input type="date" value={g.date||""} onChange={e=>updG(g.id,"date",e.target.value)} style={inp2}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>Starting balance (savings you already have)</div>
            <input type="number" placeholder="0" value={g.startingBalance||""} onChange={e=>updG(g.id,"startingBalance",parseFloat(e.target.value)||0)} style={inp2}/>
            <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>This is counted toward the goal on top of what the app tracks.</div>
          </div>
        </div>)}
        {!(p.goals||[]).length&&<p style={{fontSize:14,color:T.textMuted,margin:0}}>No goals set yet</p>}
      </Card>

      {/* ── Data & Backup ── */}
      <Card>
        <SLabel>Data & Backup</SLabel>
        <p style={{margin:"0 0 14px",fontSize:14,color:T.textSecondary}}>{txCount>0?`${txCount} transactions across ${moCount} month${moCount!==1?"s":""}.`:"No transaction data yet."}</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button
            onClick={()=>txCount>0&&exportCSV(monthlyData)}
            style={{padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:txCount>0?T.textSecondary:T.textMuted,fontFamily:"inherit",fontSize:14,cursor:txCount>0?"pointer":"default",textAlign:"left",opacity:txCount>0?1:0.5,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18}}>⬇</span>
            <div><div style={{fontWeight:500}}>Export transactions as CSV</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>All months, all categories</div></div>
          </button>
          <button
            onClick={()=>dlBackup(profile,monthlyData,eh,ch,insights,archive)}
            style={{padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:T.textSecondary,fontFamily:"inherit",fontSize:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18}}>⬇</span>
            <div><div style={{fontWeight:500}}>Download full backup (JSON)</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Includes all data, settings, and history</div></div>
          </button>
          <button
            onClick={()=>restRef.current.click()}
            style={{padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:T.textSecondary,fontFamily:"inherit",fontSize:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18}}>↑</span>
            <div><div style={{fontWeight:500}}>Restore from backup</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Load a previously downloaded JSON file</div></div>
          </button>
          <button
            onClick={()=>{ lsSave("pinHash",null); setPinHash(null); setPinUnlocked(false); setPinSkipped(false); }}
            style={{padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:T.textSecondary,fontFamily:"inherit",fontSize:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18}}>🔐</span>
            <div><div style={{fontWeight:500}}>Change / Remove PIN</div><div style={{fontSize:12,color:T.textMuted,marginTop:2}}>You'll be taken to PIN setup on next open</div></div>
          </button>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowPrivacy(true)} style={{flex:1,padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:T.textSecondary,fontFamily:"inherit",fontSize:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>🔒</span><span style={{fontWeight:500}}>Privacy Policy</span>
            </button>
            <a href="/landing" style={{flex:1,padding:"13px 16px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:11,color:T.textSecondary,fontFamily:"inherit",fontSize:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
              <span style={{fontSize:18}}>🏠</span><span style={{fontWeight:500}}>About</span>
            </a>
          </div>
          {(()=>{
            const ab=lsLoad("autoBackups")||[];
            if(!ab.length) return null;
            return <div style={{background:T.surface2,borderRadius:11,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:T.textMuted,fontFamily:"'DM Mono'",letterSpacing:1}}>AUTO-BACKUPS ({ab.length})</span>
                <span style={{fontSize:11,color:T.textMuted}}>Tap to restore</span>
              </div>
              {ab.slice(0,5).map((snap,i)=>{
                const date=new Date(snap.createdAt);
                const txCount=countAllTx(snap.monthlyData||{});
                return <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:i<Math.min(ab.length,5)-1?`1px solid ${T.border}`:"none"}}>
                  <div>
                    <div style={{fontSize:13,color:T.textPrimary,fontWeight:500}}>{date.toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{date.toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"})} · {txCount} transactions</div>
                  </div>
                  <button onClick={()=>setRestCand(snap)} style={{padding:"5px 14px",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,flexShrink:0}}>Restore</button>
                </div>;
              })}
            </div>;
          })()}
        </div>
      </Card>

      {/* ── Save ── */}
      <button onClick={doSave} style={{padding:"15px",background:btnLbl.includes("✓")?T.positive:T.accent,border:"none",borderRadius:13,fontFamily:"inherit",fontWeight:700,fontSize:15,color:btnLbl.includes("✓")?"#fff":T.accentText,cursor:"pointer",width:"100%",transition:"background .3s",boxShadow:btnLbl.includes("✓")?"none":`0 4px 16px ${T.accent}40`}}>{btnLbl}</button>

      {/* ── Reset ── */}
      <button onClick={()=>setShowRst(true)} style={{padding:"13px",background:"transparent",border:`1px solid ${T.negative}40`,borderRadius:12,fontFamily:"inherit",fontSize:14,color:T.negative,cursor:"pointer",width:"100%",marginBottom:8}}>Reset Everything & Start Again</button>
    </div>;
  };
  // ── renderContent ────────────────────────────────────────────────────────────
  const renderContent=()=>{
    const wrap=children=><div style={{maxWidth:isDesktop?760:580,margin:"0 auto",padding:isDesktop?"32px 40px":"16px 16px 16px"}}>{children}</div>;
    return <>
      {tab==="home"&&wrap(<HomeContent/>)}
      {tab==="add"&&wrap(<AddContent/>)}
      {tab==="review"&&wrap(<ReviewContent/>)}
      {tab==="money"&&wrap(<MoneyContent/>)}
      {tab==="profile"&&wrap(<ProfileContent/>)}
    </>;
  };

  // ── Return ────────────────────────────────────────────────────────────────────
  return <ThemeCtx.Provider value={theme}>
    <div style={{minHeight:"100vh",background:T.bg,color:T.textPrimary,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",display:"flex",flexDirection:isDesktop?"row":"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>

      {/* Global overlays */}
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {showPrivacy&&<PrivacyModal onClose={()=>setShowPrivacy(false)}/>}
      {restoreCandidate&&<RestoreModal backup={restoreCandidate} onConfirm={()=>doRestore(restoreCandidate)} onClose={()=>setRestoreCandidate(null)}/>}
      {showReset&&<ResetModal onConfirm={doReset} onClose={()=>setShowReset(false)} onDownloadFirst={()=>{dlBackup(profile,monthlyData,eh,ch,insights,archive);showToast("Backup downloaded");}}/>}
      {fixedCommitDetected&&<FixedCommitModal detected={fixedCommitDetected} fmt={fmt} onConfirm={handleFixedCommitConfirm} onSkip={()=>{
        // return all detected items to review as unchecked
        const toReview=(fixedCommitDetected||[]).filter(c=>c.fullTx).map(c=>c.fullTx);
        if(toReview.length>0) setPendingTxs(p=>[...p,...toReview]);
        setFixedCommitDetected(null);
      }}/>}
      {recurringDetected&&<RecurringModal suggestions={recurringDetected} onConfirm={handleRecurringConfirm} onDismiss={()=>setRecurringDetected(null)}/>}
      <input ref={restoreRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestoreFile}/>

      {/* ── Desktop sidebar ── */}
      {isDesktop&&<div style={{width:SIDEBAR_W,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",padding:"28px 14px",position:"fixed",top:0,left:0,bottom:0,zIndex:50,boxShadow:`4px 0 24px rgba(0,0,0,${T.bgLight?0.05:0.18})`}}>
        {/* Brand + avatar */}
        <div style={{marginBottom:24,padding:"0 6px"}}>
          <div style={{marginBottom:8,minHeight:42}}>
            <LogoAnimation allTimeSaved={allTimeSaved} fmt={fmt} compact={false}/>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:14}}>
            {tutorialDismissed&&<button onClick={()=>{setTutorialDismissed(false);lsSave("tutorialDismissed",false);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:7,color:T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:"2px 7px"}}>? Help</button>}
            <button onClick={()=>setShowPrivacy(true)} style={{background:"none",border:"none",color:T.textMuted,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0}}>🔒 Privacy</button>
            <a href="/landing" style={{color:T.textMuted,fontSize:10,fontFamily:"inherit",textDecoration:"none"}}>About</a>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {profile.avatar
              ?<img src={profile.avatar} alt="" style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:`2px solid ${T.accentBorder}`,flexShrink:0}}/>
              :<div style={{width:40,height:40,borderRadius:"50%",background:T.accentMuted,border:`2px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:T.accent,fontWeight:700,flexShrink:0}}>{profile.name?profile.name[0].toUpperCase():"?"}</div>}
            <div style={{minWidth:0}}>
              {profile.name&&<div style={{fontSize:14,color:T.textPrimary,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{profile.name}</div>}
              {profile.occupation&&<div style={{fontSize:12,color:T.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2}}>{profile.occupation}</div>}
            </div>
          </div>
        </div>

        {/* Month picker */}
        <div style={{marginBottom:16,padding:"0 6px"}}>
          <div style={{fontSize:10,color:T.textMuted,marginBottom:6,letterSpacing:1.5,fontFamily:"'DM Mono'"}}>PERIOD</div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
        </div>

        <div style={{height:1,background:T.border,margin:"0 6px 16px"}}/>

        {/* Nav */}
        <div style={{display:"flex",flexDirection:"column",flex:1,gap:0}}>
          {TABS.map(navItem)}
        </div>

        {/* Live savings strip */}
        {incTotal>0&&<div style={{marginTop:16,padding:"14px 16px",background:T.bg,borderRadius:14,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,color:T.textMuted,marginBottom:10,letterSpacing:1.5,fontFamily:"'DM Mono'"}}>THIS MONTH</div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:13,color:T.textSecondary}}>Income</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.positive,fontWeight:600}}>{fmt(incTotal)}</span>
          </div>
          {fixedTotal>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:13,color:T.textSecondary}}>Fixed</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.info,fontWeight:600}}>{fmt(fixedTotal)}</span>
          </div>}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
            <span style={{fontSize:13,color:T.textSecondary}}>Spent</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:13,color:T.negative,fontWeight:600}}>{fmt(varTotal)}</span>
          </div>
          <div style={{height:1,background:T.border,marginBottom:7}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:T.textSecondary,fontWeight:600}}>Saved</span>
            <span style={{fontFamily:"'DM Mono'",fontSize:14,color:saved>=0?T.positive:T.negative,fontWeight:700}}>{fmt(saved)}</span>
          </div>
          <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,savingsRate))}%`,background:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,borderRadius:5,transition:"width .5s"}}/></div>
          <div style={{fontSize:11,color:savingsRate>=20?T.positive:savingsRate>=10?T.warning:T.negative,fontFamily:"'DM Mono'",fontWeight:600,marginTop:5,textAlign:"right"}}>{savingsRate.toFixed(1)}%</div>
        </div>}
      </div>}

      {/* ── Mobile header ── */}
      {!isDesktop&&<div style={{borderBottom:`1px solid ${T.border}`,background:T.bg,position:"sticky",top:0,zIndex:50}}>
        <div style={{padding:"12px 16px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {profile.avatar
              ?<img src={profile.avatar} alt="" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover"}}/>
              :<div style={{width:32,height:32,borderRadius:"50%",background:T.accentMuted,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:T.accent,fontWeight:700}}>{profile.name?profile.name[0].toUpperCase():"?"}</div>}
            <div style={{flex:1,minWidth:0}}>
              <LogoAnimation allTimeSaved={allTimeSaved} fmt={fmt} compact={true}/>
            </div>
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} startMonth={profile.startMonth}/>
        </div>
        <div style={{padding:"0 16px 8px",display:"flex",gap:14,alignItems:"center"}}>
          {tutorialDismissed&&<button onClick={()=>{setTutorialDismissed(false);lsSave("tutorialDismissed",false);}} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:7,color:T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:"3px 8px"}}>? Help</button>}
          <button onClick={()=>setShowPrivacy(true)} style={{background:"none",border:"none",color:T.textMuted,fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:0}}>🔒 Privacy</button>
          <a href="/landing" style={{color:T.textMuted,fontSize:11,fontFamily:"inherit",textDecoration:"none"}}>About</a>
        </div>
      </div>}

      {/* ── Main content area ── */}
      <div style={{flex:1,marginLeft:isDesktop?SIDEBAR_W:0,paddingBottom:isDesktop?40:80,overflowY:"auto",minHeight:"100vh"}}>
        {renderContent()}

        {/* Review sticky commit footer */}
        {tab==="review"&&pendingTxs.length>0&&(()=>{
          const months=[...new Set(pendingTxs.filter(t=>t.checked).map(t=>monthKey(t.date)))].sort();
          const monthStr=months.length>1?`${months.length} months`:monthLabel(months[0]||selectedMonth);
          return <div style={{position:"fixed",bottom:isDesktop?0:64,left:isDesktop?SIDEBAR_W:0,right:0,padding:"16px 24px 20px",background:`linear-gradient(transparent,${T.bg} 38%)`,zIndex:100}}>
            <div style={{maxWidth:760,margin:"0 auto"}}>
              <Btn onClick={commitTransactions} style={{fontSize:15,padding:"14px"}}>
                Save {checkedCount} transaction{checkedCount!==1?"s":""} → {monthStr}
              </Btn>
            </div>
          </div>;
        })()}
      </div>

      {/* ── Mobile bottom nav ── */}
      {!isDesktop&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(navItem)}
      </div>}
    </div>
  </ThemeCtx.Provider>;
}
