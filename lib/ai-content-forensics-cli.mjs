#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runForensics } from './ai-content-forensics.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name}_requires_value`);
  return value;
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new Error('input_exceeds_5mb');
    chunks.push(chunk);
  }
  if (!chunks.length) throw new Error('input_json_required_on_stdin');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

try {
  const outputDirectory = argument('--output-dir');
  const visuals = process.argv.includes('--visuals');
  if (visuals && !outputDirectory) throw new Error('--visuals_requires_--output-dir');
  const input = await readStdin();
  const result = runForensics(input, {
    visualDirectory: visuals ? path.join(path.resolve(outputDirectory), 'visuals') : null,
  });
  if (outputDirectory) {
    const directory = path.resolve(outputDirectory);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(directory, 'forensics-output.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`AI Content Forensics failed: ${error.message}\n`);
  process.exitCode = 1;
}

