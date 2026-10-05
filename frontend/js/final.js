const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let session=null,submitting=false;
async function getSession(){const r=await fetch(`/api/session/${encodeURIComponent(sid)}`,{cache:"no-store"});if(!r.ok)throw Error("Crew session not found");return r.json()}
function render(){if(session)$('timer').textContent=GameTimer.format(GameTimer.elapsed(session.round3StartedAt));}
async function start(){
  if(!sid){$('msg').textContent="Missing crew session.";return}
  try{
    const current=await getSession();GameTimer.sync(current.serverNow);
    if(current.status==='completed'){$('finalIntro').hidden=true;$('treasure').hidden=false;$('crew').textContent=`☠ Crew: ${current.crewName}`;return}
    if(current.status!=='round2_complete'&&current.status!=='round3'){$('msg').textContent="Finish Round 2 first.";return}
    const r=await fetch('/api/round3/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid})});
    const d=await r.json();if(!r.ok)throw Error(d.error);
    session=d.session;$('crew').textContent=`☠ Crew: ${session.crewName}`;GameTimer.sync(session.serverNow);render();GameTimer.start(render);$('answer').focus();
  }catch(e){$('msg').textContent=e.message}
}
$('submit').onclick=async()=>{
  if(submitting)return;const answer=$('answer').value.trim();if(!answer){$('msg').textContent="Enter the answer from your QR challenge.";return}
  submitting=true;$('submit').disabled=true;$('msg').textContent="Checking the treasure key...";
  try{
    const r=await fetch('/api/final/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid,answer})});
    const d=await r.json();if(!r.ok)throw Error(d.error);
    if(d.correct){GameTimer.stop();$('finalIntro').hidden=true;$('treasure').hidden=false;document.body.classList.add('treasure-found')}
    else{$('msg').textContent="❌ WRONG ANSWER — The treasure remains hidden. Try again.";$('answer').value="";$('answer').focus();submitting=false;$('submit').disabled=false}
  }catch(e){$('msg').textContent=e.message;submitting=false;$('submit').disabled=false}
};
$('answer').addEventListener('keydown',e=>{if(e.key==='Enter')$('submit').click()});
start();
