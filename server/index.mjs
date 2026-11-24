import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function createAccountServer({ database = 'accounts.sqlite', adminUser = process.env.ADMIN_USER, adminPassword = process.env.ADMIN_PASSWORD, origin = process.env.ALLOWED_ORIGIN } = {}) {
 const db = new DatabaseSync(database);
 db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, salt TEXT, password TEXT); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER); CREATE TABLE IF NOT EXISTS backups(user_id INTEGER PRIMARY KEY, revision INTEGER, data TEXT, updated TEXT);`);
 if(adminUser && adminPassword && !db.prepare('SELECT id FROM users WHERE username=?').get(adminUser)) {
  if(!/^[a-zA-Z0-9_]{3,32}$/.test(adminUser)||adminPassword.length<8) throw new Error('Invalid admin credentials');
  const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO users(username,salt,password) VALUES(?,?,?)').run(adminUser,salt,scryptSync(adminPassword,salt,64).toString('hex'));
 }
 const hash = token => createHash('sha256').update(token).digest('hex');
 const attempts = new Map();
 const server = createServer(async (req,res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if (origin && req.headers.origin === origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
  const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
  if(req.method === 'OPTIONS') return send(204,{});
  try {
   let body = {}; if (['POST','PUT'].includes(req.method)) { let raw=''; for await(const chunk of req) { raw += chunk; if(Buffer.byteLength(raw)>4*1024*1024) return send(413,{error:'数据过大'}); } body=JSON.parse(raw || '{}'); }
   if (['/register','/login'].includes(req.url) && req.method==='POST') {
    const ip=req.socket.remoteAddress; const now=Date.now(); const entry=attempts.get(ip); const rate=entry && entry.until>now ? entry : {count:0,until:now+60000}; attempts.set(ip,rate);
    if(++rate.count>20) return send(429,{error:'尝试过于频繁，请稍后再试'});
    if(attempts.size>10000) for(const [key,value] of attempts) if(value.until<now) attempts.delete(key);
    const {username,password}=body;
    if(typeof username!=='string'||!/^[a-zA-Z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128) return send(400,{error:'用户名需为3—32位字母、数字或下划线，密码需为8—128位'});
    if(req.url==='/register' && username===adminUser) return send(403,{error:'此账号由管理员配置'});
    if(req.url==='/register') { const salt=randomBytes(16).toString('hex'); try { db.prepare('INSERT INTO users(username,salt,password) VALUES(?,?,?)').run(username,salt,scryptSync(password,salt,64).toString('hex')); } catch { return send(409,{error:'用户名已存在'}); } }
    const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
    if(!user||!timingSafeEqual(Buffer.from(user.password,'hex'),scryptSync(password,user.salt,64))) return send(401,{error:'账号或密码错误'});
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    const token=randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+30*86400000);
    return send(200,{token,username,admin:username===adminUser});
   }
   const token=(req.headers.authorization || '').replace(/^Bearer /,'');
   const user=db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(hash(token),Date.now());
   if(!user) return send(401,{error:'请重新登录'});
   if(req.url==='/logout' && req.method==='POST') { db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); return send(200,{}); }
   if(req.url==='/backup' && req.method==='GET') { const row=db.prepare('SELECT * FROM backups WHERE user_id=?').get(user.id); return send(200,row?{revision:row.revision,snapshot:JSON.parse(row.data),updated:row.updated}:{revision:0,snapshot:null}); }
   if(req.url==='/backup' && req.method==='PUT') {
    if(!Number.isInteger(body.revision)||!body.snapshot||typeof body.snapshot!=='object'||Array.isArray(body.snapshot)) return send(400,{error:'无效备份'});
    const h=body.snapshot.history;
    if(h && (typeof h!=='object'||Array.isArray(h)||Object.entries(h).some(([day,ids])=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string')))) return send(400,{error:'无效阅读记录'});
    db.exec('BEGIN IMMEDIATE');
    try { const row=db.prepare('SELECT revision FROM backups WHERE user_id=?').get(user.id); if((row?.revision || 0)!==body.revision) { db.exec('ROLLBACK'); return send(409,{error:'云端进度已变化，请重试'}); }
     const revision=body.revision+1,updated=new Date().toISOString();
     db.prepare('INSERT INTO backups VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated=excluded.updated').run(user.id,revision,JSON.stringify(body.snapshot),updated); db.exec('COMMIT'); return send(200,{revision,updated});
    } catch(error) { db.exec('ROLLBACK'); throw error; }
   }
   if(req.url==='/admin/statistics' && req.method==='GET') {
    if(user.username!==adminUser) return send(403,{error:'仅管理员可查看'});
    const rows=db.prepare('SELECT username,data FROM users LEFT JOIN backups ON users.id=backups.user_id ORDER BY username').all();
    return send(200,{rows:rows.flatMap(row=>Object.entries(JSON.parse(row.data || '{}').history || {}).map(([date,ids])=>({username:row.username,date,count:new Set(ids).size})))});
   }
   send(404,{error:'接口不存在'});
  }catch { if(!res.headersSent) send(500,{error:'请求处理失败'}); }
 });
 server.on('close',()=>db.close()); return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) createAccountServer().listen(Number(process.env.PORT)||8787,'0.0.0.0');
