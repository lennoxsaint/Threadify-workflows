---
name: threadify-content-brain-repair
description: "Diagnoses one writing problem in the person's Threadify Brain, proposes the smallest memory fix, saves it only after they approve the exact text, and compares the same prompt before and after. Use when the person asks to fix or repair their Threadify Brain because drafts get their facts, voice or audience wrong."
---

# Threadify Content Brain Repair

Changing the Brain needs a connected Threadify account. Without one, prepare a proposed repair ledger and a local comparison. Honor an existing connection choice. Offer the connection only when it would help; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor the existing choice; a connection is not approval to change memories.

Use: “Audit my approved creator context and propose one missing Brain repair. Show the exact changes before saving, then compare the same prompt before and after.” Model choice stays with the user; this workflow does not require a named model.

1. Establish the intended account, approved source boundaries, the writing problem and one fixed evaluation prompt. Do not crawl personal accounts or import a whole private knowledge base because access exists. Ask which writing samples, facts and audience notes are safe to use. Private sources can remain local; only individually approved public-safe statements may become Threadify memories.
2. Call `get_connection_defaults` first. Verify the intended owned account and scopes. Use `get_brain_overview` and a narrow `query_brain` request, with a `prompt` about the problem, to inspect the relevant current context. Missing context is a gap, not permission to invent. Preserve the current state as a private before snapshot; never clear the Brain for a demonstration.
3. Establish a baseline from the same prompt, with the same chosen drafting provider/model and available settings. Explain any quota or draft-creation effect before a provider generation. For Threadify drafting, call `generate_content` with the fixed prompt as `inputText`. If the user chooses local drafting, use it consistently for both runs. Label unavailable provider/model controls and do not claim a controlled comparison if they differ materially. Keep generated drafts distinct from published posts.
4. Propose the smallest useful repair: one factual correction, audience clarification, voice rule or relevant example. Split it into atomic records using the bundled [Brain Sync contract](references/brain-sync-contract.md). Show exact text, source, category and review/expiry date where appropriate. Missing proof and unknown metrics remain unknown; do not import old owner facts from examples.
5. Request explicit approval for the exact memory changes and target account. Only then call `remember` with the approved `fact`, or `correct_memory` with its `before` and `after`. Do not overwrite unrelated memories or tombstone anything without an explicit request naming it. Follow tool schemas, preserve returned IDs and use idempotency if supported. A failure or ambiguous result stays unverified until reconciled; do not blindly repeat writes.
6. Read back each changed item with `query_brain` or the current appropriate retrieval tool. Check exact text/account and note whether a sync is pending. Saved source material, learned Brain context and successful retrieval are different states. Failed retention is not a completed repair.
7. Run the fixed prompt again with the same drafting method. Compare factual accuracy, voice fit and audience relevance against the approved sources. Quote only the small differences needed for review. One better output is evidence about this test, not proof the model improved permanently or all future outputs will be accurate. An unchanged or worse result is valid; report it and propose the next small repair without saving it automatically.

## Local fallback and receipt

If tools, scopes, approved sources or readback are unavailable, produce a proposed repair ledger and a clearly labelled local comparison using only approved inputs. Record provider updates as not attempted or unverified, not successful. Return before/after artifacts, fixed prompt, drafting method, approved records, actual writes/readback, differences, uncertainty and next step. No post scheduling or publishing belongs to this skill.
