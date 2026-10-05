require("dotenv").config();
const express=require("express");
const path=require("path");
const crypto=require("crypto");
const {pool}=require("./db");
const auth=require("./auth");

const app=express();
const PORT=Number(process.env.PORT||3000);
const ROUND1_LIMIT=10*60;
const FINAL_QUESTION=process.env.FINAL_QUESTION||"Answer the question given to your crew by the QR challenge.";
const FINAL_ANSWERS=(process.env.FINAL_ANSWERS||"stack,stack data structure").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);

app.use(express.json());
app.use(express.static(path.join(__dirname,"../frontend")));

const QUESTION_BANK=[
  {id:1,name:"Python",image:"images/python.png"},
  {id:2,name:"GitHub",image:"images/github.png"},
  {id:3,name:"MongoDB",image:"images/mongodb.png"},
  {id:4,name:"MySQL",image:"images/mysql.png"},
  {id:5,name:"Docker",image:"images/docker.png"},
  {id:6,name:"HTML",image:"images/html.png"},
  {id:7,name:"Linux",image:"images/linux.png"},
  {id:8,name:"Java",image:"images/java.png"},
  {id:9,name:"React",image:"images/react.png"},
  {id:10,name:"Vercel",image:"images/vercel.png"},
  {id:11,name:"Erlang",image:"images/erlang.png"},
  {id:12,name:"TypeScript",image:"images/typescript.png"}
];

const ROUND2_CLUES=[
  "CLUE 01 — [ADD YOUR FIRST HIDDEN-QR LOCATION CLUE HERE]",
  "CLUE 02 — [ADD YOUR SECOND HIDDEN-QR LOCATION CLUE HERE]",
  "CLUE 03 — [ADD YOUR THIRD HIDDEN-QR LOCATION CLUE HERE]",
  "CLUE 04 — [ADD YOUR FOURTH HIDDEN-QR LOCATION CLUE HERE]"
];

const norm=s=>String(s||"").trim().toLowerCase().replace(/\s+/g," ");
const shuffle=a=>a.slice().sort(()=>Math.random()-.5);

const pickQuestions=()=>{
  return shuffle(QUESTION_BANK).slice(0,10);
};

const safeJson=s=>{
  try{
    return JSON.parse(s||"[]");
  }catch{
    return[];
  }
};

const elapsedSeconds=start=>{
  return start
    ?Math.max(0,(Date.now()-new Date(start).getTime())/1000)
    :0;
};

async function ensureColumns(){
  const [cols]=await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='game_sessions'`
  );

  const names=new Set(cols.map(x=>x.COLUMN_NAME));

  if(!names.has("round1_question_set")){
    await pool.query(
      "ALTER TABLE game_sessions ADD COLUMN round1_question_set TEXT NULL"
    );
  }

  if(!names.has("round2_clue")){
    await pool.query(
      "ALTER TABLE game_sessions ADD COLUMN round2_clue TEXT NULL"
    );
  }

  if(!names.has("round2_clue_index")){
    await pool.query(
      "ALTER TABLE game_sessions ADD COLUMN round2_clue_index INT NULL"
    );
  }

  const [answerCols]=await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='round1_answers'`
  );

  const answerNames=new Set(answerCols.map(x=>x.COLUMN_NAME));

  if(!answerNames.has("attempt_no")){
    await pool.query(
      "ALTER TABLE round1_answers ADD COLUMN attempt_no TINYINT NOT NULL DEFAULT 1"
    );
  }
}

async function getSession(sessionId){
  const [rows]=await pool.query(
    `SELECT
      t.id AS team_id,
      t.team_name,
      t.session_id,
      g.id AS game_id,
      g.current_round,
      g.status,
      g.round1_started_at,
      g.round1_completed_at,
      g.round1_duration,
      g.round1_penalty,
      g.round1_question_set,
      g.round2_clue,
      g.round2_clue_index,
      g.round2_started_at,
      g.round2_completed_at,
      g.round2_duration,
      g.round3_started_at,
      g.round3_completed_at,
      g.round3_duration
     FROM teams t
     JOIN game_sessions g ON g.team_id=t.id
     WHERE t.session_id=?`,
    [sessionId]
  );

  return rows[0];
}

async function answeredCount(teamId){
  const [r]=await pool.query(
    `SELECT COUNT(DISTINCT logo_no) AS c
     FROM round1_answers
     WHERE team_id=?
     AND (
       is_correct=1
       OR is_skipped=1
       OR attempt_no=2
     )`,
    [teamId]
  );

  return Number(r[0].c);
}

async function skipCount(teamId){
  const [r]=await pool.query(
    `SELECT COUNT(*) AS c
     FROM round1_answers
     WHERE team_id=?
     AND is_skipped=1`,
    [teamId]
  );

  return Number(r[0].c);
}

async function publicSession(s){
  return{
    crewName:s.team_name,
    teamName:s.team_name,
    sessionId:s.session_id,
    status:s.status,
    currentRound:s.current_round,
    round1StartedAt:s.round1_started_at,
    round1CompletedAt:s.round1_completed_at,
    round1Duration:s.round1_duration,
    round1Penalty:s.round1_penalty,
    round1AnsweredCount:await answeredCount(s.team_id),
    round1SkipCount:await skipCount(s.team_id),
    round1TimeLimit:ROUND1_LIMIT,
    round2StartedAt:s.round2_started_at,
    round2CompletedAt:s.round2_completed_at,
    round2Duration:s.round2_duration,
    round2Clue:s.round2_clue,
    round3StartedAt:s.round3_started_at,
    round3CompletedAt:s.round3_completed_at,
    round3Duration:s.round3_duration,
    serverNow:new Date().toISOString()
  };
}

async function startRound2(teamId){
  const clueIndex=Math.floor(Math.random()*ROUND2_CLUES.length);

  await pool.query(
    `UPDATE game_sessions
     SET status='round2',
         current_round=2,
         round2_started_at=UTC_TIMESTAMP(3),
         round2_clue=?,
         round2_clue_index=?
     WHERE team_id=?`,
    [
      ROUND2_CLUES[clueIndex],
      clueIndex,
      teamId
    ]
  );
}

app.post("/api/register",async(req,res,next)=>{
  try{
    const name=String(
      req.body.teamName||req.body.crewName||""
    ).trim();

    if(!name){
      return res.status(400).json({
        error:"Crew name is required"
      });
    }

    if(name.length>100){
      return res.status(400).json({
        error:"Crew name is too long"
      });
    }

    const sessionId=crypto.randomBytes(18).toString("hex");

    const questionSet=pickQuestions();

    const [r]=await pool.query(
      "INSERT INTO teams(team_name,session_id) VALUES(?,?)",
      [
        name,
        sessionId
      ]
    );

    await pool.query(
      "INSERT INTO game_sessions(team_id,round1_question_set) VALUES(?,?)",
      [
        r.insertId,
        JSON.stringify(questionSet)
      ]
    );

    res.json({
      ok:true,
      sessionId,
      crewName:name
    });

  }catch(e){
    next(e);
  }
});

app.get("/api/session/:sid",async(req,res,next)=>{
  try{
    const s=await getSession(req.params.sid);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    res.json(await publicSession(s));

  }catch(e){
    next(e);
  }
});

app.post("/api/round1/start",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    if(s.round1_started_at){
      return res.status(400).json({
        error:"Round 1 has already started"
      });
    }

    await pool.query(
      `UPDATE game_sessions
       SET current_round=1,
           status='round1',
           round1_started_at=UTC_TIMESTAMP(3)
       WHERE team_id=?`,
      [s.team_id]
    );

    const updated=await getSession(req.body.sessionId);

    res.json({
      ok:true,
      logos:safeJson(updated.round1_question_set),
      session:await publicSession(updated)
    });

  }catch(e){
    next(e);
  }
});

app.get("/api/round1/logos",async(req,res,next)=>{
  try{
    const s=await getSession(req.query.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    res.json({
      logos:safeJson(s.round1_question_set)
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round1/answer",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s||s.status!=="round1"){
      return res.status(400).json({
        error:"Round 1 is not active"
      });
    }

    if(elapsedSeconds(s.round1_started_at)>=ROUND1_LIMIT){
      return res.status(400).json({
        error:"Time is up. Round 1 has ended."
      });
    }

    const questions=safeJson(s.round1_question_set);

    const logo=questions.find(
      x=>x.id===Number(req.body.logoNo)
    );

    if(!logo){
      return res.status(400).json({
        error:"Invalid logo"
      });
    }

    const answer=String(req.body.answer||"").trim();

    const [attemptRows]=await pool.query(
      `SELECT COUNT(*) AS c
       FROM round1_answers
       WHERE team_id=? AND logo_no=?`,
      [
        s.team_id,
        logo.id
      ]
    );

    const attemptNo=Number(attemptRows[0].c)+1;

    if(attemptNo>2){
      return res.status(400).json({
        error:"No more attempts for this logo"
      });
    }

    const correct=norm(answer)===norm(logo.name);

    const penalty=correct
      ?0
      :(attemptNo===1?5:10);

    await pool.query(
      `INSERT INTO round1_answers
       (team_id,logo_no,answer,is_correct,attempt_no,penalty_seconds)
       VALUES(?,?,?,?,?,?)`,
      [
        s.team_id,
        logo.id,
        answer,
        correct,
        attemptNo,
        penalty
      ]
    );

    if(penalty){
      await pool.query(
        `UPDATE game_sessions
         SET round1_penalty=round1_penalty+?
         WHERE team_id=?`,
        [
          penalty,
          s.team_id
        ]
      );
    }

    const count=await answeredCount(s.team_id);

    if(count>=questions.length){

      await pool.query(
        `UPDATE game_sessions
         SET status='round1_complete',
             current_round=2,
             round1_completed_at=UTC_TIMESTAMP(3),
             round1_duration=
               TIMESTAMPDIFF(
                 MICROSECOND,
                 round1_started_at,
                 UTC_TIMESTAMP(3)
               )/1000000+round1_penalty
         WHERE team_id=?`,
        [s.team_id]
      );

      await startRound2(s.team_id);

      const updated=await getSession(
        req.body.sessionId
      );

      return res.json({
        ok:true,
        correct,
        attemptNo,
        penalty,
        count,
        total:questions.length,
        finished:true,
        session:await publicSession(updated)
      });
    }

    res.json({
      ok:true,
      correct,
      attemptNo,
      penalty,
      count,
      total:questions.length,
      finished:false
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round1/skip",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s||s.status!=="round1"){
      return res.status(400).json({
        error:"Round 1 is not active"
      });
    }

    if(elapsedSeconds(s.round1_started_at)>=ROUND1_LIMIT){
      return res.status(400).json({
        error:"Time is up. Round 1 has ended."
      });
    }

    const used=await skipCount(s.team_id);

    if(used>=2){
      return res.status(400).json({
        error:"You have used both skips"
      });
    }

    const questions=safeJson(
      s.round1_question_set
    );

    const logo=questions.find(
      x=>x.id===Number(req.body.logoNo)
    );

    if(!logo){
      return res.status(400).json({
        error:"Invalid logo"
      });
    }

    const penalty=20;

    await pool.query(
      `INSERT INTO round1_answers
       (team_id,logo_no,answer,is_skipped,penalty_seconds,attempt_no)
       VALUES(?,?,?,?,?,?)`,
      [
        s.team_id,
        logo.id,
        "",
        1,
        penalty,
        1
      ]
    );

    await pool.query(
      `UPDATE game_sessions
       SET round1_penalty=round1_penalty+?
       WHERE team_id=?`,
      [
        penalty,
        s.team_id
      ]
    );

    const count=await answeredCount(
      s.team_id
    );

    if(count>=questions.length){

      await pool.query(
        `UPDATE game_sessions
         SET status='round1_complete',
             current_round=2,
             round1_completed_at=UTC_TIMESTAMP(3),
             round1_duration=
               TIMESTAMPDIFF(
                 MICROSECOND,
                 round1_started_at,
                 UTC_TIMESTAMP(3)
               )/1000000+round1_penalty
         WHERE team_id=?`,
        [s.team_id]
      );

      await startRound2(s.team_id);

      const updated=await getSession(
        req.body.sessionId
      );

      return res.json({
        ok:true,
        penalty,
        totalPenalty:Number(
          updated.round1_penalty
        ),
        skipCount:used+1,
        count,
        total:questions.length,
        finished:true,
        session:await publicSession(updated)
      });
    }

    res.json({
      ok:true,
      penalty,
      totalPenalty:
        Number(s.round1_penalty||0)+penalty,
      skipCount:used+1,
      count,
      total:questions.length,
      finished:false
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round1/timeout",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    if(s.status!=="round1"){
      return res.json({
        ok:true
      });
    }

    if(elapsedSeconds(s.round1_started_at)<ROUND1_LIMIT){
      return res.status(400).json({
        error:"Round 1 time limit has not been reached"
      });
    }

    await pool.query(
      `UPDATE game_sessions
       SET status='round1_complete',
           current_round=2,
           round1_completed_at=UTC_TIMESTAMP(3),
           round1_duration=
             TIMESTAMPDIFF(
               MICROSECOND,
               round1_started_at,
               UTC_TIMESTAMP(3)
             )/1000000+round1_penalty
       WHERE team_id=?`,
      [s.team_id]
    );

    await startRound2(s.team_id);

    res.json({
      ok:true
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round1/finish",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    const questions=safeJson(
      s.round1_question_set
    );

    const count=await answeredCount(
      s.team_id
    );

    if(count<questions.length){
      return res.status(400).json({
        error:`Complete all ${questions.length} logos first`
      });
    }

    if(s.status!=="round2"){
      await startRound2(s.team_id);
    }

    res.json({
      ok:true
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round2/finish",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    if(s.status!=="round2"){
      return res.status(400).json({
        error:"Round 2 is not active"
      });
    }

    await pool.query(
      `UPDATE game_sessions
       SET status='round2_complete',
           round2_completed_at=UTC_TIMESTAMP(3),
           round2_duration=
             TIMESTAMPDIFF(
               MICROSECOND,
               round2_started_at,
               UTC_TIMESTAMP(3)
             )/1000000
       WHERE team_id=?`,
      [s.team_id]
    );

    const updated=await getSession(
      req.body.sessionId
    );

    res.json({
      ok:true,
      session:await publicSession(updated)
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/round3/start",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s){
      return res.status(404).json({
        error:"Crew session not found"
      });
    }

    if(
      ![
        "round2",
        "round2_complete",
        "round3"
      ].includes(s.status)
    ){
      return res.status(403).json({
        error:"Finish Round 1 and find the hidden QR first."
      });
    }

    if(
      s.status==="round2"||
      s.status==="round2_complete"
    ){
      await pool.query(
        `UPDATE game_sessions
         SET status='round3',
             current_round=3,
             round3_started_at=UTC_TIMESTAMP(3),
             round2_completed_at=
               COALESCE(
                 round2_completed_at,
                 UTC_TIMESTAMP(3)
               ),
             round2_duration=
               COALESCE(
                 round2_duration,
                 TIMESTAMPDIFF(
                   MICROSECOND,
                   round2_started_at,
                   UTC_TIMESTAMP(3)
                 )/1000000
               )
         WHERE team_id=?`,
        [s.team_id]
      );
    }

    const updated=await getSession(
      req.body.sessionId
    );

    res.json({
      ok:true,
      question:FINAL_QUESTION,
      session:await publicSession(updated)
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/final/submit",async(req,res,next)=>{
  try{
    const s=await getSession(req.body.sessionId);

    if(!s||s.status!=="round3"){
      return res.status(400).json({
        error:"The final round is not active"
      });
    }

    const answer=String(
      req.body.answer||""
    ).trim();

    if(!answer){
      return res.status(400).json({
        error:"Enter your answer first"
      });
    }

    const correct=FINAL_ANSWERS.includes(
      norm(answer)
    );

    await pool.query(
      `INSERT INTO final_answers
       (team_id,question,answer,is_correct)
       VALUES(?,?,?,?)`,
      [
        s.team_id,
        FINAL_QUESTION,
        answer,
        correct
      ]
    );

    if(correct){
      await pool.query(
        `UPDATE game_sessions
         SET status='completed',
             round3_completed_at=UTC_TIMESTAMP(3),
             round3_duration=
               TIMESTAMPDIFF(
                 MICROSECOND,
                 round3_started_at,
                 UTC_TIMESTAMP(3)
               )/1000000
         WHERE team_id=?`,
        [s.team_id]
      );
    }

    res.json({
      ok:true,
      correct,
      tryAgain:!correct
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/admin/login",async(req,res,next)=>{
  try{
    const ok=await auth.login(
      String(req.body.username||""),
      String(req.body.password||"")
    );

    if(!ok){
      return res.status(401).json({
        error:"Invalid username or password"
      });
    }

    auth.issue(
      res,
      String(req.body.username)
    );

    res.json({
      ok:true
    });

  }catch(e){
    next(e);
  }
});

app.post("/api/admin/logout",(req,res)=>{
  auth.logout(req,res);
  res.json({
    ok:true
  });
});

app.get("/api/admin/teams",auth.requireAdmin,async(req,res,next)=>{
  try{
    const [rows]=await pool.query(
      `SELECT
        t.team_name,
        t.session_id,
        g.current_round,
        g.status,
        g.round1_duration,
        g.round1_penalty,
        g.round2_duration,
        g.round3_duration,
        g.round1_started_at,
        g.round1_completed_at,
        g.round2_started_at,
        g.round2_completed_at,
        g.round3_started_at,
        g.round3_completed_at
       FROM teams t
       JOIN game_sessions g
       ON g.team_id=t.id
       ORDER BY t.created_at DESC`
    );

    res.json(rows);

  }catch(e){
    next(e);
  }
});

app.use("/api",(err,req,res,next)=>{
  console.error(err);

  res.status(
    err.status||500
  ).json({
    error:err.message||"Server error"
  });
});

app.use((req,res)=>{
  res.sendFile(
    path.join(
      __dirname,
      "../frontend/index.html"
    )
  );
});

ensureColumns()
  .then(()=>auth.ensureAdmin())
  .then(()=>{
    app.listen(
      PORT,
      ()=>{
        console.log(
          `Hack the Hunt running on http://localhost:${PORT}`
        );
      }
    );
  })
  .catch(err=>{
    console.error(
      "Startup failed:",
      err
    );
    process.exit(1);
  });