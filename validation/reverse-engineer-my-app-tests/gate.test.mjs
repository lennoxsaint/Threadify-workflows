import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { OWNERSHIP_QUESTION, ownershipGate } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/feature-map.mjs';

const script = fileURLToPath(new URL('../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/feature-map.mjs', import.meta.url));

test('the ownership gate asks the one question and passes only on "yes"', () => {
  assert.match(OWNERSHIP_QUESTION, /^Do you own this app, or have written permission to analyse it\?/);
  assert.equal(ownershipGate('yes').status, 'owner_confirmed');
  assert.equal(ownershipGate(' Yes ').status, 'owner_confirmed');
  assert.match(ownershipGate('yes').rule, /software you own or are authorized to examine/);
});

test('the ownership gate stops on "no" and on anything that is not "yes"', () => {
  for (const answer of ['no', 'No', 'not really', "it's a competitor's app", 'probably', 'my client owns it', 'yes, my friend owns it', 'y', '', undefined, null]) {
    const result = ownershipGate(answer);
    assert.equal(result.status, 'stopped', `"${answer}" must stop`);
    assert.match(result.message, /Nothing was scanned\./);
  }
});

test('the gate command exits 1 on "no" so the agent cannot continue by accident', () => {
  const refused = spawnSync(process.execPath, [script, 'gate'], { input: JSON.stringify({ answer: 'no' }), encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.equal(JSON.parse(refused.stdout).status, 'stopped');
  const confirmed = spawnSync(process.execPath, [script, 'gate'], { input: JSON.stringify({ answer: 'yes' }), encoding: 'utf8' });
  assert.equal(confirmed.status, 0);
  assert.equal(path.basename(script), 'feature-map.mjs');
});
