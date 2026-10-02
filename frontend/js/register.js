const btn=document.getElementById("enter"),input=document.getElementById("teamName"),msg=document.getElementById("msg");
async function register(){
 const teamName=input.value.trim();
 if(!teamName){msg.textContent="Enter a team name.";return}
 btn.disabled=true;msg.textContent="Registering crew...";
 try{
  const r=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamName})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  location.href=`round1.html?session=${encodeURIComponent(d.sessionId)}`;
 }catch(e){msg.textContent=e.message;btn.disabled=false}
}
btn.onclick=register;input.addEventListener("keydown",e=>{if(e.key==="Enter")register()});