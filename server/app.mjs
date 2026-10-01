import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';

const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(24).toString('base64url');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const text=(v,max=180)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,'입력 내용을 확인해 주세요.');return v.trim()};
const list=v=>{if(!Array.isArray(v)||v.length>50)fail(400,'목록을 확인해 주세요.');return [...new Set(v.map(x=>text(x,100)))];};
const date=v=>{if(v==='')return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v)))fail(400,'날짜를 확인해 주세요.');return v;};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(x=>x.length===2));
export function createApp({dbPath='data/deoreonae.sqlite',clientId='',origin='http://localhost:5173',production=false,staticDir=path.resolve('dist'),verifyGoogle}={}) {
  if(dbPath!==':memory:')mkdirSync(path.dirname(dbPath),{recursive:true});
  const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,google_sub TEXT UNIQUE NOT NULL,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id),invite_code TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members(project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(project_id,user_id));`);
  const google=new OAuth2Client(clientId);
  const verify=verifyGoogle|| (async credential=>(await google.verifyIdToken({idToken:credential,audience:clientId})).getPayload());
  const allowedOrigins=new Set(production?[origin]:[origin,'http://localhost:5173','http://127.0.0.1:5173']);
  const secure=origin.startsWith('https:')?'; Secure':'';
  const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`;
  const rates=new Map();
  function rate(req){const key=req.socket.remoteAddress||'local';const now=Date.now();let v=rates.get(key);if(!v||v.until<now)v={count:0,until:now+60000};v.count++;rates.set(key,v);if(rates.size>2000)for(const[k,x]of rates)if(x.until<now)rates.delete(k);if(v.count>120)fail(429,'잠시 후 다시 시도해 주세요.');}
  function userFor(req){const sid=cookies(req).deoreonae_sid;if(!sid)return null;return db.prepare('SELECT u.id,u.name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>?').get(hash(sid),Date.now())||null;}
  function hydrate(row){const p=JSON.parse(row.data);p.ownerId=row.owner_id;p.inviteCode=row.invite_code;p.members=p.members.map(m=>({...m,name:db.prepare('SELECT name FROM users WHERE id=?').get(m.id)?.name||m.name}));return p;}
  function projectsFor(id){return db.prepare('SELECT p.* FROM projects p JOIN members m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.rowid DESC').all(id).map(hydrate);}
  const requireMember=(id,uid)=>{const row=db.prepare('SELECT p.* FROM projects p JOIN members m ON m.project_id=p.id WHERE p.id=? AND m.user_id=?').get(id,uid);if(!row)fail(404,'이 팀플에 참여할 수 없어요.');return row;};
  const saveProject=p=>db.prepare('UPDATE projects SET data=? WHERE id=?').run(JSON.stringify(p),p.id);
  async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>32000)fail(413,'입력 내용이 너무 길어요.');chunks.push(c)}try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'요청 내용을 확인해 주세요.');return value}catch{fail(400,'요청 내용을 확인해 주세요.')}}
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');res.setHeader('X-Frame-Options','DENY');
    try {
      const url=new URL(req.url,'http://local');const route=url.pathname;
      if(route.startsWith('/api/')){
        if(!['GET','POST'].includes(req.method))fail(405,'지원하지 않는 요청이에요.');
        if(req.method==='POST'){if(!allowedOrigins.has(req.headers.origin))fail(403,'다시 로그인한 뒤 시도해 주세요.');if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'요청 형식을 확인해 주세요.');rate(req)}
        const user=userFor(req);
        if(route==='/api/session'&&req.method==='GET'){
          const nonce=token();res.setHeader('Set-Cookie',cookie('deoreonae_nonce',nonce,600));return send(res,200,{user,clientId,nonce,previewAllowed:!production});
        }
        if(route==='/api/auth/google'&&req.method==='POST'){
          if(!clientId)fail(503,'Google 로그인을 준비하고 있어요.');const b=await body(req);const nonce=cookies(req).deoreonae_nonce;
          if(!nonce||!same(nonce,b.nonce))fail(403,'로그인 화면을 새로고침해 주세요.');
          let payload;try{payload=await verify(text(b.credential,16000))}catch{fail(401,'Google 계정을 확인하지 못했어요. 다시 시도해 주세요.')}
          if(!payload?.sub||!same(payload.nonce,nonce)||!payload.name)fail(401,'Google 계정 정보를 확인하지 못했어요.');
          let account=db.prepare('SELECT id,name FROM users WHERE google_sub=?').get(payload.sub);const isNew=!account;
          if(!account){account={id:randomUUID(),name:text(payload.name,100)};db.prepare('INSERT INTO users VALUES(?,?,?)').run(account.id,payload.sub,account.name)}
          const sid=token();db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(sid),account.id,Date.now()+7*86400000);
          res.setHeader('Set-Cookie',[cookie('deoreonae_sid',sid,7*86400),cookie('deoreonae_nonce','',0)]);return send(res,200,{user:account,isNew});
        }
        if(route==='/api/auth/logout'&&req.method==='POST'){const sid=cookies(req).deoreonae_sid;if(sid)db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(sid));res.setHeader('Set-Cookie',cookie('deoreonae_sid','',0));return send(res,200,{ok:true})}
        if(!user)fail(401,'로그인이 필요해요.');
        if(route==='/api/projects'&&req.method==='GET')return send(res,200,{projects:projectsFor(user.id)});
        if(route==='/api/projects'&&req.method==='POST'){
          const b=await body(req);const scope=list(b.scope),later=list(b.later),excluded=list(b.excluded);if(!scope.length||!excluded.length||new Set([...scope,...later,...excluded]).size!==scope.length+later.length+excluded.length)fail(400,'하기로 한 일과 하지 않을 일을 다르게 적어주세요.');
          const p={id:randomUUID(),name:text(b.name,60),course:typeof b.course==='string'?b.course.trim().slice(0,60):'',due:date(b.due),goal:text(b.goal),scope,later,excluded,initialScope:scope.length,history:[],archived:false,members:[{id:user.id,name:user.name,values:list(b.values||[]),tasks:[]}]};
          if(!p.due)fail(400,'마감 날짜를 정해주세요.');
          db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run(p.id,user.id,token(),JSON.stringify(p));db.prepare('INSERT INTO members VALUES(?,?)').run(p.id,user.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
          return send(res,201,{projectId:p.id,projects:projectsFor(user.id)});
        }
        if(route==='/api/join'&&req.method==='POST'){
          const b=await body(req);const row=db.prepare('SELECT * FROM projects WHERE invite_code=?').get(text(b.code,64));if(!row)fail(404,'초대 링크를 다시 확인해 주세요.');const p=hydrate(row);if(p.archived)fail(409,'이미 마무리한 팀플이에요.');
          if(!p.members.some(m=>m.id===user.id)){if(p.members.length>=30)fail(409,'이 팀플은 인원이 가득 찼어요.');p.members.push({id:user.id,name:user.name,values:[],tasks:[]});db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO members VALUES(?,?)').run(p.id,user.id);saveProject(p);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
          return send(res,200,{projectId:p.id,projects:projectsFor(user.id)});
        }
        const match=route.match(/^\/api\/projects\/([^/]+)\/actions$/);
        if(match&&req.method==='POST'){
          const b=await body(req);const row=requireMember(match[1],user.id),p=hydrate(row);if(p.archived)fail(409,'마무리한 팀플은 수정할 수 없어요.');
          const mine=p.members.find(m=>m.id===user.id);
          if(b.action==='task.add'){if(mine.tasks.length>=200)fail(400,'이 팀플에는 할 일을 200개까지 적을 수 있어요.');mine.tasks.push({id:randomUUID(),title:text(b.title,100),due:date(b.due||''),done:false,traces:[]})}
          else if(b.action==='task.update'){const t=mine.tasks.find(t=>t.id===b.taskId);if(!t)fail(403,'내 할 일만 수정할 수 있어요.');if(b.title!==undefined)t.title=text(b.title,100);if(b.due!==undefined)t.due=date(b.due);if(b.done!==undefined){if(typeof b.done!=='boolean')fail(400,'완료 상태를 확인해 주세요.');t.done=b.done}}
          else if(b.action==='trace'){const m=p.members.find(m=>m.id!==user.id&&m.tasks.some(t=>t.id===b.taskId));const t=m?.tasks.find(t=>t.id===b.taskId);if(!t||t.done)fail(409,'지금은 이 할 일에 흔적을 남길 수 없어요.');if(!t.traces.includes(user.name))t.traces.push(user.name)}
          else if(b.action==='goal'){const excluded=list(b.excluded);if(excluded.some(s=>p.scope.includes(s)||p.later.includes(s)))fail(400,'하기로 한 일과 겹치는 항목이 있어요.');p.goal=text(b.goal);p.excluded=excluded}
          else if(b.action==='scope.exchange'){const added=text(b.added,100),removed=text(b.removed,100);if(!p.scope.includes(removed)||p.scope.includes(added))fail(409,'다른 팀원이 약속을 바꿨어요. 다시 골라주세요.');p.scope=p.scope.map(s=>s===removed?added:s);p.later=p.later.filter(s=>s!==added);p.excluded=[...p.excluded.filter(s=>s!==added&&s!==removed),removed];p.history.push({added,removed,date:new Date().toISOString().slice(0,10)})}
          else if(b.action==='archive'){if(row.owner_id!==user.id)fail(403,'방을 만든 사람만 마무리할 수 있어요.');p.archived=true}
          else fail(400,'알 수 없는 요청이에요.');
          saveProject(p);return send(res,200,{projects:projectsFor(user.id)});
        }
        fail(404,'페이지를 찾지 못했어요.');
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'지원하지 않는 요청이에요.');
      const requested=path.resolve(staticDir,'.'+decodeURIComponent(url.pathname));if(requested!==staticDir&&!requested.startsWith(staticDir+path.sep))fail(404,'페이지를 찾지 못했어요.');
      let file=requested;try{if(!(await stat(file)).isFile())file=path.join(staticDir,'index.html')}catch{if(path.extname(url.pathname))fail(404,'파일을 찾지 못했어요.');file=path.join(staticDir,'index.html')}
      const buffer=await readFile(file);const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'};
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:buffer);
    }catch(e){send(res,e.status||500,{error:e.status?e.message:'저장하지 못했어요. 잠시 후 다시 시도해 주세요.'});if(!e.status)console.error('Request failed:',e.code||e.name)}
  });
  server.on('close',()=>db.close());return server;
}
