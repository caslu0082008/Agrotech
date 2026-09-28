const vm=require('vm'),fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../../Site-Agrotech/js/auth.js'),'utf8');
const reply=(status,user)=>({ok:status===200,status,json:async()=>({user,message:'Falha de teste'})});
function setup(url='http://localhost:3000/agrotruck.html'){
 const elements=new Map(),listeners={};
 function element(){return {hidden:false,value:'',checked:false,style:{},dataset:{},textContent:'',classList:{add:jest.fn(),remove:jest.fn(),toggle:jest.fn(),contains:()=>false},setAttribute:jest.fn(),addEventListener:jest.fn(),querySelector:()=>null,reset:jest.fn()};}
 const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],addEventListener:(type,fn)=>{listeners[type]=fn;},createElement:element,body:{style:{},appendChild:el=>elements.set(el.id,el)}};
 const parsed=new URL(url);const location={href:parsed.href,origin:parsed.origin,hostname:parsed.hostname,port:parsed.port,protocol:parsed.protocol,pathname:parsed.pathname,search:parsed.search,replace:jest.fn(),assign:jest.fn()};
 const fetch=jest.fn();const window={location};vm.runInNewContext(source,{window,document,fetch,URL,URLSearchParams,AbortController,setTimeout,clearTimeout});
 return {auth:window.AgroAuth,fetch,location,elements,listeners,element};
}
test('dashboard autenticado usa cookie e sessão real sem redirecionar',async()=>{const t=setup();t.fetch.mockResolvedValue(reply(200,{id:1,nome:'Lucas'}));expect((await t.auth.requireAuthOrRedirect()).id).toBe(1);expect(t.location.replace).not.toHaveBeenCalled();expect(t.fetch.mock.calls[0][1]).toMatchObject({credentials:'include',cache:'no-store'});});
test('401 redireciona para login preservando destino',async()=>{const t=setup();t.fetch.mockResolvedValue(reply(401));expect(await t.auth.requireAuthOrRedirect()).toBeNull();expect(t.location.replace).toHaveBeenCalledWith('index.html?login=1&next=%2Fagrotruck.html');});
test.each([500,429])('erro %s não é tratado como logout',async status=>{const t=setup();t.fetch.mockResolvedValue(reply(status));await expect(t.auth.requireAuthOrRedirect()).rejects.toThrow();expect(t.location.replace).not.toHaveBeenCalled();});
test('erro de rede não encaminha ao cadastro ou login',async()=>{const t=setup();t.fetch.mockRejectedValue(new Error('offline'));await expect(t.auth.requireAuthOrRedirect()).rejects.toThrow(/servidor/);expect(t.location.replace).not.toHaveBeenCalled();});
test('consultas simultâneas compartilham a mesma requisição',async()=>{const t=setup();t.fetch.mockResolvedValue(reply(200,{id:1}));await Promise.all([t.auth.refreshSession(),t.auth.requireAuthOrRedirect()]);expect(t.fetch).toHaveBeenCalledTimes(1);});
test('Live Server mantém 127.0.0.1 em vez de trocar para localhost',async()=>{const t=setup('http://127.0.0.1:5500/agrotruck.html');t.fetch.mockResolvedValue(reply(200,{id:1}));await t.auth.refreshSession();expect(t.fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/auth/me');});
test('produção usa o backend Render configurado',async()=>{const t=setup('https://agro.example/agrotruck.html');t.fetch.mockResolvedValue(reply(200,{id:1}));await t.auth.refreshSession();expect(t.fetch.mock.calls[0][0]).toBe('https://agrotech-backend-o07u.onrender.com/api/auth/me');});
test.each(['https://evil.example/agrotruck.html','//evil.example/admin.html','javascript:alert(1)','/reset-senha.html'])('retorno externo ou não permitido é recusado: %s',next=>{const t=setup('https://agro.example/index.html?next='+encodeURIComponent(next));expect(t.auth.returnTarget()).toBeNull();});
test('login confirma cookie e retorna ao dashboard',async()=>{
 const t=setup('http://localhost:3000/index.html?login=1&next=%2Fagrotruck.html');
 for(const id of ['loginForm','loginEmail','loginPassword','loginRemember','loginOverlay','loginError'])t.elements.set(id,t.element());
 t.elements.get('loginEmail').value='lucas@example.com';t.elements.get('loginPassword').value='Senha123';
 t.fetch.mockResolvedValueOnce(reply(401));await t.listeners.DOMContentLoaded();
 const handler=t.elements.get('loginForm').addEventListener.mock.calls[0][1];
 t.fetch.mockResolvedValue(reply(200,{id:1,nome:'Lucas'}));await handler({preventDefault(){}});
 expect(t.fetch.mock.calls.slice(-2).map(call=>call[0])).toEqual(['http://localhost:3000/api/auth/login','http://localhost:3000/api/auth/me']);
 expect(t.location.assign).toHaveBeenCalledWith('/agrotruck.html');
});
test('logout com falha não apresenta sessão encerrada',async()=>{const t=setup();t.fetch.mockResolvedValueOnce(reply(200,{id:1}));await t.auth.refreshSession();t.fetch.mockRejectedValue(new Error('offline'));await t.auth.logout();expect(t.auth.getCurrentUser().id).toBe(1);expect(t.location.replace).not.toHaveBeenCalled();});
test('timeout informa demora do servidor',async()=>{const t=setup();const err=new Error('timeout');err.name='AbortError';t.fetch.mockRejectedValue(err);await expect(t.auth.refreshSession()).rejects.toThrow('O servidor demorou demais');});
