const {pool}=require('./db');
async function promote(){
 const email=process.argv[2];
 if(!email || process.argv[3]!=='--confirm') throw new Error('Uso: npm run admin:promote -- email-do-cadastro --confirm');
 const [result]=await pool.query("UPDATE users SET role='admin', session_version=session_version+1 WHERE email=? AND status='active' AND role='user'",[email]);
 if(result.affectedRows!==1) throw new Error('Nenhum usuário comum ativo encontrado. Confira o cadastro e o perfil atual.');
 console.log('Perfil administrativo atribuído. Faça login novamente.');
}
promote().catch(err=>{console.error(err.message.startsWith('Uso:')||err.message.startsWith('Nenhum')?err.message:'Falha ao promover cadastro. Confira a migração e o MySQL.');process.exitCode=1;}).finally(()=>pool.end());