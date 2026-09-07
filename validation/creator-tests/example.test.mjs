import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../../examples/creator/local-day.mjs', import.meta.url));

test('public offline example prepares five review-only drafts for Day, Week and four-week Month', (t) => {
  for (const [horizon, days] of [['day', 1], ['week', 7], ['month', 28]]) {
    const result = spawnSync(process.execPath, [script, horizon], { encoding: 'utf8', cwd: os.tmpdir() });
    assert.equal(result.status, 0, result.stderr);
    const demo = JSON.parse(result.stdout);
    assert.equal(fs.realpathSync(path.dirname(demo.state_directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(demo.state_directory).startsWith('threadify-synthetic-demo-'));
    t.after(() => fs.rmSync(demo.state_directory, { recursive: true, force: true }));
    assert.equal(demo.horizon_days, days);
    assert.equal(demo.review.cards.length, 5);
    assert.equal(demo.continuation.action, 'resume_review');
    assert.equal(demo.status.approved, 0);
    assert.equal(demo.status.scheduled, 0);
    assert.equal(demo.status.published, 0);
    assert.equal(demo.status.provider_writes_performed, false);
    assert.ok(demo.review.cards.every((card) => card.content.draft_id === null && card.content.gaps.length > 0));
  }
});
