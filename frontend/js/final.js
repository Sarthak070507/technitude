const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let session=null,offset=0,timer=null;
function sync(iso){offset=new Date(iso).getTime()-Date.now()}
function fmt(sec){sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60),d=Math.floor((sec-Math.floor(sec))*10);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${d}`}
function tick(){if(session?.round1StartedAt)$("timer").textContent=fmt((Date.now()+offset-new Date(session.round1StartedAt).getTime())/1000+Number(session.round1Penalty||0))}
async function init(){
 try{
  const r=await fetch("/api/round3/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  session=d.session;sync(session.serverNow);$("team").textContent=session.teamName;$("question").textContent=d.question;
  tick();timer=setInterval(tick,100);
 }catch(e){$("msg").textContent=e.message;$("submit").disabled=true}
}
async function submit(){
 const answer=$("answer").value.trim();if(!answer)return;
 $("submit").disabled=true;
 try{
  const r=await fetch("/api/final/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,answer})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  clearInterval(timer);session=await (await fetch(`/api/session/${encodeURIComponent(sid)}`)).json();sync(session.serverNow);tick();
  $("question").textContent="CONGRATULATIONS, CREW!";$("answer").hidden=true;$("submit").hidden=true;$("msg").textContent=d.correct?"Final answer accepted!":"Final answer submitted.";
 }catch(e){$("msg").textContent=e.message;$("submit").disabled=false}
}
$("submit").onclick=submit;init();