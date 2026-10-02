import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const pinnedCommit = 'c06f69ec478fd7a631aae08f2aae138d787ec1ef';
const servingRepository = 'https://github.com/lennoxsaint/eddy-legacy.git';

test('Eddy submodule URL is the repository that serves the pinned commit', (t) => {
  const gitmodules = fs.readFileSync(path.join(root, '.gitmodules'), 'utf8');
  assert.match(gitmodules, /\[submodule "engines\/eddy"\]/);
  const urls = [...gitmodules.matchAll(/^\s*url\s*=\s*(\S+)\s*$/gm)].map((match) => match[1]);
  assert.deepEqual(urls, [servingRepository]);

  if (!fs.existsSync(path.join(root, '.git'))) {
    t.diagnostic('no Git metadata; gitlink check skipped');
    return;
  }
  const tree = spawnSync('git', ['ls-files', '--stage', 'engines/eddy'], { cwd: root, encoding: 'utf8' });
  assert.equal(tree.status, 0);
  const [mode, commit] = tree.stdout.trim().split(/\s+/);
  assert.equal(mode, '160000');
  // Changing the pin requires confirming which repository serves the new commit
  // and updating .gitmodules and this test together.
  assert.equal(commit, pinnedCommit);
});
