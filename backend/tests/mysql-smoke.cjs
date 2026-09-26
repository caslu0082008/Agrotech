// Teste opt-in: cria banco temporário exclusivo e o remove no finally.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path');
process.env.NODE_ENV='test';process.env.COOKIE_SECURE='false';process.env.COOKIE_SAME_SITE='lax';process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
const env=require('../src/config/env'),mysql=require('mysql2/promise');
const database='agrotech_test_'+crypto.randomBytes(8).toString('hex');
async function run(){
 let connection,pool,created=false;
 try{
  connection=await mysql.createConnection({host:env.db.host,port:env.db.port,user:env.db.user,password:env.db.password,connectTimeout:5000});
  await connection.query('CREATE DATABASE '+database);created=true;
  for(let i=0;i<2;i++){const result=cp.spawnSync(process.execPath,['src/config/migrate.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DB_NAME:database},encoding:'utf8'});assert.equal(result.status,0,'Migração deve funcionar duas vezes');}
  env.db.database=database;pool=require('../src/config/db').pool;
  const app=require('../src/app'),request=require('supertest');
  const agent=request.agent(app),admin=request.agent(app);
  const post=(client,url,body)=>client.post(url).set('X-AgroTech-Request','1').send(body);
  const account={nome:'Teste de integração',email:'smoke@example.test',password:'TesteSeguro123'};
  assert.equal((await post(agent,'/api/auth/register',account)).status,201);
  assert.equal((await post(agent,'/api/auth/login',account)).status,200);
  assert.equal((await agent.get('/api/auth/me')).status,200);
  assert.equal((await agent.get('/api/admin/users')).status,403);
  const adminAccount={...account,email:'admin@example.test'};assert.equal((await post(admin,'/api/auth/register',adminAccount)).status,201);
  await pool.query("UPDATE users SET role='admin' WHERE email=?",[adminAccount.email]);
  assert.equal((await post(admin,'/api/auth/login',adminAccount)).status,200);
  const list=await admin.get('/api/admin/users?search=smoke');assert.equal(list.status,200);assert.equal(list.body.users.length,1);
  const id=list.body.users[0].id;assert.equal((await admin.get('/api/admin/users/'+id)).status,200);
  assert.equal((await admin.patch('/api/admin/users/'+id+'/status').set('X-AgroTech-Request','1').send({status:'suspended',confirm:'CONFIRMAR'})).status,200);
  assert.equal((await agent.get('/api/auth/me')).status,401);
  assert.equal((await admin.patch('/api/admin/users/'+id+'/status').set('X-AgroTech-Request','1').send({status:'active',confirm:'CONFIRMAR'})).status,200);
  assert.equal((await post(agent,'/api/auth/login',account)).status,200);
  const repository=require('../src/repositories/passwordResetRepository');
  await repository.createToken({userId:id,tokenHash:'a'.repeat(64),expiresAt:new Date(Date.now()+60000)});
  const record=await repository.findValidByHash('a'.repeat(64));
  const hash=await require('../src/utils/password').hashPassword('NovaSenha123');
  const results=await Promise.all([1,2].map(()=>repository.consumeAndReset({tokenId:record.id,userId:id,passwordHash:hash})));
  assert.deepEqual(results.sort(),[false,true]);
  assert.equal((await agent.get('/api/auth/me')).status,401);
  assert.equal((await post(agent,'/api/auth/login',{...account,password:'NovaSenha123'})).status,200);
  assert.equal((await post(agent,'/api/auth/logout')).status,200);
  assert.equal((await agent.get('/api/auth/me')).status,401);
  console.log('MySQL real: migração idempotente, cadastro, login, sessão, admin, suspensão, reativação, redefinição concorrente e logout OK.');
 }finally{if(pool)await pool.end();if(connection){if(!/^agrotech_test_[a-f0-9]{16}$/.test(database))throw new Error('Nome temporário inválido.');try{if(created){await connection.query('DROP DATABASE IF EXISTS '+database);console.log('Banco temporário removido.');}}finally{await connection.end();}console.log('Banco da aplicação preservado.');}}
}
run().catch(err=>{console.error('Teste MySQL falhou:',err.code||err.message);process.exitCode=1;});