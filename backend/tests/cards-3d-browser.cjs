// Navegador real + Express real; repositórios isolados em memória, sem MySQL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict'),net=require('node:net');
process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.COOKIE_SAME_SITE='lax';process.env.JWT_SECRET='browser-test-secret-isolated-not-production';
const root=path.resolve(__dirname,'../..');
const repoPath=require.resolve('../src/repositories/userRepository');
const user={id:1,nome:'Produtor de teste',email:'browser@example.test',password_hash:require('bcrypt').hashSync('TesteBrowser123',4),role:'admin',status:'active',session_version:0};
require.cache[repoPath]={id:repoPath,filename:repoPath,loaded:true,exports:{findById:async()=>user,findByEmail:async email=>email===user.email?user:null,resetFailedLogin:async()=>{},incrementFailedLogin:async()=>{},lockUser:async()=>{},revokeSessions:async()=>{user.session_version++;}}};
const adminPath=require.resolve('../src/repositories/adminRepository');
require.cache[adminPath]={id:adminPath,filename:adminPath,loaded:true,exports:{list:async()=>({users:[{id:1,nome:user.nome,email:user.email,role:user.role,status:user.status}],total:1}),find:async()=>({id:1,nome:user.nome,email:user.email,role:user.role,status:user.status})}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const p=server.address().port;await new Promise(r=>server.close(r));return p;}
async function run(){
 let server,browser,socket;const profile=fs.mkdtempSync(path.join(os.tmpdir(),'agrotech-browser-'));
 try {
  const app=require('../src/app');server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const origin='http://127.0.0.1:'+server.address().port;require('../src/config/env').frontendOrigins.push(origin);
  const debug=await port();
  const edge=process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=cp.spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+debug,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();if(pages.some(p=>p.type==='page'))break;}catch(_){}await delay(100);}
  const page=pages?.find(p=>p.type==='page');assert.ok(page,'Edge não disponibilizou depuração.');
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;const pending=new Map();socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(msg.error.message)):waiter.resolve(msg.result);}}};
  function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error('Erro JavaScript no navegador');return result.result.value;}
  async function until(expression){for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch(_){}await delay(100);}throw new Error('Condição não atingida: '+expression);}
  await send('Page.enable');await send('Runtime.enable');

  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  for(const page of ['index','produtos','equipe','referencias','jogo','contato']){
    await send('Page.navigate',{url:origin+'/'+page+'.html'});
    await until("document.querySelector('.tilt-card')");
    await evaluate("document.querySelector('.tilt-card').scrollIntoView({block:'center'})");
    await delay(1500);
    const point=await evaluate("(()=>{const r=document.querySelector('.tilt-card').getBoundingClientRect();return {x:r.left+r.width*.7,y:r.top+r.height*.4}})()");
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await delay(300);
    assert.ok(await evaluate("document.querySelector('.tilt-card').style.transform.includes('perspective')"),page+' tilt');
    await evaluate("document.querySelector('.tilt-card').dispatchEvent(new PointerEvent('pointerleave'))");
    await delay(950);
    assert.equal(await evaluate("document.querySelector('.tilt-card').style.transform"),'');
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("document.querySelector('.tilt-card').dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}))");
  assert.equal(await evaluate("document.querySelector('.tilt-card').style.transform"),'');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
  console.log('6 paginas: hover e retorno OK; movimento reduzido e largura mobile OK.');
 }finally{if(socket)socket.close();if(browser)browser.kill();if(server)await new Promise(r=>server.close(r));console.log('Perfil temporário de navegador:',profile);}
}
run().catch(err=>{console.error(err.message);process.exitCode=1;});