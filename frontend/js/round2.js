const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let session=null,finishing=false;
async function getSession(){const r=await fetch(`/api/session/${encodeURIComponent(sid)}`,{cache:"no-store"});if(!r.ok)throw Error("Crew session not found");return r.json()}
function render(){if(session)$('timer').textContent=GameTimer.format(GameTimer.elapsed(session.round2StartedAt));}
async function load(){
  if(!sid){$('status').textContent="Missing crew session.";return}
  try{
    session=await getSession();GameTimer.sync(session.serverNow);
    $('crew').textContent=`☠ Crew: ${session.crewName}`;
    $('clue').textContent=session.round2Clue||"Your clue will appear here.";
    if(session.status==='round3'||session.status==='completed'){
      GameTimer.stop();location.href=`final.html?session=${encodeURIComponent(sid)}`;return;
    }
    if(session.status!=='round2'){$('status').textContent="Round 2 is not active.";return}
    render();GameTimer.start(render);
  }catch(e){$('status').textContent=e.message;setTimeout(load,2500)}
}
$('complete').onclick=async()=>{
  if(finishing)return;finishing=true;$('complete').disabled=true;$('complete').textContent="OPENING FINAL ROUND...";$('status').textContent="Stopping the hunt timer...";
  try{
    const r=await fetch('/api/round2/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid})});
    const d=await r.json();if(!r.ok)throw Error(d.error);
    GameTimer.stop();location.href=`final.html?session=${encodeURIComponent(sid)}`;
  }catch(e){$('status').textContent=e.message;$('complete').disabled=false;$('complete').textContent="⚔ ROUND 2 COMPLETED — START FINAL ROUND";finishing=false}
};
load();
