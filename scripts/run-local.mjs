import { fileURLToPath } from 'node:url';
import { initializeLocalDatabase } from './local-storage.mjs';
import { createServer } from 'vite';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
initializeLocalDatabase();
const server=await createServer({configFile:fileURLToPath(new URL('../vite.local.config.ts',import.meta.url))});
await server.listen();
server.printUrls();
