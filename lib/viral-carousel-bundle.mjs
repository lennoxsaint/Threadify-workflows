import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const VIRAL_CAROUSEL_RELEASE = Object.freeze({
  version: '0.2.0',
  tag: 'v0.2.0',
  commit_sha: '7a2cf34ee51404311a1a287e2f04c2c8e7523ce3',
  archive_url: 'https://github.com/lennoxsaint/viral-carousel-maker/archive/7a2cf34ee51404311a1a287e2f04c2c8e7523ce3.tar.gz',
  archive_sha256: '6f7883ccbf610b90addd1dc2ab5229931aecfb4a2caedb869b2a9fd4d588c05a',
  bundled_content_sha256: 'ffa234d4f15c8be4fecfb372c99db0b18368af809db7d7fe7339855bcc3dec88',
  demo_contract_sha256: 'f489877952820eec3da0951771f6bd75c286dc9d0969b0cefe1eceda00a6a8b9',
  qa_contract_sha256: 'bf8f54151ea5a6611c7e46b6a387376213ca0787407403b374379163d37f6366',
});

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function command(name, args) {
  const result = spawnSync(name, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${name} failed while resolving pinned Viral Carousel Maker v0.2.0: ${result.stderr}`);
}

function resolveSource() {
  const explicit = process.env.THREADIFY_VIRAL_CAROUSEL_SOURCE;
  if (explicit) return path.resolve(explicit);
  const cache = path.join(os.tmpdir(), `threadify-viral-carousel-maker-${VIRAL_CAROUSEL_RELEASE.bundled_content_sha256}`);
  const source = path.join(cache, 'source');
  if (fs.existsSync(source)) return source;
  fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
  const archive = path.join(cache, 'source.tar.gz');
  if (!fs.existsSync(archive)) {
    const temporary = path.join(cache, `source-${process.pid}-${crypto.randomUUID()}.tar.gz`);
    command('curl', ['-L', '--fail', '--silent', '--show-error', VIRAL_CAROUSEL_RELEASE.archive_url, '-o', temporary]);
    try { fs.renameSync(temporary, archive); }
    catch (error) { fs.rmSync(temporary, { force: true }); if (error.code !== 'EEXIST') throw error; }
  }
  const extraction = fs.mkdtempSync(path.join(cache, `extract-${process.pid}-`));
  try {
    command('tar', ['-xzf', archive, '-C', extraction]);
    const sourceName = fs.readdirSync(extraction).find((name) => name.startsWith('viral-carousel-maker-') && fs.statSync(path.join(extraction, name)).isDirectory());
    if (!sourceName) throw new Error('Pinned Viral Carousel Maker archive has no source root.');
    try { fs.renameSync(path.join(extraction, sourceName), source); }
    catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || !fs.existsSync(source)) throw error; }
  } finally { fs.rmSync(extraction, { recursive: true, force: true }); }
  return source;
}

export function collectViralCarouselBundle() {
  const source = resolveSource();
  const includedRoots = ['src/viral_carousel_maker', 'skills/source/viral-carousel-maker', 'examples/specs'];
  const includedFiles = ['README.md', 'LICENSE', 'pyproject.toml', 'uv.lock'];
  const files = [];
  const visit = (relative) => {
    const full = path.join(source, relative);
    const info = fs.lstatSync(full);
    if (info.isSymbolicLink()) throw new Error(`Refusing bundled carousel symlink: ${relative}`);
    if (info.isFile()) { files.push(relative); return; }
    for (const name of fs.readdirSync(full).sort()) visit(`${relative}/${name}`);
  };
  includedRoots.forEach(visit); includedFiles.forEach(visit);
  const selected = files.sort().map((relative) => ({ relative, content: fs.readFileSync(path.join(source, relative)) }));
  const byName = new Map(selected.map((item) => [item.relative, item.content]));
  const demo = byName.get('src/viral_carousel_maker/contracts/controlled-mutation-demo-contract.json');
  const qa = byName.get('src/viral_carousel_maker/contracts/controlled-mutation-qa-contract.json');
  if (sha256(demo) !== VIRAL_CAROUSEL_RELEASE.demo_contract_sha256 || sha256(qa) !== VIRAL_CAROUSEL_RELEASE.qa_contract_sha256) {
    throw new Error('Pinned controlled-mutation contract byte parity failed.');
  }
  const contentManifest = selected.map(({ relative, content }) => ({ path: relative, sha256: sha256(content) }));
  if (sha256(Buffer.from(JSON.stringify(contentManifest))) !== VIRAL_CAROUSEL_RELEASE.bundled_content_sha256) {
    throw new Error('Pinned Viral Carousel Maker runtime, skill, template, or contract parity failed.');
  }
  if (selected.some(({ relative }) => /(?:^|\/)lennox[^/]*reference/i.test(relative))) throw new Error('Lennox reference files must not be bundled.');
  return selected;
}
