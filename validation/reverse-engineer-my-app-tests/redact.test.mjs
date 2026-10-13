import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMap, redactText, redactValue } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/feature-map.mjs';
import { reaMap } from './fixture.mjs';

// Secret-shaped strings are assembled at run time so no key-like literal sits in the repo.
const join = (...parts) => parts.join('');
const SAMPLES = {
  jwt: join('ey', 'J', 'hbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.', 'abcDEF123ghi'),
  stripe: join('sk', '_live_', 'a1B2c3D4e5F6g7H8i9J0'),
  github: join('gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4'),
  aws: join('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
  google: join('AI', 'za', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'),
  uuid: join('123e4567', '-e89b-', '12d3-a456-', '426614174000'),
  hex: 'a3f9c2e1b4d5a6f7e8c9b0a1d2e3f4a5',
  email: join('founder', '@', 'example.com'),
  longId: '17841400000000000',
};

test('redaction hides keys, login strings, ids and email addresses', () => {
  for (const [name, sample] of Object.entries(SAMPLES)) {
    const result = redactText(`found ${sample} in the bundle`);
    assert.ok(!result.text.includes(sample), `${name} must be hidden`);
    assert.match(result.text, /\[redacted (?:token|key|id|email|value)\]/, `${name} gets a label`);
    assert.ok(result.count >= 1);
  }
});

test('named values keep their name and lose their value', () => {
  const pairs = redactText(join('api_key', '=', 'q8w7e6r5t4y3', ' and ', 'Authorization: Bearer ', 'abcdefghijklmnop1234', ' and ', '/export?', 'token', '=', 'zz99yy88'));
  assert.match(pairs.text, /api_key=\[redacted value\]/);
  assert.match(pairs.text, /Bearer \[redacted value\]/);
  assert.match(pairs.text, /\?token=\[redacted value\]/);
  assert.ok(!/q8w7e6r5t4y3|abcdefghijklmnop1234|zz99yy88/.test(pairs.text));
});

test('plain feature words and small numbers survive redaction', () => {
  const text = 'one-tap export turns any board into a PDF; 12 shortcuts, 8 templates, 5,000 boards';
  assert.deepEqual(redactText(text), { text, count: 0 });
});

test('redactValue walks nested JSON, and the map step redacts before display', () => {
  const nested = redactValue({ a: [`mail ${SAMPLES.email}`], b: { c: SAMPLES.stripe }, n: 3 });
  assert.equal(nested.count, 2);
  assert.ok(!JSON.stringify(nested.value).includes(SAMPLES.email));
  const map = reaMap();
  map.features[0].evidence.detail = `route candidate /export?key=${SAMPLES.hex}`;
  map.unknowns.push(`owner account ${SAMPLES.email}`);
  const built = buildMap(map);
  assert.equal(built.status, 'ok');
  assert.ok(built.redactions >= 2);
  const shown = JSON.stringify(built.map) + built.table;
  assert.ok(!shown.includes(SAMPLES.hex) && !shown.includes(SAMPLES.email), 'nothing secret-shaped reaches the owner');
});
