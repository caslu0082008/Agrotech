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

const request = require('supertest');
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
    if (u) { u.password_hash = hash; u.failed_login_count = 0; u.locked_until = null; }
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

  // expõe para os testes acessarem o token "enviado por e-mail"
  global.__tokensDb = () => tokensDb;
});

const VALID_PASSWORD = 'SenhaForte123';

async function createExistingUser(email = 'lucas@exemplo.com') {
  const hash = await bcrypt.hash(VALID_PASSWORD, 4);
  const user = {
    id: nextId++,
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
