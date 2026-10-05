const sid=new URLSearchParams(location.search).get("session");
const $=id=>document.getElementById(id);
let logos=[],index=0,session=null,ending=false;

async function getSession(){
    const r=await fetch(`/api/session/${encodeURIComponent(sid)}`,{cache:"no-store"});
    if(!r.ok)throw Error("Crew session not found");
    return r.json();
}

function currentTime(){
    return GameTimer.elapsed(session.round1StartedAt)+Number(session.round1Penalty||0);
}

function render(){
    const seconds=Math.min(600,currentTime());
    $("timer").textContent=GameTimer.format(seconds);
    $("penalty").textContent=`Penalties: +${Number(session.round1Penalty||0)}s • Skips: ${session.round1SkipCount||0}/2`;
}

async function init(){
    if(!sid){
        $("msg").textContent="Missing crew session.";
        return;
    }

    try{
        session=await getSession();

        GameTimer.sync(session.serverNow);

        $("team").textContent=`Crew: ${session.crewName}`;

        if(
            session.status==="round2"||
            session.status==="round2_complete"||
            session.status==="round3"||
            session.status==="completed"
        ){
            location.href=`round2.html?session=${encodeURIComponent(sid)}`;
            return;
        }

        if(session.round1StartedAt){
            const r=await fetch(
                `/api/round1/logos?sessionId=${encodeURIComponent(sid)}`
            );

            const d=await r.json();

            if(!r.ok)throw Error(d.error);

            logos=d.logos;

            index=Math.min(
                Number(session.round1AnsweredCount||0),
                logos.length-1
            );

            $("start").hidden=true;
            $("game").hidden=false;

            show();

            GameTimer.start(render);
        }
    }catch(e){
        $("msg").textContent=e.message;
    }
}

$("start").onclick=async()=>{
    const r=await fetch("/api/round1/start",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            sessionId:sid
        })
    });

    const d=await r.json();

    if(!r.ok){
        $("msg").textContent=d.error;
        return;
    }

    GameTimer.sync(d.session.serverNow);

    session=d.session;
    logos=d.logos;
    index=0;

    $("start").hidden=true;
    $("game").hidden=false;

    show();

    GameTimer.start(render);
};

function show(){
    const x=logos[index];

    if(!x)return;

    $("logo").src=x.image;

    $("progress").textContent=`Logo ${index+1} of ${logos.length}`;

    $("answer").value="";
    $("msg").textContent="";

    $("answer").focus();
}

async function moveAfterAction(){
    session=await getSession();

    if(
        session.status==="round2"||
        session.status==="round2_complete"||
        session.status==="round3"||
        session.status==="completed"
    ){
        ending=true;

        GameTimer.stop();

        location.href=`round2.html?session=${encodeURIComponent(sid)}`;

        return;
    }

    index++;

    show();
}

$("submit").onclick=async()=>{
    if(ending)return;

    const answer=$("answer").value.trim();

    if(!answer)return;

    const r=await fetch("/api/round1/answer",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            sessionId:sid,
            logoNo:logos[index].id,
            answer
        })
    });

    const d=await r.json();

    if(!r.ok){
        $("msg").textContent=d.error;
        return;
    }

    if(d.correct){
        $("msg").textContent="Correct! Next logo...";

        await moveAfterAction();
    }else if(d.attemptNo===1){
        session.round1Penalty=
            Number(session.round1Penalty||0)+5;

        $("msg").textContent=
            "Wrong answer. +5 seconds. One more attempt.";

        render();
    }else{
        session.round1Penalty=
            Number(session.round1Penalty||0)+10;

        $("msg").textContent=
            "Second wrong answer. +10 seconds. Moving on...";

        await moveAfterAction();
    }
};

$("skip").onclick=async()=>{
    if(ending)return;

    const r=await fetch("/api/round1/skip",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            sessionId:sid,
            logoNo:logos[index].id
        })
    });

    const d=await r.json();

    if(!r.ok){
        $("msg").textContent=d.error;
        return;
    }

    session.round1Penalty=d.totalPenalty;
    session.round1SkipCount=d.skipCount;

    render();

    $("msg").textContent="Skipped. +20 seconds.";

    await moveAfterAction();
};

async function checkTimeLimit(){
    if(
        ending||
        !session||
        !session.round1StartedAt
    )return;

    if(GameTimer.elapsed(session.round1StartedAt)>=600){
        ending=true;

        GameTimer.stop();

        const r=await fetch("/api/round1/timeout",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                sessionId:sid
            })
        });

        const d=await r.json();

        if(r.ok){
            location.href=`round2.html?session=${encodeURIComponent(sid)}`;
        }else{
            $("msg").textContent=d.error;
            ending=false;
            GameTimer.start(render);
        }
    }
}

setInterval(checkTimeLimit,250);

init();

$("answer").addEventListener("keydown",e=>{
    if(e.key==="Enter"){
        $("submit").click();
    }
});