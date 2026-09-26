# AgroTech — Backend de Autenticação

Este documento explica como configurar e rodar o backend criado para o site
AgroTech (login, cadastro, "lembrar de mim", recuperação de senha e logout).

## 1. Arquitetura

```
backend/
  server.js                 → ponto de entrada (sobe o Express)
  src/
    app.js                  → configuração do Express (helmet, cors, rotas)
    config/
      env.js                → carrega e valida as variáveis de ambiente
      db.js                 → pool de conexões MySQL
      migrate.js            → aplica sql/schema.sql via Node
    routes/authRoutes.js    → define os endpoints /api/auth/*
    controllers/authController.js → traduz HTTP <-> regras de negócio
    services/authService.js → regras de negócio (hash, tokens, bloqueio de conta...)
    repositories/           → único lugar que fala SQL com o MySQL (queries parametrizadas)
    middleware/
      auth.js                → protege rotas privadas (JWT em cookie httpOnly)
      validate.js             → processa erros do express-validator
      rateLimit.js            → limita tentativas de login/cadastro/recuperação
      errorHandler.js         → tratamento centralizado de erros (não vaza stack em produção)
    validators/authValidators.js → regras de validação de cada rota
    utils/                  → senha (bcrypt), JWT, e-mail, ApiError, asyncHandler
  sql/schema.sql            → cria o banco `agrotech` e as tabelas
  tests/auth.test.js        → 14 testes automatizados (Jest + Supertest)
  .env.example              → modelo de variáveis de ambiente

Site-Agrotech/               (frontend, já integrado)
  js/auth.js                → toda a chamada ao backend (fetch) e estados de UI
  js/main.js                → agora delega abrir/fechar modal para auth.js
  reset-senha.html          → página para onde o link de e-mail de recuperação aponta
  index.html, equipe.html, produtos.html, referencias.html, contato.html, jogo.html
                             → modal de login expandido com 3 telas: Entrar / Criar conta / Esqueci a senha
```

**Autenticação:** JWT assinado, guardado em cookie `httpOnly` (não é acessível
via JavaScript/localStorage). Se "Lembrar de mim" estiver marcado, o cookie
dura 30 dias (`JWT_EXPIRES_IN_REMEMBER`); caso contrário, 1 dia
(`JWT_EXPIRES_IN`).

**Proteção contra brute force:** rate limiting por IP+e-mail nas rotas de
autenticação, e bloqueio temporário (15 min) da conta após 5 tentativas de
senha incorretas seguidas.

**Recuperação de senha:** gera um token aleatório de 32 bytes, guarda no
banco apenas o **hash SHA-256** dele (nunca o token puro), com expiração de
30 minutos (configurável) e uso único. A resposta de "esqueci minha senha" é
sempre a mesma, exista ou não o e-mail, para não revelar quais e-mails têm conta.

## 2. Pré-requisitos

- Node.js 18 ou superior
- MySQL 8 (ou compatível) rodando localmente ou remotamente

## 3. Criar o banco de dados

Opção A — direto pelo cliente MySQL:

```bash
mysql -u root -p < backend/sql/schema.sql
```

Opção B — usando o script do projeto (depois de configurar o `.env`, ver item 4):

```bash
cd backend
npm run db:migrate
```

Isso cria o banco `agrotech` e as tabelas `users` e `password_reset_tokens`.

## 4. Configurar as variáveis de ambiente

```bash
cd backend
cp .env.example .env
```

Edite o `.env` e preencha pelo menos:

- `DB_USER`, `DB_PASSWORD`, `DB_NAME` — credenciais do seu MySQL
- `JWT_SECRET` — um valor aleatório forte. Você pode gerar um com:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `FRONTEND_ORIGIN` — a origem de onde o frontend é servido (ex.:
  `http://127.0.0.1:5500` se você abrir o site com a extensão "Live Server"
  do VS Code, ou a URL onde o site for hospedado)
- `RESET_PASSWORD_URL` — a URL completa da página `reset-senha.html` do seu
  frontend publicado (ex.: `http://127.0.0.1:5500/reset-senha.html`)

As variáveis `SMTP_*` são opcionais: se não forem preenchidas, o backend
**não falha** — ele imprime o link de recuperação de senha no console do
servidor, para que você consiga testar o fluxo completo sem um provedor de
e-mail real. Para enviar e-mails de verdade, preencha `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` com as credenciais do
seu provedor (SendGrid, Amazon SES, Mailgun, Gmail com senha de app, etc.).

## 5. Instalar dependências

```bash
cd backend
npm install
```

## 6. Rodar em desenvolvimento

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou na porta definida em `PORT`).
Você verá no console a confirmação de conexão com o MySQL.

Depois, basta abrir o frontend (por exemplo com a extensão Live Server do
VS Code, servindo a pasta `Site-Agrotech/`) e usar normalmente o botão
"Entrar" no menu — o modal de login/cadastro/recuperação de senha já está
conectado ao backend.

> Se o frontend for servido em uma porta/origem diferente das configuradas
> em `FRONTEND_ORIGIN`, adicione essa origem à variável (separada por vírgula).
> Se a URL do backend não for `http://localhost:3000`, defina antes do
> `<script src="js/auth.js">` de cada página:
> `<script>window.AGROTECH_API_BASE_URL = "https://sua-api.com";</script>`

## 7. Rodar os testes automatizados

```bash
npm test
```

Os testes (Jest + Supertest) cobrem: cadastro de usuário, e-mail duplicado,
entradas inválidas, login correto, senha incorreta, usuário inexistente,
acesso a rota protegida com e sem autenticação, logout, fluxo completo de
recuperação de senha, token de recuperação inválido e expirado. Eles usam
repositórios mockados em memória, então **não exigem um MySQL real** para
rodar — validam toda a lógica de controllers/services/middlewares.

## 8. Rodar em produção

```bash
cd backend
npm install --omit=dev
NODE_ENV=production npm start
```

Em produção, lembre-se de:
- Definir `NODE_ENV=production` (isso ativa `secure` nos cookies e some com o stack trace nas respostas de erro)
- Definir `COOKIE_SECURE=true` (exige HTTPS)
- Usar um `JWT_SECRET` forte e mantido em segredo
- Servir o backend atrás de HTTPS (proxy reverso Nginx, ou plataforma como Railway/Render/Fly.io)
- Ajustar `FRONTEND_ORIGIN` para o domínio real do site

## 9. Endpoints disponíveis

| Método | Rota                          | Descrição                                   |
|--------|-------------------------------|----------------------------------------------|
| POST   | `/api/auth/register`          | Cria uma nova conta                           |
| POST   | `/api/auth/login`              | Autentica (aceita `remember: true/false`)     |
| POST   | `/api/auth/logout`             | Encerra a sessão (limpa o cookie)             |
| GET    | `/api/auth/me`                 | Retorna o usuário autenticado (rota protegida)|
| POST   | `/api/auth/forgot-password`    | Envia (ou simula, se SMTP não configurado) o link de recuperação |
| POST   | `/api/auth/reset-password`     | Redefine a senha usando o token do e-mail     |

## 10. Observações importantes

- O projeto original não possui uma página de "painel"/dashboard interno.
  Por isso, após o login, o modal apenas fecha e o botão "Entrar" da nav
  passa a mostrar "Sair (nome)" — não há redirecionamento para um painel,
  pois essa página não existe no frontend enviado. Se você criar uma página
  de painel depois, basta redirecionar em `js/auth.js`, na função
  `bindLoginForm`, após `updateNavForUser(data.user)`.
- Nenhuma funcionalidade visual do frontend original foi alterada — apenas o
  modal de login foi expandido (mantendo a mesma identidade visual) e uma
  nova página `reset-senha.html` foi criada seguindo o mesmo estilo do site.
