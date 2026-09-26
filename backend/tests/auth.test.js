// Testes de integração das rotas de autenticação.
//
// Os repositórios (camada de acesso ao MySQL) são mockados em memória,
// então estes testes NÃO exigem um banco MySQL real rodando — eles validam
// o comportamento de controllers, services, middlewares e validação.
//
// Para testes de integração completos com o banco real, aponte o .env.test
// para um banco MySQL de teste e rode as queries de schema.sql antes.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.COOKIE_SECURE = 'false';

jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/passwordResetRepository');
jest.mock('../src/utils/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ simulated: true }),
  isSmtpConfigured: () => false,
}));

const supertest=require('supertest');
function secure(client){for(const method of ['post','patch','delete']){const original=client[method].bind(client);client[method]=(...args)=>original(...args).set('X-AgroTech-Request','1');}return client;}
const request=app=>secure(supertest(app));request.agent=app=>secure(supertest.agent(app));
jest.mock('../src/repositories/adminRepository');
const adminRepository=require('../src/repositories/adminRepository');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const userRepository = require('../src/repositories/userRepository');
const passwordResetRepository = require('../src/repositories/passwordResetRepository');

// ── banco de dados falso em memória ──
let usersDb = [];
let nextId = 1;

function resetFakeDb() {
  usersDb = [];
  nextId = 1;
}

beforeEach(async () => {
  resetFakeDb();
  jest.clearAllMocks();

  userRepository.findByEmail.mockImplementation(async (email) =>
    usersDb.find((u) => u.email === email) || null
  );
  userRepository.findById.mockImplementation(async (id) => {
    const u = usersDb.find((x) => x.id === id);
    if (!u) return null;
    const { password_hash, failed_login_count, locked_until, ...pub } = u;
    return pub;
  });
  userRepository.createUser.mockImplementation(async ({ nome, email, passwordHash }) => {
    const user = {
      id: nextId++,
      nome,
      email,
      password_hash: passwordHash,
      failed_login_count: 0,
      locked_until: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    usersDb.push(user);
    const { password_hash: _p, failed_login_count, locked_until, ...pub } = user;
    return pub;
  });
  userRepository.updatePasswordHash.mockImplementation(async (id, hash) => {
    const u = usersDb.find((x) => x.id === id);
    if (u) { u.password_hash = hash; u.session_version=(u.session_version||0)+1; u.failed_login_count = 0; u.locked_until = null; }
  });
  userRepository.incrementFailedLogin.mockImplementation(async (id) => {
    const u = usersDb.find((x) => x.id === id);
    if (u) u.failed_login_count = (u.failed_login_count || 0) + 1;
  });
  userRepository.lockUser.mockImplementation(async (id, until) => {
    const u = usersDb.find((x) => x.id === id);
    if (u) u.locked_until = until;
  });
  userRepository.resetFailedLogin.mockImplementation(async (id) => {
    const u = usersDb.find((x) => x.id === id);
    if (u) { u.failed_login_count = 0; u.locked_until = null; }
  });

  userRepository.revokeSessions.mockImplementation(async id=>{const u=usersDb.find(x=>x.id===id);if(u)u.session_version=(u.session_version||0)+1;});
  let tokensDb = [];
  passwordResetRepository.createToken.mockImplementation(async ({ userId, tokenHash, expiresAt }) => {
    tokensDb.push({ id: tokensDb.length + 1, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, used_at: null });
  });
  passwordResetRepository.findValidByHash.mockImplementation(async (tokenHash) =>
    tokensDb.find((t) => t.token_hash === tokenHash) || null
  );
  passwordResetRepository.markUsed.mockImplementation(async (id) => {
    const t = tokensDb.find((x) => x.id === id);
    if (t) t.used_at = new Date();
  });
  passwordResetRepository.invalidateAllForUser.mockImplementation(async (userId) => {
    tokensDb.filter((t) => t.user_id === userId).forEach((t) => { t.used_at = new Date(); });
  });

  passwordResetRepository.consumeAndReset.mockImplementation(async ({tokenId,userId,passwordHash}) => {
    const token=tokensDb.find(t=>t.id===tokenId && t.user_id===userId && !t.used_at && new Date(t.expires_at)>new Date());
    if(!token)return false;
    tokensDb.filter(t=>t.user_id===userId).forEach(t=>{t.used_at=new Date();});
    await userRepository.updatePasswordHash(userId,passwordHash);return true;
  });
  // expõe para os testes acessarem o token "enviado por e-mail"
  global.__tokensDb = () => tokensDb;
});

const VALID_PASSWORD = 'SenhaForte123';

async function createExistingUser(email = 'lucas@exemplo.com') {
  const hash = await bcrypt.hash(VALID_PASSWORD, 4);
  const user = {
    id: nextId++,
    role:'user', status:'active', session_version:0,
    nome: 'Lucas',
    email,
    password_hash: hash,
    failed_login_count: 0,
    locked_until: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  usersDb.push(user);
  return user;
}

describe('POST /api/auth/register', () => {
  test('cria um novo usuário com sucesso', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nome: 'Lucas Silva',
      email: 'lucas.silva@exemplo.com',
      password: VALID_PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({ nome: 'Lucas Silva', email: 'lucas.silva@exemplo.com' });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('rejeita e-mail duplicado', async () => {
    await createExistingUser('duplicado@exemplo.com');
    const res = await request(app).post('/api/auth/register').send({
      nome: 'Outra Pessoa',
      email: 'duplicado@exemplo.com',
      password: VALID_PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('rejeita entradas inválidas (e-mail malformado e senha fraca)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nome: 'A',
      email: 'nao-e-email',
      password: '123',
    });
    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  test('login correto retorna usuário e seta cookie de sessão', async () => {
    await createExistingUser('lucas@exemplo.com');
    const res = await request(app).post('/api/auth/login').send({
      email: 'lucas@exemplo.com',
      password: VALID_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('lucas@exemplo.com');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  test('senha incorreta retorna 401 com mensagem genérica', async () => {
    await createExistingUser('lucas@exemplo.com');
    const res = await request(app).post('/api/auth/login').send({
      email: 'lucas@exemplo.com',
      password: 'senhaErrada123',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/inválidos/i);
  });

  test('usuário inexistente retorna 401 com a mesma mensagem genérica', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ninguem@exemplo.com',
      password: 'qualquerSenha123',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/inválidos/i);
  });
});

describe('Rotas protegidas', () => {
  test('GET /api/auth/me sem autenticação retorna 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me autenticado retorna os dados do usuário', async () => {
    await createExistingUser('lucas@exemplo.com');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'lucas@exemplo.com', password: VALID_PASSWORD });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('lucas@exemplo.com');
  });

  test('POST /api/auth/logout invalida a sessão', async () => {
    await createExistingUser('lucas@exemplo.com');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'lucas@exemplo.com', password: VALID_PASSWORD });
    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});

describe('Recuperação de senha', () => {
  test('forgot-password sempre retorna sucesso, mesmo com e-mail inexistente', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ninguem@exemplo.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('fluxo completo: solicitar, redefinir e logar com a nova senha', async () => {
    const user = await createExistingUser('lucas@exemplo.com');
    const mailer = require('../src/utils/mailer');

    await request(app).post('/api/auth/forgot-password').send({ email: 'lucas@exemplo.com' });
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const resetUrl = mailer.sendPasswordResetEmail.mock.calls[0][1];
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'NovaSenha456',
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'lucas@exemplo.com',
      password: 'NovaSenha456',
    });
    expect(loginRes.status).toBe(200);
  });

  test('token inválido é rejeitado', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'token-que-nao-existe',
      password: 'NovaSenha456',
    });
    expect(res.status).toBe(400);
  });

  test('token expirado é rejeitado', async () => {
    await createExistingUser('lucas@exemplo.com');
    const mailer = require('../src/utils/mailer');
    await request(app).post('/api/auth/forgot-password').send({ email: 'lucas@exemplo.com' });
    const resetUrl = mailer.sendPasswordResetEmail.mock.calls[0][1];
    const token = new URL(resetUrl).searchParams.get('token');

    // força a expiração do token gerado
    const tokens = global.__tokensDb();
    tokens[0].expires_at = new Date(Date.now() - 60 * 1000);

    const res = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'NovaSenha456',
    });
    expect(res.status).toBe(400);
  });

  test('entradas inválidas no reset (senha fraca) retornam 422', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'qualquer',
      password: '123',
    });
    expect(res.status).toBe(422);
  });
});

async function loginAs(role='user',email='lucas@exemplo.com'){const user=await createExistingUser(email);user.role=role;const agent=request.agent(app);const res=await agent.post('/api/auth/login').send({email,password:VALID_PASSWORD});expect(res.status).toBe(200);return {agent,user,cookie:res.headers['set-cookie'][0].split(';')[0]};}
describe('Administração e sessão',()=>{
 test('anônimo não lista usuários',async()=>{expect((await request(app).get('/api/admin/users')).status).toBe(401);expect(adminRepository.list).not.toHaveBeenCalled();});
 test('usuário comum não lista, visualiza nem suspende',async()=>{const {agent}=await loginAs();for(const p of ['/api/admin/users','/api/admin/users/2'])expect((await agent.get(p)).status).toBe(403);expect((await agent.patch('/api/admin/users/2/status').send({status:'suspended',confirm:'CONFIRMAR'})).status).toBe(403);expect(adminRepository.setStatus).not.toHaveBeenCalled();});
 test('admin busca e visualiza cadastros',async()=>{const {agent}=await loginAs('admin');adminRepository.list.mockResolvedValue({users:[{id:2,nome:'Pessoa',role:'user'}],total:1});expect((await agent.get('/api/admin/users?search=Pessoa&page=2')).status).toBe(200);expect(adminRepository.list).toHaveBeenCalledWith({search:'Pessoa',limit:20,offset:20});adminRepository.find.mockResolvedValue({id:2,nome:'Pessoa'});expect((await agent.get('/api/admin/users/2')).status).toBe(200);});
 test('suspensão exige confirmação e revoga sessões, reativação não restaura JWT antigo',async()=>{
  const {agent:admin,user:owner}=await loginAs('admin','admin@example.com');const {agent,user}=await loginAs();adminRepository.find.mockResolvedValue(user);adminRepository.setStatus.mockImplementation(async(id,status)=>{user.status=status;user.session_version++;return true;});const route='/api/admin/users/'+user.id+'/status';
  expect((await admin.patch(route).send({status:'suspended'})).status).toBe(422);
  expect((await admin.patch(route).send({status:'suspended',confirm:'CONFIRMAR'})).status).toBe(200);
  expect((await agent.get('/api/auth/me')).status).toBe(401);expect((await agent.post('/api/auth/login').send({email:user.email,password:VALID_PASSWORD})).status).toBe(401);
  expect((await admin.patch('/api/admin/users/'+owner.id+'/status').send({status:'suspended',confirm:'CONFIRMAR'})).status).toBe(403);
  expect((await admin.patch(route).send({status:'active',confirm:'CONFIRMAR'})).status).toBe(200);expect((await agent.get('/api/auth/me')).status).toBe(401);
 });
 test('cadastro não aceita promoção pelo corpo',async()=>{const res=await request(app).post('/api/auth/register').send({nome:'Teste',email:'novo@example.com',password:VALID_PASSWORD,role:'admin'});expect(res.status).toBe(201);expect(res.body.user.role).toBe('user');});
 test('logout revoga cópia do JWT',async()=>{const {agent,cookie}=await loginAs();expect((await agent.post('/api/auth/logout')).status).toBe(200);expect((await request(app).get('/api/auth/me').set('Cookie',cookie)).status).toBe(401);});
 test('JWT adulterado e expirado são rejeitados',async()=>{const jwt=require('jsonwebtoken');const user=await createExistingUser();for(const token of ['invalid',jwt.sign({sub:user.id},process.env.JWT_SECRET,{expiresIn:-1})])expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+token)).status).toBe(401);});
 test('CSRF e origem externa são rejeitados',async()=>{expect((await supertest(app).post('/api/auth/logout')).status).toBe(403);expect((await request(app).post('/api/auth/login').set('Origin','https://evil.example').send({})).status).toBe(403);});
 test('sessão persiste e não usa cache',async()=>{const {agent}=await loginAs();for(let i=0;i<3;i++){const res=await agent.get('/api/auth/me');expect(res.status).toBe(200);expect(res.headers['cache-control']).toBe('no-store');}});
});
test('redefinição revoga sessão anterior e token não pode ser reutilizado',async()=>{
 const {agent,user}=await loginAs();await agent.post('/api/auth/forgot-password').send({email:user.email});
 const token=new URL(require('../src/utils/mailer').sendPasswordResetEmail.mock.calls[0][1]).searchParams.get('token');
 const body={token,password:'NovaSenha123'};
 expect((await agent.post('/api/auth/reset-password').send(body)).status).toBe(200);
 expect((await agent.get('/api/auth/me')).status).toBe(401);
 expect((await agent.post('/api/auth/reset-password').send(body)).status).toBe(400);
});
test('frontend e recursos são servidos sem expor backend ou env',async()=>{
 expect((await request(app).get('/agrotruck.html')).status).toBe(200);
 expect((await request(app).get('/admin.html')).status).toBe(200);
 expect((await request(app).get('/js/auth.js')).status).toBe(200);
 for(const route of ['/.env','/backend/.env','/src/config/env.js'])expect((await request(app).get(route)).status).toBe(404);
});