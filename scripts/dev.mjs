import { spawn } from 'node:child_process';
const api=spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env:{...process.env,PORT:'3001',APP_ORIGIN:process.env.APP_ORIGIN||'http://localhost:5173'}});
const web=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'});
let ending=false;function stop(code=0){if(ending)return;ending=true;api.kill('SIGTERM');web.kill('SIGTERM');process.exitCode=code}
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>stop());
api.on('exit',code=>stop(code||0));web.on('exit',code=>stop(code||0));
