import vinext from 'vinext';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { sites } from './scripts/vite/sites-vite-plugin';

// Node-only development entrypoint. Production keeps vite.config.ts and its
// Cloudflare bindings. The local binding implements the same SQL operations.
export default defineConfig({
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[
    {name:'lensy-local-storage',enforce:'pre',resolveId(id){
      if(id==='cloudflare:workers')return '\0lensy-local-bindings';
    },load(id){if(id==='\0lensy-local-bindings')return `export { bindings as env } from ${JSON.stringify(fileURLToPath(new URL('./scripts/local-storage.mjs',import.meta.url)))};`;}},
    vinext(),
    sites({mockAuth:true}),
  ],
});
