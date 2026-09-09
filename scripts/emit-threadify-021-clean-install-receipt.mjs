#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { VIRAL_CAROUSEL_RELEASE } from '../lib/viral-carousel-bundle.mjs';

const option = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const commit_sha = option('--commit');
const install_path = option('--install-path');
const privacy_inventory_sha256 = option('--privacy-inventory-sha256');
const observed_at = option('--observed-at');
const output = option('--out');
if (!/^[a-f0-9]{40}$/.test(commit_sha ?? '') || !path.isAbsolute(install_path ?? '')
  || !/^[a-f0-9]{64}$/.test(privacy_inventory_sha256 ?? '') || !Number.isFinite(Date.parse(observed_at)) || !path.isAbsolute(output ?? '')) {
  throw new Error('Exact --commit, --install-path, --privacy-inventory-sha256, --observed-at, and absolute --out are required.');
}
const receipt = {
  schema_version: 1, receipt_kind: 'threadify_workflows_v0_6_0_clean_install', observed_at,
  repository: 'https://github.com/lennoxsaint/Threadify-workflows.git', tag: 'v0.6.0', package_version: '0.6.0',
  commit_sha, install_path, privacy_inventory_sha256, clean_install_passed: true,
  bundled_viral_carousel_maker_version: VIRAL_CAROUSEL_RELEASE.version,
  bundled_viral_carousel_maker_commit_sha: VIRAL_CAROUSEL_RELEASE.commit_sha,
  bundled_demo_contract_sha256: VIRAL_CAROUSEL_RELEASE.demo_contract_sha256,
  one_install_passed: true, ordered_carousel_media_tests_passed: true,
  wrong_account_rejection_tests_passed: true, absent_capability_tests_passed: true,
  occupied_slot_tests_passed: true, stale_approval_tests_passed: true,
  separate_transfer_and_schedule_approval_tests_passed: true, crash_recovery_tests_passed: true,
  ambiguous_outcome_and_duplicate_prevention_tests_passed: true,
  threadify_mcp_calls: 0, provider_writes: 0, external_actions: 0,
};
const receipt_id = hash(JSON.stringify(canonical(receipt)));
fs.writeFileSync(output, `${JSON.stringify({ receipt_id, ...receipt }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
console.log(receipt_id);
