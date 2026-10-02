const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let logos=[],index=0,session=null,serverOffset=0,penalty=0,displayInterval=null;

function syncServer(iso){serverOffset=new Date(iso).getTime()-Date.now()}
function now(){return Date.now()+serverOffset}
function elapsed(start){return Math.max(0,(now()-new Date(start).getTime())/1000)}
function fmt(sec){sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60),d=Math.floor((sec-Math.floor(sec))*10);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${d}`}
function updateTimer(){
 if(!session?.round1StartedAt)return;
 $("timer").textContent=fmt(elapsed(session.round1StartedAt)+penalty);
}
async function getSession(){
 const r=await fetch(`/api/session/${encodeURIComponent(sid)}`,{cache:"no-store"});
 const d=await r.json();if(!r.ok)throw Error(d.error);syncServer(d.serverNow);return d;
}
function show(){
 if(index>=logos.length){finish();return}
 $("progress").textContent=`LOGO ${index+1} / ${logos.length}`;
 $("logo").src=logos[index].image;
 $("answer").value="";$("answer").focus();
}
async function start(){
 $("start").disabled=true;$("msg").textContent="Starting...";
 try{
  const r=await fetch("/api/round1/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  session=d.session;syncServer(d.session.serverNow);logos=d.logos;index=0;penalty=0;
  $("start").hidden=true;$("game").hidden=false;$("team").textContent=session.teamName;show();updateTimer();
  clearInterval(displayInterval);displayInterval=setInterval(updateTimer,100);
 }catch(e){$("msg").textContent=e.message;$("start").disabled=false}
}
async function resume(){
 try{
  session=await getSession();$("team").textContent=session.teamName;penalty=Number(session.round1Penalty||0);
  if(session.status==="registered"){return}
  if(session.status==="round1"){
   logos=(await (await fetch(`/api/round1/logos?sessionId=${encodeURIComponent(sid)}`)).json()).logos;
   index=Number(session.round1AnsweredCount||0);
   $("start").hidden=true;$("game").hidden=false;show();updateTimer();
   clearInterval(displayInterval);displayInterval=setInterval(updateTimer,100);
  }else if(["round1_complete","round2","round2_complete","round3","completed"].includes(session.status)){
   location.href=`round2.html?session=${encodeURIComponent(sid)}`;
  }
 }catch(e){$("msg").textContent=e.message}
}
async function submitAnswer(){
 const answer=$("answer").value.trim();if(!answer)return;
 $("submit").disabled=true;
 try{
  const r=await fetch("/api/round1/answer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,logoNo:logos[index].id,answer})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  if(!d.correct){$("msg").textContent="Wrong answer. Try again.";$("submit").disabled=false;return}
  index=d.count;session=await getSession();$("msg").textContent="Correct!";
  if(index>=logos.length){await finish()}else show();
 }catch(e){$("msg").textContent=e.message}
 $("submit").disabled=false;
}
async function skip(){
 $("skip").disabled=true;
 try{
  const r=await fetch("/api/round1/skip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,logoNo:logos[index].id})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  penalty=Number(d.totalPenalty);session=await getSession();syncServer(session.serverNow);
  updateTimer();$("msg").textContent="+5 seconds penalty added";
  index=d.count;
  if(index>=logos.length){await finish()}else show();
 }catch(e){$("msg").textContent=e.message}
 $("skip").disabled=false;
}
async function finish(){
 clearInterval(displayInterval);
 const r=await fetch("/api/round1/finish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid})});
 const d=await r.json();if(!r.ok){$("msg").textContent=d.error;return}
 location.href=`round2.html?session=${encodeURIComponent(sid)}`;
}
$("start").onclick=start;$("submit").onclick=submitAnswer;$("skip").onclick=skip;
$("answer").addEventListener("keydown",e=>{if(e.key==="Enter")submitAnswer()});
document.addEventListener("visibilitychange",async()=>{if(!document.hidden&&session){try{session=await getSession();penalty=Number(session.round1Penalty||penalty);updateTimer()}catch{}}});
resume();