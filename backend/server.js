require("dotenv").config();
const express=require("express");
const path=require("path");
const crypto=require("crypto");
const QRCode=require("qrcode");
const {pool}=require("./db");
const auth=require("./auth");

const app=express();
const PORT=Number(process.env.PORT||3000);
app.use(express.json());
app.use(express.static(path.join(__dirname,"../frontend")));

const logos=[
{id:1,name:"Python",image:"https://cdn.simpleicons.org/python"},
{id:2,name:"GitHub",image:"https://cdn.simpleicons.org/github"},
{id:3,name:"Java",image:"https://cdn.simpleicons.org/openjdk"},
{id:4,name:"HTML",image:"https://cdn.simpleicons.org/html5"},
{id:5,name:"CSS",image:"https://cdn.simpleicons.org/css3"},
{id:6,name:"JavaScript",image:"https://cdn.simpleicons.org/javascript"},
{id:7,name:"Linux",image:"https://cdn.simpleicons.org/linux"},
{id:8,name:"MySQL",image:"https://cdn.simpleicons.org/mysql"},
{id:9,name:"Docker",image:"https://cdn.simpleicons.org/docker"},
{id:10,name:"React",image:"https://cdn.simpleicons.org/react"}
];
const FINAL_QUESTION="Which data structure follows the LIFO principle and is commonly used to manage function calls in programming?";
const norm=s=>String(s||"").trim().toLowerCase().replace(/\s+/g," ");
const nowMs=()=>Date.now();

async function getSession(sessionId){
  const [rows]=await pool.query(`SELECT t.id AS team_id,t.team_name,t.session_id,
    g.id AS game_id,g.current_round,g.status,g.round1_started_at,g.round1_completed_at,
    g.round1_duration,g.round1_penalty,g.round2_started_at,g.round2_completed_at,
    g.round2_duration,g.round3_started_at,g.round3_completed_at,g.round3_duration
    FROM teams t JOIN game_sessions g ON g.team_id=t.id WHERE t.session_id=?`,[sessionId]);
  return rows[0];
}
function publicSession(s,answeredCount=0){
  return {
    teamName:s.team_name,sessionId:s.session_id,status:s.status,currentRound:s.current_round,
    round1StartedAt:s.round1_started_at,round1CompletedAt:s.round1_completed_at,
    round1Duration:s.round1_duration,round1Penalty:s.round1_penalty,
    round2StartedAt:s.round2_started_at,round2CompletedAt:s.round2_completed_at,round2Duration:s.round2_duration,
    round3StartedAt:s.round3_started_at,round3CompletedAt:s.round3_completed_at,round3Duration:s.round3_duration,
    round1AnsweredCount:answeredCount,serverNow:new Date().toISOString()
  };
}
async function answeredCount(teamId){
  const [r]=await pool.query("SELECT COUNT(*) AS c FROM round1_answers WHERE team_id=? AND (is_correct=1 OR is_skipped=1)",[teamId]);
  return Number(r[0].c);
}

app.post("/api/register",async(req,res,next)=>{
  try{
    const name=String(req.body.teamName||"").trim();
    if(!name)return res.status(400).json({error:"Team name is required"});
    if(name.length>100)return res.status(400).json({error:"Team name is too long"});
    const sessionId=crypto.randomBytes(18).toString("hex");
    const [r]=await pool.query("INSERT INTO teams(team_name,session_id) VALUES(?,?)",[name,sessionId]);
    await pool.query("INSERT INTO game_sessions(team_id) VALUES(?)",[r.insertId]);
    res.json({ok:true,sessionId,teamName:name});
  }catch(e){next(e)}
});

app.get("/api/session/:sid",async(req,res,next)=>{
  try{
    const s=await getSession(req.params.sid);
    if(!s)return res.status(404).json({error:"Session not found"});
    res.json(publicSession(s,await answeredCount(s.team_id)));
  }catch(e){next(e)}
});

app.post("/api/round1/start",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    if(s.round1_started_at)return res.status(400).json({error:"Round 1 already started"});
    await pool.query("UPDATE game_sessions SET current_round=1,status='round1',round1_started_at=UTC_TIMESTAMP(3) WHERE team_id=?",[s.team_id]);
    const updated=await getSession(req.body.sessionId);
    res.json({ok:true,logos,session:publicSession(updated,0)});
  }catch(e){next(e)}
});

app.get("/api/round1/logos",async(req,res,next)=>{
  try{
    const s=await getSession(req.query.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    res.json({logos});
  }catch(e){next(e)}
});

app.post("/api/round1/answer",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s||s.status!=="round1")return res.status(400).json({error:"Round 1 is not active"});
    const logo=logos.find(x=>x.id===Number(req.body.logoNo));
    if(!logo)return res.status(400).json({error:"Invalid logo"});
    const answer=String(req.body.answer||"").trim();
    const correct=norm(answer)===norm(logo.name);
    await pool.query("INSERT INTO round1_answers(team_id,logo_no,answer,is_correct) VALUES(?,?,?,?)",[s.team_id,logo.id,answer,correct]);
    const count=await answeredCount(s.team_id);
    res.json({ok:true,correct,count,total:logos.length});
  }catch(e){next(e)}
});

app.post("/api/round1/skip",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s||s.status!=="round1")return res.status(400).json({error:"Round 1 is not active"});
    const logo=logos.find(x=>x.id===Number(req.body.logoNo));
    if(!logo)return res.status(400).json({error:"Invalid logo"});
    const penalty=5;
    await pool.query("INSERT INTO round1_answers(team_id,logo_no,answer,is_skipped,penalty_seconds) VALUES(?,?,?,1,?)",[s.team_id,logo.id,"",penalty]);
    await pool.query("UPDATE game_sessions SET round1_penalty=round1_penalty+? WHERE team_id=?",[penalty,s.team_id]);
    const updated=await getSession(req.body.sessionId);
    const count=await answeredCount(s.team_id);
    res.json({ok:true,penalty,totalPenalty:Number(updated.round1_penalty),count,total:logos.length,serverNow:new Date().toISOString()});
  }catch(e){next(e)}
});

app.post("/api/round1/finish",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    const count=await answeredCount(s.team_id);
    if(count<logos.length)return res.status(400).json({error:`Complete all ${logos.length} logos first`});
    await pool.query(`UPDATE game_sessions SET status='round1_complete',current_round=2,
      round1_completed_at=UTC_TIMESTAMP(3),
      round1_duration=TIMESTAMPDIFF(MICROSECOND,round1_started_at,UTC_TIMESTAMP(3))/1000000+round1_penalty
      WHERE team_id=?`,[s.team_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post("/api/round2/start",auth.requireAdmin,async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    if(s.status!=="round1_complete")return res.status(400).json({error:"Round 1 must be completed first"});
    await pool.query("UPDATE game_sessions SET status='round2',current_round=2,round2_started_at=UTC_TIMESTAMP(3) WHERE team_id=?",[s.team_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post("/api/round2/finish",auth.requireAdmin,async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    if(s.status!=="round2")return res.status(400).json({error:"Round 2 is not active"});
    await pool.query(`UPDATE game_sessions SET status='round2_complete',
      round2_completed_at=UTC_TIMESTAMP(3),
      round2_duration=TIMESTAMPDIFF(MICROSECOND,round2_started_at,UTC_TIMESTAMP(3))/1000000
      WHERE team_id=?`,[s.team_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

app.get("/api/qr/:sid",auth.requireAdmin,async(req,res,next)=>{
  try{
    const s=await getSession(req.params.sid);
    if(!s)return res.status(404).json({error:"Session not found"});
    if(s.status!=="round2_complete")return res.status(400).json({error:"Finish Round 2 first"});
    const base=`${req.protocol}://${req.get("host")}`;
    const url=`${base}/final.html?session=${encodeURIComponent(s.session_id)}`;
    res.json({url,qr:await QRCode.toDataURL(url)});
  }catch(e){next(e)}
});

app.post("/api/round3/start",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s)return res.status(404).json({error:"Session not found"});
    if(s.status==="round2_complete"){
      await pool.query("UPDATE game_sessions SET status='round3',current_round=3,round3_started_at=UTC_TIMESTAMP(3) WHERE team_id=?",[s.team_id]);
    }
    const updated=await getSession(req.body.sessionId);
    if(!["round3","completed"].includes(updated.status))return res.status(403).json({error:"Round 3 is not active"});
    res.json({ok:true,question:FINAL_QUESTION,session:publicSession(updated,await answeredCount(updated.team_id))});
  }catch(e){next(e)}
});

app.post("/api/final/submit",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);
    if(!s||s.status!=="round3")return res.status(400).json({error:"Round 3 is not active"});
    const answer=String(req.body.answer||"").trim();
    if(!answer)return res.status(400).json({error:"Enter an answer"});
    const correct=["stack","stack data structure"].includes(norm(answer));
    await pool.query("INSERT INTO final_answers(team_id,question,answer,is_correct) VALUES(?,?,?,?)",[s.team_id,FINAL_QUESTION,answer,correct]);
    await pool.query(`UPDATE game_sessions SET status='completed',round3_completed_at=UTC_TIMESTAMP(3),
      round3_duration=TIMESTAMPDIFF(MICROSECOND,round3_started_at,UTC_TIMESTAMP(3))/1000000 WHERE team_id=?`,[s.team_id]);
    res.json({ok:true,correct});
  }catch(e){next(e)}
});

app.post("/api/admin/login",async(req,res,next)=>{
  try{
    const ok=await auth.login(String(req.body.username||""),String(req.body.password||""));
    if(!ok)return res.status(401).json({error:"Invalid username or password"});
    auth.issue(res,String(req.body.username));
    res.json({ok:true});
  }catch(e){next(e)}
});
app.post("/api/admin/logout",(req,res)=>{auth.logout(req,res);res.json({ok:true})});

app.get("/api/admin/teams",auth.requireAdmin,async(req,res,next)=>{
  try{
    const [rows]=await pool.query(`SELECT t.team_name,t.session_id,g.current_round,g.status,
      g.round1_duration,g.round1_penalty,g.round2_duration,g.round3_duration
      FROM teams t JOIN game_sessions g ON g.team_id=t.id ORDER BY t.created_at DESC`);
    res.json(rows);
  }catch(e){next(e)}
});

app.use("/api",(err,req,res,next)=>{
  console.error(err);
  res.status(err.status||500).json({error:err.message||"Server error"});
});
app.use((req,res)=>res.sendFile(path.join(__dirname,"../frontend/index.html")));

auth.ensureAdmin()
  .then(()=>app.listen(PORT,()=>console.log(`Tech Treasure running on http://localhost:${PORT}`)))
  .catch(err=>{console.error("Startup failed:",err);process.exit(1)});
