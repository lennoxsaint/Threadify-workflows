import { creatorMain } from './engine/cli.mjs';
creatorMain(process.argv.slice(2)).catch((error) => { process.stderr.write(JSON.stringify({ status: 'failed', error: error.message }) + '\n'); process.exitCode = 1; });
