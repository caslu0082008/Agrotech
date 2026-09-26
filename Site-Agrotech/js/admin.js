(function(){ 'use strict';
let page=1, busy=false;
const byId=id=>document.getElementById(id);
function status(text){byId('adminStatus').textContent=text;}
async function api(path,options={}){
 try{return await AgroAuth.apiRequest(path,{...options,admin:true});}
 catch(err){if(err.status===401 || err.status===403){byId('usersBody').replaceChildren();byId('userDetails').replaceChildren();byId('adminContent').hidden=true;} if(err.status===401)await AgroAuth.requireAuthOrRedirect();throw err;}
}
async function details(id){
 try{const {user}=await api('/users/'+id);const el=byId('userDetails');el.replaceChildren();const title=document.createElement('h2');title.textContent='Detalhes do cadastro';const list=document.createElement('dl');
  for(const [key,label] of Object.entries({id:'Identificador',nome:'Nome',email:'E-mail',role:'Perfil',status:'Estado',created_at:'Cadastro',updated_at:'Última alteração'})){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(user[key] ?? '—');list.append(dt,dd);}
  el.append(title,list);el.hidden=false;el.setAttribute('tabindex','-1');el.focus();
 }catch(err){status(err.message);}
}
async function change(user,button){
 const next=user.status==='suspended'?'active':'suspended';
 if(!window.confirm((next==='suspended'?'Suspender':'Reativar')+' a conta '+user.email+'? A alteração revogará as sessões existentes.'))return;
 button.disabled=true;
 try{const result=await api('/users/'+user.id+'/status',{method:'PATCH',body:{status:next,confirm:'CONFIRMAR'}});byId('userDetails').hidden=true;await load();status(result.message);}
 catch(err){status(err.message);}finally{button.disabled=false;}
}
async function load(){
 if(busy)return;busy=true;byId('adminRetry').hidden=true;status('Carregando cadastros…');
 try{const result=await api('/users?'+new URLSearchParams({search:byId('userSearch').value.trim(),page}));
  const tbody=byId('usersBody');tbody.replaceChildren();
  for(const user of result.users){const row=document.createElement('tr');
   for(const value of [user.nome,user.email,user.role==='admin'?'Administrador':'Usuário',user.status==='suspended'?'Suspensa':'Ativa']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
   const actions=document.createElement('td'),view=document.createElement('button');view.className='btn-secondary';view.textContent='Ver cadastro';view.onclick=()=>details(user.id);actions.append(view);
   if(user.role!=='admin'){const toggle=document.createElement('button');toggle.className='btn-secondary';toggle.textContent=user.status==='suspended'?'Reativar':'Suspender';toggle.onclick=()=>change(user,toggle);actions.append(toggle);}
   row.append(actions);tbody.append(row);
  }
  byId('previousPage').disabled=page===1;byId('nextPage').disabled=page*result.pageSize>=result.total;
  byId('pageLabel').textContent='Página '+page+' · '+result.total+' cadastros';
  status(result.users.length?'Cadastros carregados.':'Nenhum cadastro encontrado.');
 }catch(err){status(err.message);byId('adminRetry').hidden=false;}finally{busy=false;}
}
async function init(){try{const user=await AgroAuth.requireAuthOrRedirect();if(!user)return;if(user.role!=='admin'){status('Acesso exclusivo de administradores.');return;}byId('adminContent').hidden=false;await load();}catch(err){status(err.message);byId('adminRetry').hidden=false;}}
document.addEventListener('DOMContentLoaded',()=>{
 byId('adminSearch').addEventListener('submit',e=>{e.preventDefault();if(busy)return;page=1;load();});
 byId('previousPage').onclick=()=>{if(busy)return;page--;load();};byId('nextPage').onclick=()=>{if(busy)return;page++;load();};
 byId('adminRetry').onclick=init;init();
});
})();