import { fileURLToPath } from 'node:url';
import { initializeLocalDatabase } from './local-storage.mjs';
import { createServer } from 'vite';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
initializeLocalDatabase();
const server=await createServer({configFile:fileURLToPath(new URL('../vite.local.config.ts',import.meta.url))});
await server.listen();
server.printUrls();
