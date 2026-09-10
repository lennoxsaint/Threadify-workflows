# Inbound Replies verification

Implementation checked on 2026-09-10. This is a local implementation receipt, not public release or live-send proof.

- Repository manifest/redaction validation: eight workflows.
- All 30 Node tests pass. They cover the state interface, fresh-directory CLI execution, exact text/revision handling, grouped identity, coverage, account isolation, deferral and suppression, send attempts, partial failures, feedback and loopback protection.
- Browser exercise: 120 synthetic comments, five/all mode, grouped post context across rounds, autosave/approve/reload, desktop 1280×1000 and mobile 390×844, no horizontal overflow, keyboard focus and no browser console errors.
- Untrusted comment markup was rendered as text, not executed.
- Current Threadify connection and one live comment read succeeded. No live reply or live feedback was sent as part of verification. Provider send behavior remains unverified by this implementation run.

Run `npm test` for dependency-free checks. For the optional browser check, provide a local Playwright installation through `PLAYWRIGHT_MODULE` (its index.mjs path), set `INBOUND_QA_OUTPUT` to a private artifact directory, then run `node tools/inbound/ui-check.mjs`. The UI check uses synthetic data and temporary state only.

The public package has no private CRM dependency. A separate local adapter can bridge verified results into the owner's CRM; its integration is not a claim about other users' installations.
