const fs=require('fs'),path=require('path'),mysql=require('mysql2/promise'),env=require('./env');
async function migrate() {
 if(!/^[a-zA-Z0-9_]+$/.test(env.db.database)) throw new Error('DB_NAME inválido.');
 const connection=await mysql.createConnection({host:env.db.host,port:env.db.port,user:env.db.user,password:env.db.password});
 const quoted='\x60'+env.db.database+'\x60'; let locked=false;
 try {
  const [[lock]]=await connection.query('SELECT GET_LOCK(?, 30) AS acquired',['agrotech-migration-'+env.db.database]);
  if(lock.acquired!==1) throw new Error('Outra migração em execução.'); locked=true;
  await connection.query('CREATE DATABASE IF NOT EXISTS '+quoted+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connection.query('USE '+quoted);
  const schema=fs.readFileSync(path.join(__dirname,'../../sql/schema.sql'),'utf8').replace(/^--.*$/gm,'');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) {
   if(/^CREATE DATABASE|^USE /i.test(statement)) continue;
   const index=/^CREATE INDEX (\w+) ON (\w+)/i.exec(statement);
   if(index){const [rows]=await connection.query('SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?',[env.db.database,index[2],index[1]]);if(rows.length)continue;}
   await connection.query(statement);
  }
  const migration=fs.readFileSync(path.join(__dirname,'../../sql/001-user-access.sql'),'utf8').replace(/^--.*$/gm,'');
  for(const statement of migration.split(';').map(s=>s.trim()).filter(Boolean)){
   const column=/ADD COLUMN (\w+)/i.exec(statement)[1];
   const [rows]=await connection.query('SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?',[env.db.database,'users',column]);
   if(!rows.length) await connection.query(statement);
  }
  console.log('Migração concluída. Cadastros existentes preservados.');
 } finally {if(locked)await connection.query('SELECT RELEASE_LOCK(?)',['agrotech-migration-'+env.db.database]);await connection.end();}
}
migrate().catch(()=>{console.error('Falha na migração. Confira MySQL, permissões e configuração DB_*. Nenhuma tabela é apagada.');process.exitCode=1;});