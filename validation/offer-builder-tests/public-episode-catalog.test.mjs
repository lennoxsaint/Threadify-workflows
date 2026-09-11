import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
test('episode catalog resolves its promised public entry points and preserves release boundaries',()=>{
 const file=path.join(root,'docs/proof-loops-workflows.md');
 const text=fs.readFileSync(file,'utf8');
 for(const name of ['greatest-hits-runway','qualified-buyer-research','create-my-day','create-my-week','create-my-month','content-brain-repair','viral-carousel-maker','offer-builder']) {
  assert.ok(text.includes(`../skills/threadify-${name}/SKILL.md`),`missing ${name}`);
  assert.ok(fs.existsSync(path.join(root,`skills/threadify-${name}/SKILL.md`)));
 }
 assert.ok(text.includes('episode number unconfirmed'));
 for(const doc of ['docs/proof-loops-workflows.md','docs/proof-loops-use-cases.md','skills/threadify-greatest-hits-runway/SKILL.md','skills/threadify-content-brain-repair/SKILL.md','skills/threadify-content-brain-repair/references/brain-sync-contract.md']) {
  for(const match of fs.readFileSync(path.join(root,doc),'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
   if(/^(https?:|#)/.test(match[1]))continue;
   assert.ok(fs.existsSync(path.resolve(root,path.dirname(doc),match[1].split('#')[0])),`${doc}: ${match[1]}`);
  }
 }
});
