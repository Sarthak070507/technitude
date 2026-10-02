const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let session=null,offset=0,timer=null;
function sync(iso){offset=new Date(iso).getTime()-Date.now()}
function fmt(sec){sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60),d=Math.floor((sec-Math.floor(sec))*10);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${d}`}
function tick(){if(session?.round1StartedAt)$("timer").textContent=fmt((Date.now()+offset-new Date(session.round1StartedAt).getTime())/1000+Number(session.round1Penalty||0))}
async function check(){
 try{
  const r=await fetch(`/api/session/${encodeURIComponent(sid)}`,{cache:"no-store"});session=await r.json();if(!r.ok)throw Error(session.error);
  sync(session.serverNow);$("team").textContent=session.teamName;tick();
  if(session.status==="round2_complete"){location.href=`final.html?session=${encodeURIComponent(sid)}`;return}
  $("status").textContent=session.status==="round2"?"Round 2 is in progress. Complete the physical challenge, then wait for the organizer to finish it.":"Waiting for the organizer to start Round 2...";
 }catch(e){$("status").textContent=e.message}
}
setInterval(tick,100);setInterval(check,2000);check();
document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});