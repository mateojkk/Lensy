import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),output=path.join(root,'.sites-runtime','test-build');
const sources=['lib/money.ts','lib/lensy.ts','lib/evidence.ts','lib/verification.ts','lib/server.ts','lib/sponsored.ts','app/api/sponsored/route.ts','app/api/config/route.ts','app/api/quote/route.ts','app/api/verify/route.ts','app/api/checks/route.ts','app/api/compare/route.ts','app/api/checks/[id]/route.ts','app/api/shared/[token]/route.ts','app/api/stats/route.ts','app/api/checks/export/route.ts'];
for(const file of sources){
 const text=await fs.readFile(file,'utf8');
 let code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 code=code.replace(/(from\s*['"])(\.[^'"]+)(['"])/g,(_,start,name,end)=>start+name+(/\.[a-z]+$/.test(name)?'':'.js')+end);
 code=code.replace(/['"]cloudflare:workers['"]/g,"'../test-bindings.js'");
 const target=path.join(output,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,code);
}
await fs.writeFile(path.join(output,'test-bindings.js'),'export const env = globalThis.__lensyTestEnvironment;');
const result=spawnSync(process.execPath,['--test','tests/core.test.mjs'],{stdio:'inherit',env:{...process.env,LENSY_TEST_BUILD:output},windowsHide:true});
process.exitCode=result.status??1;
