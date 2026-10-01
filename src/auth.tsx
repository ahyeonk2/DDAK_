import { useEffect, useRef, useState } from 'react';
export type User={id:string;name:string};
export type AuthConfig={user:User|null;clientId:string;nonce:string;previewAllowed:boolean};
export async function api<T>(url:string,body?:unknown):Promise<T>{
  const r=await fetch(url,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await r.json()}catch{throw new Error('서버에 연결하지 못했어요. 앱을 다시 시작해 주세요.')}
  if(!r.ok)throw Object.assign(new Error(data.error||'잠시 후 다시 시도해 주세요.'),{status:r.status});return data;
}
type GoogleAPI={accounts:{id:{initialize:(o:{client_id:string;nonce:string;callback:(r:{credential:string})=>void})=>void;renderButton:(e:HTMLElement,o:Record<string,unknown>)=>void;disableAutoSelect:()=>void}}};
declare global {interface Window{google?:GoogleAPI}}
export function Login({config,onLogin,onPreview}:{config:AuthConfig;onLogin:(user:User)=>void;onPreview:()=>void}){
  const ref=useRef<HTMLDivElement>(null);const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!config.clientId)return;let disposed=false;
    const render=()=>{if(disposed||!window.google||!ref.current)return;window.google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,callback:async r=>{setBusy(true);setError('');try{const d=await api<{user:User}>('/api/auth/google',{credential:r.credential,nonce:config.nonce});onLogin(d.user)}catch(e){setError((e as Error).message);setBusy(false)}}});ref.current.replaceChildren();window.google.accounts.id.renderButton(ref.current,{type:'standard',theme:'outline',size:'large',text:'continue_with',shape:'pill',width:300,locale:'ko'});};
    if(window.google)render();else{let script=document.querySelector<HTMLScriptElement>('script[data-google-login]');if(!script){script=document.createElement('script');script.src='https://accounts.google.com/gsi/client?hl=ko';script.async=true;script.dataset.googleLogin='true';document.head.appendChild(script)}script.addEventListener('load',render);const failed=()=>setError('Google 로그인을 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.');script.addEventListener('error',failed);return()=>{disposed=true;script.removeEventListener('load',render);script.removeEventListener('error',failed)}}return()=>{disposed=true};
  },[config.clientId,config.nonce]);
  return <div className="login-page"><header className="login-header"><span className="brand">DDAK<span className="brand-dot">.</span></span></header><main className="login-main"><div className="login-dots" aria-hidden="true"><i/><i/><i/></div><h1>로그인</h1><div className="google-login" ref={ref}/>{!config.clientId&&<><button className="google-placeholder" disabled><b>G</b>Google로 계속하기</button><p className="login-note">Google 로그인 연결을 기다리고 있어요.</p></>}{busy&&<p role="status" className="login-note">계정을 확인하고 있어요.</p>}{error&&<p role="alert" className="form-error">{error}</p>}<p className="nickname-note">Google 계정 이름이 닉네임으로 적용됩니다.</p>{config.previewAllowed&&<button className="preview-link" onClick={onPreview}>로그인 없이 화면 미리보기</button>}</main></div>
}
