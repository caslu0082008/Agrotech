# AgroTech: Agrotruck — execução e manutenção

O Express serve API e Site-Agrotech na mesma origem. backend/.env foi preservado.

## Iniciar no PowerShell

Na raiz do projeto:

~~~powershell
cd backend
npm ci
npm run db:migrate
npm run dev
~~~

Abra http://localhost:3000/index.html (ou a porta PORT configurada). Não use file://. Nesta entrega as dependências já estavam instaladas e a migração foi aplicada: para iniciar agora basta cd backend e npm run dev. O MySQL deve estar em execução.

Live Server nas portas 5500/5501 continua suportado: localhost usa API localhost:3000; 127.0.0.1 usa API 127.0.0.1:3000. Não misture hosts. Para outras portas/hosts, defina window.AGROTECH_API_BASE_URL antes de auth.js e configure FRONTEND_ORIGIN. Prefira servir tudo pelo Express.

## Primeiro administrador

Cadastre uma conta normalmente. Em terminal autorizado no servidor, substitua o e-mail pelo e-mail exato dessa conta:

~~~powershell
cd backend
npm run admin:promote -- seu-email-cadastrado@example.com --confirm
~~~

O comando promove somente uma conta comum ativa existente, revogando suas sessões. Não cria senha nem usuário. Faça login novamente e abra /admin.html ou Administrar no menu. Nenhuma conta real foi promovida automaticamente.

Administração: busca por nome/e-mail, paginação, detalhes e suspensão/reativação com confirmação. Suspender bloqueia login e revoga sessões, preservando dados. Não há exclusão física. A própria conta e outras contas administrativas são protegidas contra suspensão pela interface. A autorização é verificada no backend em cada acesso.

## Migração

backend/sql/001-user-access.sql adiciona role (user/admin, padrão user), status (active/suspended, padrão active) e session_version (contador, padrão 0). Os cadastros existentes recebem esses padrões; nomes, e-mails e senhas permanecem intactos.

Use npm run db:migrate: o runner respeita DB_NAME, verifica colunas/índices e pode ser repetido. Não repita o SQL incremental manualmente. O schema inicial permanece em backend/sql/schema.sql. A migração foi aplicada e repetida nesta entrega. Faça backup operacional antes de aplicar em outro ambiente; ALTER TABLE pode bloquear tabelas grandes.

## Sessão e segurança

JWT HS256 em cookie HttpOnly. O frontend confirma /api/auth/me após login antes de apresentar sessão autenticada. Logout e redefinição de senha revogam todas as sessões da conta. Suspensão, reativação e promoção também invalidam tokens anteriores. Nenhum JWT é salvo no localStorage.

Falha de rede, CORS, 429 ou 500 não significa sessão expirada. O dashboard permite tentar novamente; apenas 401 encaminha ao login. O parâmetro next é limitado a agrotruck.html/admin.html na mesma origem.

Requisições que alteram dados em /api exigem X-AgroTech-Request: 1. O frontend envia esse cabeçalho e credentials: include. CORS usa origens explícitas. Ferramentas externas precisam enviar o cabeçalho também. O HTML é estático; os dados e ações são protegidos nos endpoints, não pelo atributo hidden.

## Produção

Use proxy HTTPS servindo frontend e /api no mesmo domínio. Configure NODE_ENV=production, JWT_SECRET forte com pelo menos 32 caracteres, FRONTEND_ORIGIN com a origem HTTPS exata e RESET_PASSWORD_URL com a URL HTTPS de /reset-senha.html.

Cookie Secure é obrigatório em produção. COOKIE_SAME_SITE é lax por padrão; none exige HTTPS e pode sofrer bloqueio de cookies de terceiros. TRUST_PROXY_HOPS deve corresponder à topologia real; o padrão é não confiar em proxies. Não use um valor arbitrário.

~~~powershell
cd backend
npm ci --omit=dev
npm run db:migrate
$env:NODE_ENV = "production"
npm start
~~~

O proxy encaminha para PORT; Express usa HTTP atrás dele. Produção HTTPS não foi publicada/testada. As regras de configuração de JWT/cookies têm testes. A CSP usa hashes para os scripts/handlers inline existentes: reinicie o servidor quando modificar HTML.

## Recuperação de senha

Configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM e RESET_PASSWORD_URL para entrega real. Sem SMTP não há envio: desenvolvimento registra aviso sem expor tokens; produção retorna erro na tentativa. Nenhum e-mail real foi enviado nesta entrega.

O token é armazenado como hash e consumido em uma transação com a troca da senha e a revogação das sessões. A concorrência no MySQL real ainda não foi validada porque o banco isolado não pôde ser criado.

## Agrotruck

O botão Acessar painel do Agrotruck aponta para http://192.168.4.1 e contém o aviso de conexão ao Wi-Fi. Esse IP é local. O diagnóstico tenta ws://192.168.4.1:81, dependendo de o firmware disponibilizar o serviço e de permissões do navegador. Não identifica SSID, não consulta nem simula sensores. Em HTTPS o teste automático é desabilitado com explicação; o link direto permanece disponível.

SSID e senha Wi-Fi já presentes no conteúdo foram preservados. Firmware, ESP32 e rede física não foram testados.

## Testes e resultados

~~~powershell
cd backend
npm test -- --no-cache
npm run test:browser
npm run test:mysql
~~~

- Jest: 43 testes aprovados em 3 suítes. API, autorização, sessão, recuperação, navegação e configuração. Repositórios/DOM/rede são simulados conforme a suíte.
- Navegador: Edge headless real + Express real, com usuários isolados em memória. Visitante → login → dashboard, cookie, reload, logout, administração e layout móvel de 390 px passaram. Screenshots em test-results/agrotruck-desktop.png e agrotruck-mobile.png.
- test:browser usa Edge no caminho padrão Windows; EDGE_PATH permite outro caminho. Usa perfil temporário, sem acessar perfil pessoal.
- MySQL existente: conexão, migração, repetição idempotente, contagem de cadastros preservada e consulta administrativa passaram sem exibir dados pessoais.
- test:mysql: bloqueado com ER_DBACCESS_DENIED_ERROR ao criar banco isolado. Não foi aprovado. Requer usuário de teste com CREATE/DROP DATABASE. Cria apenas agrotech_test_<identificador aleatório> e remove esse banco no finally; não escreve cadastros no banco da aplicação.
- SMTP real, ESP32 e produção HTTPS não foram testados.

Consulte ENTREGA-AGROTECH.md para diagnóstico e arquivos. Originais em .agrotech-backup-20260926, fora da pasta servida pelo Express e sem cópia do .env.
