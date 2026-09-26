const {spawnSync}=require('child_process');
const path=require('path');
function config(overrides){return spawnSync(process.execPath,['-e',"const e=require('./src/config/env'); console.log(JSON.stringify({secure:e.cookie.secure,sameSite:e.cookie.sameSite}));"],{cwd:path.resolve(__dirname,'..'),env:{...process.env,NODE_ENV:'production',JWT_SECRET:'test-only-strong-secret-with-32-characters',COOKIE_SAME_SITE:'lax',...overrides},encoding:'utf8'});}
test('produção força cookie Secure mesmo com configuração false',()=>{const result=config({COOKIE_SECURE:'false'});expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toEqual({secure:true,sameSite:'lax'});});
test('produção recusa segredo vazio em vez de usar fallback',()=>{expect(config({JWT_SECRET:''}).status).not.toBe(0);});
test('produção recusa segredo de desenvolvimento',()=>{expect(config({JWT_SECRET:'dev-only-insecure-secret-change-me'}).status).not.toBe(0);});
test('SameSite=None sem HTTPS é recusado',()=>{expect(config({NODE_ENV:'development',COOKIE_SECURE:'false',COOKIE_SAME_SITE:'none'}).status).not.toBe(0);});