#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  extractTranscript,
  loadIntegrityLock,
  loadOriginalLibrary,
  loadTemplateLibrary,
  synthesize,
  validateOriginalLibrary,
  validateIntegrityLock,
  validateOutput,
  validateTemplateLibrary,
} from './youtube-synthesizer.mjs';

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function parseArgs(args) {
  const out = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith('--')) out._.push(item);
    else if (['--allow-yt-dlp'].includes(item)) out[item.slice(2)] = true;
    else {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`missing_value:${item}`);
      out[item.slice(2)] = value;
      index += 1;
    }
  }
  return out;
}

function writeResult(result, outputFile) {
  const json = JSON.stringify(result, null, 2) + '\n';
  if (outputFile) fs.writeFileSync(path.resolve(outputFile), json, { flag: 'wx' });
  else process.stdout.write(json);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'extract') {
    if (!args.url) throw new Error('extract_requires_--url');
    let pastedContent = null;
    let pastedFormat = null;
    if (args.pasted) {
      const pastedPath = path.resolve(args.pasted);
      pastedContent = fs.readFileSync(pastedPath, 'utf8');
      pastedFormat = path.extname(pastedPath).slice(1) || 'txt';
    }
    const result = await extractTranscript({
      url: args.url,
      language: args.language ?? 'en',
      pastedContent,
      pastedFormat,
      allowYtDlp: Boolean(args['allow-yt-dlp']),
      ytDlpExecutable: args['yt-dlp-executable'] ?? 'yt-dlp',
    });
    writeResult(result, args.out);
    return;
  }
  if (command === 'synthesize') {
    if (!args.input) throw new Error('synthesize_requires_--input');
    const input = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
    const result = synthesize(input, {
      templateLibrary: args.templates ? loadTemplateLibrary(path.resolve(args.templates)) : loadTemplateLibrary(),
      originalLibrary: args.originals ? loadOriginalLibrary(path.resolve(args.originals)) : loadOriginalLibrary(),
      integrityLock: args.integrity ? loadIntegrityLock(path.resolve(args.integrity)) : loadIntegrityLock(),
    });
    writeResult(result, args.out);
    return;
  }
  if (command === 'audit-library') {
    const templates = args.templates ? loadTemplateLibrary(path.resolve(args.templates)) : loadTemplateLibrary();
    const originals = args.originals ? loadOriginalLibrary(path.resolve(args.originals)) : loadOriginalLibrary();
    const integrity = args.integrity ? loadIntegrityLock(path.resolve(args.integrity)) : loadIntegrityLock();
    const result = {
      templates: validateTemplateLibrary(templates, originals),
      originals: validateOriginalLibrary(originals, templates),
      integrity: validateIntegrityLock(templates, originals, integrity),
    };
    writeResult(result, args.out);
    if (!result.templates.ok || !result.originals.ok || !result.integrity.ok) process.exitCode = 1;
    return;
  }
  if (command === 'validate') {
    if (!args.input) throw new Error('validate_requires_--input');
    const result = validateOutput(JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8')));
    writeResult(result, args.out);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error('usage: extract|synthesize|audit-library|validate');
}

main().catch((error) => fail(JSON.stringify({ error: error.message, attempts: error.attempts ?? [] })));
