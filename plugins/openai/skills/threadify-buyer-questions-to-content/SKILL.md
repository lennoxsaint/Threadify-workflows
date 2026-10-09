---
name: threadify-buyer-questions-to-content
description: Turn supplied buyer questions into deidentified local content with honest single-or-repeated evidence labels. Use when the owner wants a draft or brief grounded in conversation evidence.
---

# Threadify Buyer Questions to Content

Read `references/threadify-001.md`, `references/workflow-manifest.json` and `references/workflow-readme.md` from this skill directory.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve the same path below that state root. In a source checkout, use `node bin/threadify-workflows.mjs conversations`.

Import minimal question evidence into the private conversation state. Run `questions-to-content`. Label one source `single`; label a pattern `repeated` only when distinct sources support the same underlying question. Duplicates and repeated messages from one person do not increase the count.

Remove names, handles, direct links and unnecessary identifying details before drafting. Say that deidentification is a risk reduction, not perfect anonymity. Do not turn a single question into a trend or treat questions and likes as sales evidence.

Show the evidence label, distinct source count, uncertainty, exact draft and private source map. Run `save-content` only after approval of that local candidate. Any provider save, schedule or publication needs its own exact display, approval and authoritative readback.

Connect only when the owner requests a useful hosted capability. If it is missing, return the local draft and manual next step without inventing a provider result.
