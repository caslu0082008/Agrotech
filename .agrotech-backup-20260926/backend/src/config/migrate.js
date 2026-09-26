// Script utilitário: aplica o sql/schema.sql usando as credenciais do .env.
// Alternativa a rodar `mysql -u root -p < sql/schema.sql` manualmente.
//
// Uso:
//   npm run db:migrate

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('./env');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    console.log('Aplicando sql/schema.sql...');
    await connection.query(sql);
    console.log('Schema aplicado com sucesso.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Falha ao aplicar o schema:', err.message);
  process.exit(1);
});
