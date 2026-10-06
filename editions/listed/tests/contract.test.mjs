import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractTools, mask, snapshot } from '../contract/extract.mjs';

const sample = fs.readFileSync(fileURLToPath(new URL('./fixtures/contract/tools-sample.ts', import.meta.url)), 'utf8');
const committed = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../contract/tools.json', import.meta.url)), 'utf8'));

test('the extractor reads names, required parameters and hints from the registry shapes', () => {
  assert.deepEqual(extractTools(sample), [
    {
      name: 'read_thing',
      required: ['thing_id'],
      hints: { readOnlyHint: true, destructiveHint: false, idempotentHint: null, openWorldHint: false },
    },
    {
      name: 'write_thing',
      required: ['body', 'when'],
      hints: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
  ]);
});

test('masking keeps offsets and hides brackets inside strings and comments', () => {
  const source = "const a = 'x(y'; // z)\nconst b = \"q{\";";
  const masked = mask(source);
  assert.equal(masked.length, source.length);
  assert.doesNotMatch(masked, /x\(y|q\{|z\)/);
});

test('an unsupported registry shape stops the extractor instead of guessing', () => {
  assert.throws(() => extractTools(sample.replace("z.object({ ...ENVELOPE, thing_id", "makeSchema({ ...ENVELOPE, thing_id")), /Unsupported schema shape/);
  assert.throws(() => extractTools(sample.replace('...SHARED', '...MISSING')), /Unknown constant: MISSING/);
  assert.throws(() => extractTools(sample.replace("'read_thing'", "'write_thing'")), /Duplicate tool name/);
});

test('the snapshot output is deterministic and carries its source label', () => {
  const text = snapshot(sample, 'fixture@0');
  assert.equal(text, snapshot(sample, 'fixture@0'));
  assert.equal(JSON.parse(text).source, 'fixture@0');
});

test('the committed snapshot holds review_post and the schedule tools with their required parameters', () => {
  const byName = new Map(committed.tools.map((tool) => [tool.name, tool]));
  assert.match(committed.note, /#232/);
  assert.deepEqual(byName.get('review_post').required, ['scheduled_at']);
  assert.equal(byName.get('review_post').hints.readOnlyHint, true);
  assert.deepEqual(byName.get('schedule_post').required, ['scheduled_at']);
  assert.deepEqual(byName.get('get_schedule_status').required, ['scheduled_post_id']);
  for (const tool of committed.tools) {
    assert.deepEqual(Object.keys(tool.hints).sort(), ['destructiveHint', 'idempotentHint', 'openWorldHint', 'readOnlyHint']);
  }
});
