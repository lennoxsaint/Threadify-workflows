import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  createConversationWorkspace,
  importConversationRecords,
  prepareAction,
  recordCommitment,
  saveQuestionContent,
} from '../../lib/conversations/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fixture = JSON.parse(await readFile(path.join(root, 'examples/conversations/walkthrough.fixture.json'), 'utf8'));
const recordsSchema = JSON.parse(await readFile(path.join(root, 'schemas/conversation-records.v1.json'), 'utf8'));
const lifecycleSchema = JSON.parse(await readFile(path.join(root, 'schemas/conversation-lifecycle.v1.json'), 'utf8'));

test('conversation schemas validate the concrete fixture and stored workspace', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv); ajv.addSchema(recordsSchema);
  const validateRecord = ajv.getSchema(recordsSchema.$id);
  for (const record of fixture.evidence_import.records) {
    assert.equal(validateRecord(record), true, JSON.stringify(validateRecord.errors));
  }
  let workspace = importConversationRecords(createConversationWorkspace(fixture.init), fixture.evidence_import);
  workspace = prepareAction(workspace, fixture.action);
  workspace = recordCommitment(workspace, fixture.commitments[0]);
  workspace = saveQuestionContent(workspace, fixture.content);
  const validateLifecycle = ajv.compile(lifecycleSchema);
  assert.equal(validateLifecycle(workspace), true, JSON.stringify(validateLifecycle.errors));
});

test('schemas reject inferred permission, full-thread excerpts and ambiguous outcomes', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
  const validate = ajv.compile(recordsSchema);
  const permission = fixture.evidence_import.records.find((entry) => entry.id === 'permission-one');
  assert.equal(validate({ ...permission, explicit: false }), false);
  const candidate = fixture.evidence_import.records.find((entry) => entry.id === 'candidate-one');
  assert.equal(validate({ ...candidate, source: { ...candidate.source, relevant_excerpt: 'x'.repeat(501) } }), false);
  assert.equal(validate({ ...fixture.outcome, status: 'maybe' }), false);
});
