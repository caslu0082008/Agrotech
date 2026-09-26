const app = require('./src/app');
const env = require('./src/config/env');
const { pingDatabase } = require('./src/config/db');

async function start() {
  try {
    await pingDatabase();
    console.log('Conexão com o MySQL estabelecida com sucesso.');
  } catch (err) {
    console.error('Não foi possível conectar ao MySQL:', err.message);
    console.error('Verifique as variáveis DB_* no seu .env e se o MySQL está rodando.');
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`AgroTech backend rodando na porta ${env.port} (${env.nodeEnv})`);
  });
}

start();
