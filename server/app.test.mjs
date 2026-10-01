import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';

// Google signature verification is an injected boundary in these tests only.
// No test login endpoint or token-decoding fallback exists in the running app.
const verifyGoogle=async token=>{const p=JSON.parse(token);if(p.mockVerified!==true)throw Error('Invalid Google signature');return p};
async function launch(dbPath){const server=createApp({dbPath,clientId:'test.apps.googleusercontent.com',verifyGoogle});server.listen(0,'127.0.0.1');await once(server,'listening');return{server,url:`http://127.0.0.1:${server.address().port}`};}
function browser(url){let jar={};return{jar,async request(route,body,origin='http://localhost:5173'){const r=await fetch(url+route,{method:body===undefined?'GET':'POST',headers:{Cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');jar[k]=v;}return{status:r.status,data:await r.json(),headers:r.headers}},async login(sub,name){const c=await this.request('/api/session');return this.request('/api/auth/google',{credential:JSON.stringify({sub,name,nonce:c.data.nonce,mockVerified:true}),nonce:c.data.nonce,name:'spoofed name'})}}}
const room={name:'디자인 팀플',course:'디자인 수업',due:'2026-12-01',goal:'수업 안에서 끝내기',scope:['인터뷰','프로토타입'],later:['모션'],excluded:['공모전'],values:['결과물 완성도']};
test('account identity, first-use empty list, membership, shared storage and own-task permissions',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'deoreonae-test-'));const dbPath=path.join(dir,'test.sqlite');let current=await launch(dbPath);
 try{
  const a=browser(current.url),b=browser(current.url),outsider=browser(current.url);
  assert.equal((await a.request('/api/projects')).status,401);
  const loginA=await a.login('google-a','구글 닉네임');assert.equal(loginA.data.user.name,'구글 닉네임');assert.equal(loginA.data.isNew,true);assert.match(loginA.headers.get('set-cookie'),/HttpOnly/);
  assert.deepEqual((await a.request('/api/projects')).data.projects,[]);
  const again=await a.login('google-a','다른 이름');assert.equal(again.data.user.id,loginA.data.user.id);assert.equal(again.data.isNew,false);assert.equal(again.data.user.name,'구글 닉네임');
  await b.login('google-b','민지');await outsider.login('google-c','외부인');
  const created=await a.request('/api/projects',room);assert.equal(created.status,201);const p=created.data.projects[0],pid=p.id;
  assert.equal(p.members.length,1);assert.equal(p.members[0].name,'구글 닉네임');assert.deepEqual((await b.request('/api/projects')).data.projects,[]);
  assert.equal((await b.request(`/api/projects/${pid}/actions`,{action:'task.add',title:'비인가',due:''})).status,404);
  assert.equal((await b.request('/api/join',{code:'invalid'})).status,404);
  const joined=await b.request('/api/join',{code:p.inviteCode});assert.equal(joined.status,200);assert.equal(joined.data.projects[0].members.length,2);
  await b.request('/api/join',{code:p.inviteCode});assert.equal((await a.request('/api/projects')).data.projects[0].members.length,2);
  await b.request(`/api/projects/${pid}/actions`,{action:'task.add',title:'민지 할 일',due:''});
  const state=(await a.request('/api/projects')).data.projects[0];const bt=state.members.find(m=>m.id!==loginA.data.user.id).tasks[0];
  assert.equal((await a.request(`/api/projects/${pid}/actions`,{action:'task.update',taskId:bt.id,title:'남의 일 수정'})).status,403);
  assert.equal((await outsider.request(`/api/projects/${pid}/actions`,{action:'trace',taskId:bt.id})).status,404);
  assert.equal((await b.request(`/api/projects/${pid}/actions`,{action:'task.update',taskId:bt.id,done:true})).status,200);
  await b.request(`/api/projects/${pid}/actions`,{action:'task.update',taskId:bt.id,done:false});await a.request(`/api/projects/${pid}/actions`,{action:'trace',taskId:bt.id});
  await Promise.all(['작업 1','작업 2'].map(title=>a.request(`/api/projects/${pid}/actions`,{action:'task.add',title,due:''})));
  const both=(await a.request('/api/projects')).data.projects[0];assert.equal(both.members.find(m=>m.id===loginA.data.user.id).tasks.length,2);assert.deepEqual(both.members.find(m=>m.id!==loginA.data.user.id).tasks[0].traces,['구글 닉네임']);
  const trade=await a.request(`/api/projects/${pid}/actions`,{action:'scope.exchange',added:'발표 연습',removed:'인터뷰'});assert.equal(trade.data.projects[0].scope.length,2);assert.ok(trade.data.projects[0].excluded.includes('인터뷰'));
  assert.equal((await b.request(`/api/projects/${pid}/actions`,{action:'scope.exchange',added:'추가 작업',removed:'인터뷰'})).status,409);
  assert.equal((await b.request(`/api/projects/${pid}/actions`,{action:'archive'})).status,403);
  const aCookie={...a.jar};await new Promise(r=>current.server.close(r));current=await launch(dbPath);const returning=browser(current.url);Object.assign(returning.jar,aCookie);assert.equal((await returning.request('/api/projects')).data.projects[0].scope[0],'발표 연습');
  assert.equal((await returning.request(`/api/projects/${pid}/actions`,{action:'archive'})).status,200);
 }finally{await new Promise(r=>current.server.close(r));await rm(dir,{recursive:true,force:true})}
});
test('rejects invalid tokens, wrong nonce, cross-origin mutations and revoked sessions',async()=>{
 const {server,url}=await launch(':memory:');try{const a=browser(url);const session=(await a.request('/api/session')).data;
 assert.equal((await a.request('/api/auth/google',{credential:'{}',nonce:'wrong'})).status,403);
 assert.equal((await a.request('/api/auth/google',{credential:'{}',nonce:session.nonce})).status,401);
 assert.equal((await a.request('/api/auth/google',{credential:JSON.stringify({mockVerified:true,sub:'a',name:'a',nonce:'wrong'}),nonce:session.nonce})).status,401);
 await a.login('google-a','아현');assert.equal((await a.request('/api/projects',room,'https://untrusted.example')).status,403);
 const old={...a.jar};await a.request('/api/auth/logout',{});Object.assign(a.jar,old);assert.equal((await a.request('/api/projects')).status,401);
 }finally{await new Promise(r=>server.close(r))}
});
