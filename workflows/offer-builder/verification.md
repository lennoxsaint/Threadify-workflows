# Build verification

Checked 2026-09-11 against the isolated feature checkout based on origin/main 0c163e2.

- `npm ci --ignore-scripts`: six existing development packages installed locally; audit reported no vulnerabilities. No global plugin installation.
- `npm test`: passed repository validation (14 manifests), bundle parity, 30 installer tests, 107 creator tests and 8 offer-builder tests.
- First complete run exposed the shared onboarding requirement. Added the setup choice and resolvable guide; reran the complete suite successfully.
- Invoked the bundled renderer on its bundled fictional example. It produced a real HTML page and separate owner handoff, with `demo`, `interview_complete: false`, `save_state: not_attempted` and no active destination.
- Inspected the actual local page in the Codex in-app browser on desktop and a mobile viewport. Copy and demo label are readable; mobile scroll width equals viewport width; no console warnings or errors. The inactive next step cannot navigate.
- Reviewed the whole change, source/bundle parity, escaping, duplicate and approval guards. `git diff --check` passed. New source workflow, skill and tests contain no private source bodies or owner identifiers.
- Read the currently exposed create_offer, update_offer and list_offers input schemas. No Threadify provider tool was called; OAuth, live duplicate lookup, actual interview behavior and CTA Studio save/readback remain unverified. These tests prove local preparation logic, not autonomous agent compliance.

The existing checkout and its unrelated daily-posts-heartbeat edits were preserved. No merge, deployment, public post, offer save or existing plugin replacement occurred.
