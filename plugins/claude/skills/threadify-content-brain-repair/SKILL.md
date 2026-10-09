---
name: threadify-content-brain-repair
description: Audit an approved creator context packet, propose a small Threadify Brain repair, and compare the same prompt before and after verified approved changes. The episode 20 workflow.
---

# Threadify Content Brain Repair

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md). Honor the existing choice; a connection is not approval to change memories.

Use: “Audit my approved creator context and propose one missing Brain repair. Show the exact changes before saving, then compare the same prompt before and after.” Model choice stays with the user; this workflow does not require a named model.

1. Establish the intended account, approved source boundaries, the writing problem and one fixed evaluation prompt. Do not crawl personal accounts or import a whole private knowledge base because access exists. Ask which writing samples, facts and audience notes are safe to use. Private sources can remain local; only individually approved public-safe statements may become Threadify memories.
2. Call get_connection_defaults first. Verify the intended owned account and scopes. Use get_brain_overview and a narrow query_brain request to inspect the relevant current context. Missing context is a gap, not permission to invent. Preserve the current state as a private before snapshot; never clear the Brain for a demonstration.
3. Establish a baseline from the same prompt, with the same chosen drafting provider/model and available settings. Explain any quota or draft-creation effect before a provider generation. If the user chooses local drafting, use it consistently for both runs. Label unavailable provider/model controls and do not claim a controlled comparison if they differ materially. Keep generated drafts distinct from published posts.
4. Propose the smallest useful repair: one factual correction, audience clarification, voice rule or relevant example. Split it into atomic records using the bundled Brain Sync contract in references/brain-sync-contract.md. Show exact text, source, category and review/expiry date where appropriate. Missing proof and unknown metrics remain unknown; do not import historical owner facts from the episode.
5. Request explicit approval for the exact memory changes and target account. Only then call the current supported remember/correct_memory operation. Do not overwrite unrelated memories or tombstone anything without an explicit request naming it. Follow tool schemas, preserve returned IDs and use idempotency if supported. A failure or ambiguous result stays unverified until reconciled; do not blindly repeat writes.
6. Read back each changed item with query_brain or the current appropriate retrieval tool. Check exact text/account and note whether a sync is pending. Saved source material, learned Brain context and successful retrieval are different states. Failed retention is not a completed repair.
7. Run the fixed prompt again with the same drafting method. Compare factual accuracy, voice fit and audience relevance against the approved sources. Quote only the small differences needed for review. One better output is evidence about this test, not proof the model improved permanently or all future outputs will be accurate. An unchanged or worse result is valid; report it and propose the next small repair without saving it automatically.

## Local fallback and receipt

If tools, scopes, approved sources or readback are unavailable, produce a proposed repair ledger and a clearly labelled local comparison using only approved inputs. Record provider updates as not attempted or unverified, not successful. Return before/after artifacts, fixed prompt, drafting method, approved records, actual writes/readback, differences, uncertainty and next step. No post scheduling or publishing belongs to this skill.
