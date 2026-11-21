import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=process.env.LENSY_DATA_DIRECTORY?path.resolve(process.env.LENSY_DATA_DIRECTORY):path.join(root,'.sites-runtime','local');
mkdirSync(directory,{recursive:true});
const database=new DatabaseSync(path.join(directory,'lensy.sqlite'));
database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');

// Called by the local launcher before any requests are accepted.
export function initializeLocalDatabase(){
  database.exec('CREATE TABLE IF NOT EXISTS _lensy_local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort()){
    if(database.prepare('SELECT name FROM _lensy_local_migrations WHERE name = ?').get(name))continue;
    database.exec('BEGIN');
    try{database.exec(readFileSync(path.join(root,'drizzle',name),'utf8'));database.prepare('INSERT INTO _lensy_local_migrations (name) VALUES (?)').run(name);database.exec('COMMIT');}
    catch(error){database.exec('ROLLBACK');throw error;}
  }
}
function statement(sql,values=[]){
  return {
    bind(...args){return statement(sql,args);},
    async first(column){const row=database.prepare(sql).get(...values);return row?(column?row[column]:{...row}):null;},
    async all(){return {success:true,results:database.prepare(sql).all(...values).map(row=>({...row}))};},
    async run(){const result=database.prepare(sql).run(...values);return {success:true,results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};},
  };
}
export const bindings={
 get TELEGRAPH_API_KEY(){return process.env.TELEGRAPH_API_KEY;},
 get LENSY_SPONSOR_ENABLED(){return process.env.LENSY_SPONSOR_ENABLED;},
 get LENSY_SPONSOR_MAX_CALL_USDC(){return process.env.LENSY_SPONSOR_MAX_CALL_USDC;},
 get LENSY_SPONSOR_DAILY_USDC(){return process.env.LENSY_SPONSOR_DAILY_USDC;},
 get LENSY_SPONSOR_CHECKS_PER_USER(){return process.env.LENSY_SPONSOR_CHECKS_PER_USER;},

  DB:{prepare:statement},
  BUCKET:{async put(id,value,options={}){
    if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid media key.');
    await mkdir(path.join(directory,'media'),{recursive:true});
    await writeFile(path.join(directory,'media',id),new Uint8Array(value));
    await writeFile(path.join(directory,'media',id+'.json'),JSON.stringify(options.httpMetadata||{}));
  },async delete(id){
    if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid media key.');
    for(const suffix of ['', '.json'])try{await unlink(path.join(directory,'media',id+suffix));}catch(error){if(error.code!=='ENOENT')throw error;}
  },async get(id){
    if(!/^[a-f0-9-]{36}$/.test(id))return null;
    try{const body=await readFile(path.join(directory,'media',id));let httpMetadata={contentType:'application/octet-stream'};try{httpMetadata=JSON.parse(await readFile(path.join(directory,'media',id+'.json'),'utf8'));}catch{}return {body:new Uint8Array(body),httpMetadata};}catch(error){if(error.code==='ENOENT')return null;throw error;}
  }},
};
