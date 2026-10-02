const $=id=>document.getElementById(id);
let logged=false,qrTeam="";
function fmt(v){return v==null?"—":`${Number(v).toFixed(2)}s`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function load(){
 const r=await fetch("/api/admin/teams");
 if(r.status===401){logged=false;$("panel").hidden=true;$("login").hidden=false;return}
 const rows=await r.json();
 $("teams").innerHTML=`<div class="teamrow teamhead"><span>TEAM</span><span>R1</span><span>R2</span><span>R3</span><span>STATUS</span><span>ACTIONS</span></div>`+
 rows.map(x=>`<div class="teamrow"><span>${esc(x.team_name)}</span><span>${fmt(x.round1_duration)}</span><span>${fmt(x.round2_duration)}</span><span>${fmt(x.round3_duration)}</span><span>${x.status}</span><span class="actions">
 ${x.status==="round1_complete"?`<button onclick="startR2('${x.session_id}')">START R2</button>`:""}
 ${x.status==="round2"?`<button onclick="finishR2('${x.session_id}')">FINISH R2</button>`:""}
 ${x.status==="round2_complete"?`<button onclick="showQR('${x.session_id}','${esc(x.team_name)}')">SHOW QR</button>`:""}
 </span></div>`).join("");
}
async function action(url,sessionId){
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId})});
 const d=await r.json();if(!r.ok)throw Error(d.error);return d;
}
window.startR2=async sid=>{try{await action("/api/round2/start",sid);load()}catch(e){alert(e.message)}};
window.finishR2=async sid=>{try{await action("/api/round2/finish",sid);load()}catch(e){alert(e.message)}};
window.showQR=async(sid,name)=>{
 try{
  const r=await fetch(`/api/qr/${encodeURIComponent(sid)}`);const d=await r.json();if(!r.ok)throw Error(d.error);
  $("qrTeam").textContent=name;$("qrImage").src=d.qr;$("qrUrl").textContent=d.url;$("qrBox").hidden=false;
 }catch(e){alert(e.message)}
};
$("loginBtn").onclick=async()=>{
 const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:$("user").value,password:$("pass").value})});
 const d=await r.json();if(!r.ok){$("loginMsg").textContent=d.error;return}
 logged=true;$("login").hidden=true;$("panel").hidden=false;load();
};
$("logout").onclick=async()=>{await fetch("/api/admin/logout",{method:"POST"});location.reload()};
$("refresh").onclick=load;$("closeQr").onclick=()=>{$("qrBox").hidden=true};
setInterval(()=>{if(logged)load()},2000);