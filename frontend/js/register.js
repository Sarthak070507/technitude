const btn=document.getElementById('enter'),input=document.getElementById('teamName'),msg=document.getElementById('msg');
async function join(){
  msg.textContent='';const crewName=input.value.trim();if(!crewName){msg.textContent='Your crew needs a name.';return}
  btn.disabled=true;btn.textContent='SETTING SAIL...';
  try{const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crewName})});const d=await r.json();if(!r.ok)throw Error(d.error);location.href=`round1.html?session=${encodeURIComponent(d.sessionId)}`}
  catch(e){msg.textContent=e.message;btn.disabled=false;btn.textContent='SET SAIL'}
}
btn.onclick=join;input.addEventListener('keydown',e=>{if(e.key==='Enter')join()});
