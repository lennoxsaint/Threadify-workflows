# Inbound Replies verification

Implementation rechecked on 2026-09-13. This is local implementation evidence; public release and live-send status require separate readback.

- Repository validation: 22 workflows and 463 public files.
- All 30 Inbound Node tests and the full repository suite pass. They cover the state interface, isolated installed-skill execution, paths with spaces, exact text/revision handling, grouped identity, coverage, account isolation, deferral and suppression, prepared delivery attempts, partial failures, feedback and loopback protection.
- The 2026-09-10 browser exercise covered 120 synthetic comments, five/all mode, grouped post context across rounds, autosave/approve/reload, desktop 1280×1000 and mobile 390×844, no horizontal overflow, keyboard focus and no browser console errors. It was not rerun on 2026-09-13 because Playwright was not installed on the release host.
- Untrusted comment markup was rendered as text, not executed.
- Current Threadify connection and one live comment read succeeded. No live reply or live feedback was sent as part of verification. Provider send behavior remains unverified by this implementation run.

Run `npm test` for dependency-free checks. For the optional browser check, provide a local Playwright installation through `PLAYWRIGHT_MODULE` (its index.mjs path), set `INBOUND_QA_OUTPUT` to a private artifact directory, then run `node tools/inbound/ui-check.mjs`. The UI check uses synthetic data and temporary state only.

The public package has no private CRM dependency. A separate local adapter can bridge verified results into the owner's CRM; its integration is not a claim about other users' installations.
