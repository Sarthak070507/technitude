const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const {pool}=require("./db");
const sessions=new Map();
const COOKIE="tt_admin";
const TTL=12*60*60*1000;

function cookies(req){
  const out={};
  String(req.headers.cookie||"").split(";").forEach(p=>{
    const i=p.indexOf("=");
    if(i>0) out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());
  });
  return out;
}
function issue(res,username){
  const token=crypto.randomBytes(32).toString("hex");
  sessions.set(token,{username,exp:Date.now()+TTL});
  res.setHeader("Set-Cookie",`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL/1000}`);
}
function current(req){
  const token=cookies(req)[COOKIE];
  const s=token&&sessions.get(token);
  if(!s||s.exp<Date.now()){
    if(token)sessions.delete(token);
    return null;
  }
  return s;
}
function requireAdmin(req,res,next){
  if(!current(req))return res.status(401).json({error:"Admin login required"});
  next();
}
async function login(username,password){
  const [rows]=await pool.query("SELECT id,password_hash FROM admin_users WHERE username=?",[username]);
  return !!(rows[0]&&await bcrypt.compare(password,rows[0].password_hash));
}
function logout(req,res){
  const token=cookies(req)[COOKIE];
  if(token)sessions.delete(token);
  res.setHeader("Set-Cookie",`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
async function ensureAdmin(){
  const username=process.env.ADMIN_USERNAME||"admin";
  const password=process.env.ADMIN_PASSWORD||"admin123";
  const [rows]=await pool.query("SELECT id,password_hash FROM admin_users WHERE username=?",[username]);
  if(!rows[0]){
    await pool.query("INSERT INTO admin_users(username,password_hash) VALUES(?,?)",[username,bcrypt.hashSync(password,10)]);
  }else if(!await bcrypt.compare(password,rows[0].password_hash)){
    await pool.query("UPDATE admin_users SET password_hash=? WHERE id=?",[bcrypt.hashSync(password,10),rows[0].id]);
  }
}
module.exports={issue,current,requireAdmin,login,logout,ensureAdmin};
