# Jev creator-workflow experiment - 22 September 2026

## Outcome: no qualifying speed win

Do not advertise this branch as a proven faster workflow or a filming-ready giveaway. Reply First failed its held-out quality and speed gates. Draft Readiness was useful enough to pass the initial quality comparison, but did not deliver the required whole-workflow speed improvement. No new skill has been publicly released.

The target was fixed before testing: 100 real items, median whole-workflow time below 30 seconds and at least 3 times faster than a qualified structured LLM, category accuracy at least 90%, critical-signal recall at least 95%, and no more than a two-point accuracy deficit. One warm-up and five interleaved uncached trials per route were required. Missing correction time cannot count as zero. Failed trials cannot disappear from the comparison.

## Results

| Candidate | Observed result | Decision |
| --- | --- | --- |
| Reply First, after one repair | Four completed measured trials per route; one source-bridge timeout per route. Jev category accuracy 91-92%, but missed both held-out direct questions in every completed trial. GPT-4.1 also failed recall. Completed-only, uncorrected median: Jev 35.62s, GPT-4.1 41.16s. | Failed. A 1.16x descriptive ratio is not a qualified speed comparison. |
| Buyer Questions to Content | The frozen 100-comment cohort had zero offer-relevant signals in its independent reference labels. | Rejected at the useful-input gate; no model speed test. This does not establish that the workflow is unsuitable for other creators. |
| Draft Readiness, after one repair | Five completed measured Jev trials; four completed GPT-4.1 trials and one 90.00s source-bridge failure. Completed-only, uncorrected median: Jev 14.02s, GPT-4.1 17.68s. | No 3x win. The descriptive ratio is 1.26x and excludes missing correction work and the failed baseline trial. |

Draft Readiness category accuracy was 90-92% for Jev and 91% for completed GPT-4.1 trials. Both found all 61 unresolved-template drafts in those trials. The five Jev attempts took 13.62-15.52 seconds before correction. The baseline warm-up also failed source retrieval; it is retained separately from the five measured attempts.

Draft Readiness classification-and-local-persistence medians were 3.77s for Jev and 6.04s for completed GPT-4.1 trials. Retrieval medians were 10.55s and 10.92s respectively. The earlier single qualification observation was 3.33s versus 14.17s for classification; that apparent 4.25x ratio did not survive repeated whole-workflow comparison. None of these classification timings is pure model inference time.

Measured Draft Readiness Jev calls: 67 HTTP attempts, including seven retried 503 responses; all five trials ultimately covered all 100 items. The 60 successful calls reported $0 during the temporary promotion. Seven failed attempts had unknown cost and kept their budget reservations. The eight successful measured baseline requests reported $0.073912 in total; this is not total experiment spend. Both routes' source failures occurred in the host bridge before classification, not proven inside Jev or GPT-4.1.

## Method and limits

[Body-free trial measurements](MEASUREMENTS.json) include every warm-up and measured attempt, null fields for unavailable evidence, and the SHA-256 of the private source receipt. They allow the displayed descriptive medians to be recalculated without disclosing drafts. They are not enough to reproduce model predictions without the private inputs, and do not turn this failed experiment into a public benchmark pass.

References were labelled by two independent AI reviewers before provider predictions, with lead adjudication. That is not owner acceptance. Public fixtures are explicitly synthetic. Real comments, drafts, private identifiers, provider payloads and credentials are not distributed.

Reply First used fixed comment category plus independent offer relevance, with parent-post context. Draft Readiness used the first applicable fixed blocker plus an independent unresolved-placeholder check across every draft part. Its 100 drafts were frozen in provider order before predictions and freshly re-read inside each trial. Changed IDs, bodies, timestamps or status failed the trial. A browser observer verified all 100 rendered cards. No draft or comment was edited or sent.

Draft Readiness used Jev batches of at most ten drafts and 24KB, concurrency four; GPT-4.1 used batches up to 50 drafts and 45KB, concurrency two. Those are disclosed application settings, not universal provider limits. The draft experiment used a private harness, not this public Reply First skill. It is not proof of packaged execution or fresh native skill discovery in Codex and Claude Code. No second semantic repair or replacement dataset was used to chase a win.

The fallback repair attached each complete draft directly to its typed question and clarified template, attribution and personal-experience rules for both routes. It improved coverage and quality on this cohort, but is not proof that every integration issue is fixed. Errors still need review, and correction time remains unmeasured.

## Why the original backlog run was slow

The original integration serialized requests inside its MCP server, resolved credentials per evaluation, repeatedly attempted an unsupported privacy route, and lost some in-memory results after interruption. Retrying and agent orchestration added work. Upstream size errors and 503/504 responses also occurred; their root cause was not isolated.

Successful HTTP latency excluded those costs. It was wrong to call it pure model latency or assert that Jev alone was the bottleneck. Twenty drafts per batch was a workflow setting. Multiplying within-batch choice probabilities by batch size did not create a valid global ranking, and a final shortlist probability was not a post-success forecast.

## Useful repairs retained in this branch

- One programmatic bounded runner; explicit privacy selection; one resolved credential per invocation.
- Strict response/coverage validation, raw-response persistence, bounded transient retries and terminal-error stops.
- Content/context/offer/model-bound incremental cache; recovery from a persisted response after interruption; uncached trials remain uncached.
- Budget-lock recovery only for a verified dead local owner, preserving unknown charges; no ambient OIDC credential fallback.
- Complete read-only review queue and honest source, failure and timing receipts.

These are engineering improvements, not evidence that the speed goal passed. Both-host native installation and live execution, owner review, release approval and public release remain unproved or outstanding. Keep the existing footage; add a measured correction rather than film an unearned redemption.
