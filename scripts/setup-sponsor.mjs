import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
if(!process.stdin.isTTY)throw new Error('Run this command in an interactive terminal. The API key is hidden.');
console.log('Fund your Lensy account and create a key at https://anjoman.ai/dashboard/api-keys');
process.stdout.write('Telegraph API key (hidden): ');
const key=await new Promise((resolve,reject)=>{
 let value='';process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();
 const close=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
 function onData(text){for(const c of text){if(c==='\u0003'){close();reject(new Error('Cancelled.'));return;}if(c==='\r'||c==='\n'){close();resolve(value.trim());return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;}}
 process.stdin.on('data',onData);
});
if(!/^(anjoman_|tgk_)[A-Za-z0-9_-]+$/.test(key))throw new Error('The key format is invalid. Nothing was saved.');
let balance;
try{const response=await fetch('https://backend.telegraphprotocol.com/engine/escrow/balance',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();balance=await response.json();}catch{throw new Error('Could not validate the key. Nothing was saved.');}
if(typeof balance.effectiveBalance!=='string'||typeof balance.agentDebt!=='string')throw new Error('Unreadable balance. Nothing was saved.');
let text='';try{text=await readFile('.env.local','utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const line='TELEGRAPH_API_KEY='+key;
text=/^TELEGRAPH_API_KEY=.*$/m.test(text)?text.replace(/^TELEGRAPH_API_KEY=.*$/m,line):text.trimEnd()+'\n'+line+'\n';
await writeFile('.env.local',text,{mode:0o600});
console.log('Key validated and saved to ignored .env.local. No paid request was made.');
console.log(Number(balance.effectiveBalance)>0&&Number(balance.agentDebt)===0?'Account funded. Restart npm.cmd run local to activate Lensy-funded checks.':'Top up the account on Anjoman, then restart npm.cmd run local.');
console.log('For the hosted Site, set TELEGRAPH_API_KEY as a secret runtime environment variable too.');
