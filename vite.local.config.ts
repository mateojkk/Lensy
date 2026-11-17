import vinext from 'vinext';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sites } from './scripts/vite/sites-vite-plugin';

// Node-only development entrypoint. Production keeps vite.config.ts and its
// Cloudflare bindings. The local binding implements the same SQL operations.
export default defineConfig({
  cacheDir:process.env.LENSY_DATA_DIRECTORY?path.resolve('node_modules','.vite-lensy-'+path.basename(process.env.LENSY_DATA_DIRECTORY)):undefined,
  server:{host:'127.0.0.1',port:Number(process.env.LENSY_PORT||5173),strictPort:true},
  plugins:[
    {name:'lensy-local-storage',enforce:'pre',resolveId(id){
      if(id==='cloudflare:workers')return '\0lensy-local-bindings';
    },load(id){if(id==='\0lensy-local-bindings')return `export { bindings as env } from ${JSON.stringify(fileURLToPath(new URL('./scripts/local-storage.mjs',import.meta.url)))};`;}},
    vinext(),
    sites({mockAuth:true}),
  ],
});
