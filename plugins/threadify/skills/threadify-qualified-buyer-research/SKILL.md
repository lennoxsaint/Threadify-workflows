---
name: threadify-qualified-buyer-research
description: Find current buyer-language posts, reject misleading or off-offer candidates, stage a useful public reply without sending, and learn only from qualified outcomes. Use when a user wants offer-aligned keyword research or buyer qualification on Threads.
metadata:
  version: "0.4.0"
  rules_version: "0.4.0"
---

# Threadify Qualified Buyer Research

## Start here

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Find one person whose current situation and desired outcome genuinely map to the user's offer, then stage one useful offer-free public reply. Never click Send.

## Start every run

1. Resolve all `references/` paths against the directory containing this `SKILL.md`, then run `node <skill-directory>/references/update-on-use.mjs`.
2. Read the JSON result.
   - `rules_reloaded`, `up_to_date`, or `auto_update_disabled`: continue.
   - `updated_restart_required`: stop and ask the user to start a new agent session.
   - `update_failed_using_cached_version`: continue with the installed last-known-good rules and report the fallback.
3. Read `references/release-metadata.json`, `references/public-rules.v1.json`, `references/workflow-manifest.json`, and `references/workflow-readme.md`.
4. Record the active skill and rules versions in the run receipt.

## Research and qualify

1. Verify the intended Threadify account and visible browser account before composer work.
2. Use only approved audience, offer, proof, voice, and suppression context. Never place private source material in public examples or receipts.
3. Build and version an Offer Context Map: observable situation, current problem, desired outcome, failed approaches, exclusions, and later-stage commercial criteria. If missing, stop with `missing_offer_context`.
4. Ask for three to five approved voice samples. With fewer than three, use a concise plain-human default and record `voice_confidence: low`. Never imitate another person or fabricate experience.
5. Search narrow buyer language in this order: problem, failed attempt, stakes, desired outcome, workaround or objection. Search situation and problem language, not broad identity labels.
6. Inspect five results per query. One current, first-person, offer-mapped problem permits full inspection. Zero means rewrite one query element. Stop after one qualified candidate, ten rewrites, or fifty sampled results.
7. Inspect the full post, visible replies, profile, and relevant recent content. Run hard gates before scores.
8. Require situation fit, a current authored first-person problem, at least one failed attempt/stake/help request, desired-outcome fit, safe context, and one distinct useful contribution.
9. Reject stale, duplicate, suppressed, contradictory, advice, teacher, recycled-hook, seller-funnel, and pitch-only false positives. A person is not rejected merely because they sell something.
10. Route genuine off-offer pain to adjacent research; never add it to the active Buyer Language Bank.
11. Scores rank eligible candidates and control later stages. They cannot qualify or disqualify a public reply. Calls and offers also require permission and commercial evidence.

## Stage the reply

- Clear context: acknowledge the exact signal, optionally use approved truthful experience, explain one plain-language mechanism, give one practical next move, and state the honest tradeoff. Do not force a question.
- Missing evidence: use A-C-A diagnostically and ask exactly one useful question that resolves the gap.
- The first public reply contains no offer, link, DM ask, call ask, or paid ask.
- If staging was requested, type the exact text into the verified composer and stop before Send.
- Show the account, source, context versions, evidence, evaluation, exact text, destination, and action at the approval gate.

## Learn safely

- Preserve staged and owner-sent variants.
- Classify owner edits across truth, relevance, mechanism, action, tradeoff, and voice. Owner edits change message policy only.
- Qualified progression within seventy-two hours means new pain, attempt, stakes, desired outcome, permission, resource acceptance, call, offer, or payment evidence. Likes and generic thanks do not count.
- Fewer than ten comparable outcomes means `no_change_insufficient_evidence`.
- Ten outcomes may create a redacted proposal. Twenty outcomes across two passing batches may mark it `promotion_recommended`.
- Safety or correctness defects may create an immediate proposal only with a deterministic synthetic reproduction and passing privacy check.
- Hard gates never self-modify. Public rules change only through a tested stable release approved by Lennox.

Return a receipt even when the honest result is `no_qualified_candidate` or `no_change_insufficient_evidence`.
